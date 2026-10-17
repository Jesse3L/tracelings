import type { APIRoute } from 'astro';
import type { WeekContent, WeekResponse } from '../../../lib/program/types';
import { templateContentFor } from '../../../lib/program/templates';
import { generateWeekContent, type Caller } from '../../../lib/server/ai';
import { requireMember, sameOrigin, readJson, rateLimited, json } from '../../../lib/server/programApi';
import {
  loadFamily, updateFamily, reserveGlobalAi, globalAiCount, childIdOk, weekKey, InvalidInput,
  REDOS_PER_WEEK, FAMILY_MONTHLY_CAP, GLOBAL_MONTHLY_CAP,
} from '../../../lib/server/programStore';
import type { FamilyDoc } from '../../../lib/program/types';

export const prerender = false;

// AI is made for weeks up to this many past the child's current week. Later weeks print from templates until
// the plan gets there, so one family can't spend a year of generations in an afternoon.
const AHEAD = 1;
const inFlight = new Set<string>();
/** Generations that came back but failed every check (or the call failed), per family per day. They don't use up
 *  the monthly count, so this small separate cap stops anyone from running up the bill with failing requests. */
export const FAILED_PER_DAY = Number(process.env.PROGRAM_FAILED_PER_DAY ?? '') || 10;
const today = () => new Date().toISOString().slice(0, 10);
/** The failed-attempt counter lives next to the monthly usage in the family doc (an extra field the store keeps). */
type Failed = { day: string; n: number };
const failedToday = (d: FamilyDoc): number => {
  const f = (d.usage as unknown as { failed?: Failed }).failed;
  return f && f.day === today() ? f.n : 0;
};
const addFailed = (d: FamilyDoc) => {
  (d.usage as unknown as { failed?: Failed }).failed = { day: today(), n: failedToday(d) + 1 };
};
/** Story paths this child had in the 3 weeks before this one, from saved content, so a week doesn't repeat them. */
const recentPaths = (d: FamilyDoc, childId: string, weekIndex: number): string[] =>
  [1, 2, 3].map((k) => d.content[weekKey(childId, weekIndex - k)]?.story?.pathId).filter((x): x is string => Boolean(x));

/**
 * Body: { childId, weekIndex, redo?: boolean }. POST only, same origin, members only.
 * Returns the saved content for that child-week, or makes it (once), or a fresh story when redo is set (2 per week).
 */
export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!sameOrigin(request, url)) return json(403, { error: 'bad_origin' });
  const m = await requireMember(cookies);
  if (!m.ok) return m.res;
  const key = m.ctx.key;
  if (rateLimited('week', key, 15, 60_000)) return json(429, { error: 'slow_down' });
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.res;
  const body = parsed.body ?? {};
  const allowed = new Set(['childId', 'weekIndex', 'redo']);
  if (typeof body !== 'object' || Object.keys(body).some((k) => !allowed.has(k))) return json(400, { error: 'unknown_field' });
  if (!childIdOk(body.childId)) return json(400, { error: 'bad_child_id' });
  if (!Number.isInteger(body.weekIndex) || body.weekIndex < 1 || body.weekIndex > 60) return json(400, { error: 'bad_week' });
  if (body.redo !== undefined && typeof body.redo !== 'boolean') return json(400, { error: 'bad_redo' });
  return weekFor(key, body.childId, body.weekIndex, body.redo === true);
};

