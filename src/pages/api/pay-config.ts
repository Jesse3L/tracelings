import type { APIRoute } from 'astro';
import { payConfig } from '../../lib/server/square';
import { json } from '../../lib/server/session';

export const prerender = false;

// GET /api/pay-config/ : the public Square application and location IDs the in-page card form needs.
export const GET: APIRoute = async () => {
  try {
    const cfg = await payConfig();
    return cfg ? json(200, cfg) : json(503, { error: 'not_configured' });
  } catch (e) {
    console.error('pay-config failed', (e as Error).message);
    return json(502, { error: 'pay_config_failed' });
  }
};
