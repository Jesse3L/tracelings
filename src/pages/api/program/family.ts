import type { APIRoute } from 'astro';
import type { ChildPlan, FamilyDoc, FamilyResponse } from '../../../lib/program/types';
import { placeChild, rebasePlan, placeLevel } from '../../../lib/program/engine';
import { requireMember, sameOrigin, readJson, rateLimited, json } from '../../../lib/server/programApi';
import { loadFamily, updateFamily, cleanProfile, cleanPlan, childIdOk, InvalidInput, MAX_CHILDREN, REDOS_PER_WEEK, cachedKeys } from '../../../lib/server/programStore';

export const prerender = false;

const view = (doc: FamilyDoc): FamilyResponse => ({
  children: doc.children,
  plans: doc.plans,
  checkIns: doc.checkIns,
  cached: cachedKeys(doc),
  redos: doc.usage.redos,
  limits: { maxChildren: MAX_CHILDREN, redosPerWeek: REDOS_PER_WEEK },
});

export const GET: APIRoute = async ({ cookies }) => {
  const m = await requireMember(cookies);
  if (!m.ok) return m.res;
  if (rateLimited('family-get', m.ctx.key, 60, 60_000)) return json(429, { error: 'slow_down' });
  try {
    const { doc } = await loadFamily(m.ctx.key);
    return json(200, view(doc));
  } catch (e) {
    console.error('program family load failed', (e as Error).message);
    return unavailable();
  }
};

/** Storage is down: a friendly 503 the dashboard understands (it prints from this device meanwhile). */
const unavailable = () => new Response(JSON.stringify({ error: 'storage_unavailable', message: 'Saved plans are temporarily unavailable. Please try again in a minute.', retryAfter: 30 }), {
  status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '30' },
});

/**
 * Body (every part optional):
 *   children: ChildProfile[]          add or update these profiles (no names; unknown keys are dropped)
 *   plans: { [childId]: ChildPlan }    save these plans; a new or changed profile without a plan is placed by the engine
 *   current: { [childId]: number }     move a child's current week
 *   remove: string[]                   delete these children with their plans, check-ins and saved content
 *   restart: string[]                  children whose plan may start over because new answers move them to the other
 *                                      track (Pre-K or Kindergarten). Without it such a change is refused with 409
 *                                      restart_needed, so a plan is never reset without the parent agreeing first.
 * Editing a profile on the same track keeps the child's position: weeks done and the current week stay, the weeks
 * ahead are rebuilt from the new answers (engine rebasePlan).
 */
export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!sameOrigin(request, url)) return json(403, { error: 'bad_origin' });
  const m = await requireMember(cookies);
  if (!m.ok) return m.res;
  if (rateLimited('family-post', m.ctx.key, 20, 60_000)) return json(429, { error: 'slow_down' });
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.res;
  const body = parsed.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return json(400, { error: 'bad_request' });
  const allowed = new Set(['children', 'plans', 'current', 'remove', 'restart']);
  if (Object.keys(body).some((k) => !allowed.has(k))) return json(400, { error: 'unknown_field' });

  try {
    // Validate everything before touching storage.
    const incoming = body.children === undefined ? [] : Array.isArray(body.children) && body.children.length <= MAX_CHILDREN ? body.children.map(cleanProfile) : (() => { throw new InvalidInput('bad_children'); })();
    const remove: string[] = body.remove === undefined ? [] : Array.isArray(body.remove) && body.remove.length <= MAX_CHILDREN && body.remove.every(childIdOk) ? body.remove : (() => { throw new InvalidInput('bad_remove'); })();
    const plansIn = body.plans === undefined ? {} : typeof body.plans === 'object' && body.plans && !Array.isArray(body.plans) && Object.keys(body.plans).length <= MAX_CHILDREN ? body.plans : (() => { throw new InvalidInput('bad_plans'); })();
    const restart: string[] = body.restart === undefined ? [] : Array.isArray(body.restart) && body.restart.length <= MAX_CHILDREN && body.restart.every(childIdOk) ? body.restart : (() => { throw new InvalidInput('bad_restart'); })();
    const current = body.current === undefined ? {} : typeof body.current === 'object' && body.current && !Array.isArray(body.current) && Object.keys(body.current).length <= MAX_CHILDREN ? body.current : (() => { throw new InvalidInput('bad_current'); })();

    const { doc } = await updateFamily(m.ctx.key, (doc) => {
      for (const id of remove) {
        doc.children = doc.children.filter((c) => c.id !== id);
        delete doc.plans[id];
        doc.checkIns = doc.checkIns.filter((c) => c.childId !== id);
        for (const k of Object.keys(doc.content)) if (k.startsWith(`${id}:`)) { delete doc.content[k]; delete doc.contentFor?.[k]; }
      }
      for (const p of incoming) {
        const i = doc.children.findIndex((c) => c.id === p.id);
        const old = i >= 0 ? doc.children[i] : undefined;
        const changed = !old || JSON.stringify({ ...old, createdAt: '' }) !== JSON.stringify({ ...p, createdAt: '' });
        const prev = doc.plans[p.id];
        if (plansIn[p.id] === undefined && prev && changed && placeLevel(p) !== prev.level && !restart.includes(p.id)) {
          throw new InvalidInput('restart_needed', { childId: p.id, level: placeLevel(p) });
        }
        if (old) doc.children[i] = p;
        else {
          if (doc.children.length >= MAX_CHILDREN) throw new InvalidInput('too_many_children');
          doc.children.push(p);
        }
        if (plansIn[p.id] !== undefined) doc.plans[p.id] = cleanPlan(plansIn[p.id], p);
        else if (!prev) doc.plans[p.id] = cleanPlan(placeChild(p), p);
        else if (changed) {
          // Check-ins are kept either way: they are the child's record (progress report). Saved weeks are matched
          // to the plan by what they were made for (week.ts), so a moved week never gets the wrong content.
          doc.plans[p.id] = cleanPlan(rebasePlan(prev, old, p).plan, p);
        }
      }
      for (const [id, raw] of Object.entries(plansIn)) {
        if (incoming.some((p: { id: string }) => p.id === id)) continue;
        const child = doc.children.find((c) => c.id === id);
        if (!child) throw new InvalidInput('unknown_child');
        doc.plans[id] = cleanPlan(raw, child);
      }
      for (const [id, n] of Object.entries(current)) {
        // Own keys only: "__proto__" must not reach Object.prototype (a 400, not a crash that looks like storage down).
        const plan: ChildPlan | undefined = childIdOk(id) && Object.hasOwn(doc.plans, id) ? doc.plans[id] : undefined;
        if (!plan || !Number.isInteger(n) || (n as number) < 1 || (n as number) > plan.weeks.length) throw new InvalidInput('bad_current');
        plan.current = n as number;
      }
    });
    console.log('program family saved', JSON.stringify({ children: doc.children.length, added: incoming.length, removed: remove.length }));
    return json(200, view(doc));
  } catch (e) {
    if (e instanceof InvalidInput) return json(e.code === 'too_many_children' || e.code === 'restart_needed' ? 409 : 400, { error: e.code, ...(e.detail ?? {}) });
    console.error('program family save failed', (e as Error).message);
    return unavailable();
  }
};
