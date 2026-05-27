import { intakeRoute } from './routes/intake';
import { healthRoute } from './routes/health';
import type { Env } from './ghl';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      return healthRoute();
    }

    if (url.pathname === '/intake/public-record' && request.method === 'POST') {
      return intakeRoute(request, env);
    }

    if (url.pathname === '/intake/test' && request.method === 'POST') {
      return intakeRoute(request, env);
    }

    return Response.json({ ok: false, error: 'Not Found' }, { status: 404 });
  }
};