/** The week request after the checks above: returns the saved week or makes it. Exported for tests (caller). */
export async function weekFor(key: string, childId: string, weekIndex: number, redo: boolean, opts: { caller?: Caller } = {}): Promise<Response> {
  const wk = weekKey(childId, weekIndex);
  try {
    const { doc } = await loadFamily(key);
    const child = doc.children.find((c) => c.id === childId);
    const plan = doc.plans[childId];
    if (!child || !plan) return json(404, { error: 'unknown_child' });
    const week = plan.weeks[weekIndex - 1];
    if (!week) return json(404, { error: 'unknown_week' });
    // What the content was made for. A check-in can shift a week's base week, theme or math step, and then it is made again.
    const sig = `${week.level}:${week.baseWeek}:${week.theme}${week.math ? `:${week.math.addTo ? `a${week.math.addTo}` : `n${week.math.number}`}` : ''}${week.extraReview ? ':r' : ''}`;
    const used = doc.usage.redos[wk] ?? 0;
    const cached = doc.content[wk] && (doc.contentFor?.[wk] ?? sig) === sig ? doc.content[wk] : undefined;
    const reply = (content: WeekContent, isCached: boolean, redosUsed: number, note?: WeekResponse['note']) =>
      json(200, { content, cached: isCached, redosLeft: Math.max(0, REDOS_PER_WEEK - redosUsed), ...(note ? { note } : {}) } satisfies WeekResponse);
    const template = (): WeekContent => ({ ...templateContentFor(child, week), source: 'template' });

    if (cached && !redo) return reply(cached, true, used);
    if (redo && used >= REDOS_PER_WEEK) return reply(cached ?? template(), Boolean(cached), used, 'redo-limit');
    if (weekIndex > plan.current + AHEAD) return reply(template(), false, used, 'not-yet');
    if (doc.usage.generations >= FAMILY_MONTHLY_CAP || failedToday(doc) >= FAILED_PER_DAY) return reply(cached ?? template(), Boolean(cached), used, 'limit');

    if (inFlight.has(`${key}:${wk}`)) return json(409, { error: 'busy' });
    inFlight.add(`${key}:${wk}`);
    let capped = false;
    try {
      // Before each model call the caps are checked (not counted): the family's monthly count, its failed attempts
      // today, and the global guard. A generation is counted once, only when it passed every check and is saved, so
      // a run of bad model output never uses up a family's month.
      const reserve = async () => {
        const { doc: d } = await loadFamily(key);
        if (d.usage.generations >= FAMILY_MONTHLY_CAP || failedToday(d) >= FAILED_PER_DAY) { capped = true; return false; }
        if ((await globalAiCount()) >= GLOBAL_MONTHLY_CAP) { capped = true; return false; }
        return true;
      };
      const path = { avoid: recentPaths(doc, childId, weekIndex), shift: redo ? used + 1 : 0 };
      const gen = await generateWeekContent(child, week, { reserve, path, caller: opts.caller });
      console.log('program week', JSON.stringify({ source: gen.content.source, calls: gen.calls, failed: gen.failed, reason: gen.reason ?? null, redo }));
      if (gen.content.source !== 'ai') {
        // One failed request counts once, however many tries it made inside. Not saved, so the next try can still
        // get an AI story (when the key is back or the month resets).
        if (gen.reason === 'invalid' || gen.reason === 'call-failed') await updateFamily(key, (d) => { addFailed(d); });
        return reply(cached ?? gen.content, Boolean(cached), used, capped || gen.reason === 'capped' ? 'limit' : 'fallback');
      }
      const { result } = await updateFamily(key, (d) => {
        const r = d.usage.redos[wk] ?? 0;
        // Someone else saved this week while we were generating: keep theirs unless this was a redo.
        if (!redo && d.content[wk] && (d.contentFor?.[wk] ?? sig) === sig) return { content: d.content[wk], used: r, saved: false };
        d.content[wk] = gen.content;
        d.contentFor = { ...(d.contentFor ?? {}), [wk]: sig };
        d.usage.generations += 1;
        if (redo) d.usage.redos[wk] = r + 1;
        return { content: gen.content, used: redo ? r + 1 : r, saved: true };
      });
      // The global spend guard counts saved generations too (it can overshoot by a few under races; the Anthropic
      // console spend limit is the hard stop).
      if (result.saved) await reserveGlobalAi().catch((e) => console.error('program week: global count failed', (e as Error).message));
      return reply(result.content, false, result.used);
    } finally {
      inFlight.delete(`${key}:${wk}`);
    }
  } catch (e) {
    if (e instanceof InvalidInput) return json(400, { error: e.code });
    console.error('program week failed', (e as Error).message);
    return json(502, { error: 'storage' });
  }
}
