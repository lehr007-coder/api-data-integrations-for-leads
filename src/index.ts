import { intakeRoute } from './routes/intake';
import { healthRoute } from './routes/health';
import {
  attomBatchRoute,
  attomForeclosureFeedRoute,
  attomPropertyRoute,
  attomStatusRoute,
  runAttomForeclosureMonitor
} from './routes/attom';
import { skipTraceCompleteRoute } from './routes/skip-trace';
import { dncCompleteRoute } from './routes/dnc';
import { recordListRoute, recordStatusRoute } from './routes/records';
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

    if (url.pathname === '/providers/attom/status' && request.method === 'GET') {
      return attomStatusRoute(env);
    }

    if (url.pathname === '/providers/attom/property' && request.method === 'POST') {
      return attomPropertyRoute(request, env);
    }

    if (url.pathname === '/providers/attom/batch' && request.method === 'POST') {
      return attomBatchRoute(request, env);
    }

    if (url.pathname === '/providers/attom/foreclosures' && request.method === 'POST') {
      return attomForeclosureFeedRoute(request, env);
    }

    if (url.pathname === '/pending/skip-trace/complete' && request.method === 'POST') {
      return skipTraceCompleteRoute(request, env);
    }

    if (url.pathname === '/pending/dnc/complete' && request.method === 'POST') {
      return dncCompleteRoute(request, env);
    }

    if (url.pathname === '/records/status' && request.method === 'GET') {
      return recordStatusRoute(request, env);
    }

    if (url.pathname === '/records/list' && request.method === 'GET') {
      return recordListRoute(request, env);
    }

    return Response.json({ ok: false, error: 'Not Found' }, { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runAttomForeclosureMonitor(env));
  }
};
