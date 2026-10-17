import type { APIRoute } from 'astro';
import { applyCheckIn } from '../../../lib/program/engine';
import { requireMember, sameOrigin, readJson, rateLimited, json } from '../../../lib/server/programApi';
import { updateFamily, cleanCheckIn, cleanPlan, childIdOk, InvalidInput } from '../../../lib/server/programStore';

export const prerender = false;

/** Body: { childId, weekIndex, results: { [skillId]: 'got-it' | 'still-working' } }. Saves it and returns the adjusted plan.
 *  weekIndex must be the current week or the one before it (409 future_week / too_late otherwise). */
export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!sameOrigin(request, url)) return json(403, { error: 'bad_origin' });
  const m = await requireMember(cookies);
  if (!m.ok) return m.res;
  if (rateLimited('checkin', m.ctx.key, 12, 60_000)) return json(429, { error: 'slow_down' });
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.res;
  const body = parsed.body;
  if (!body || typeof body !== 'object' || !childIdOk(body.childId)) return json(400, { error: 'bad_child_id' });
  try {
    const { result } = await updateFamily(m.ctx.key, (doc) => {
      const child = doc.children.find((c) => c.id === body.childId);
      const plan = doc.plans[body.childId];
      if (!child || !plan) throw new InvalidInput('unknown_child');
      const checkIn = cleanCheckIn(body, plan);
      // Only this week, or last week (a late check-in), never a week ahead.
      if (checkIn.weekIndex > plan.current) throw new InvalidInput('future_week');
      if (checkIn.weekIndex < plan.current - 1) throw new InvalidInput('too_late');
      // One check-in per child-week: a second one replaces the first.
      doc.checkIns = doc.checkIns.filter((c) => !(c.childId === checkIn.childId && c.weekIndex === checkIn.weekIndex));
      doc.checkIns.push(checkIn);
      const next = cleanPlan(applyCheckIn(plan, checkIn), child);
      doc.plans[child.id] = next;
      return { plan: next, checkIn };
    });
    console.log('program checkin saved');
    return json(200, result);
  } catch (e) {
    if (e instanceof InvalidInput) return json(e.code === 'unknown_child' ? 404 : e.code === 'future_week' || e.code === 'too_late' ? 409 : 400, { error: e.code });
    console.error('program checkin failed', (e as Error).message);
    return json(503, { error: 'storage_unavailable', retryAfter: 30 });
  }
};
