import type { Env } from '../ghl';

interface BridgeReviewsRequest {
  revieweeKey?: string;
  revieweeEmail?: string;
  top?: number;
  skip?: number;
  store?: boolean;
}

function getAuthHeader(request: Request): string | null {
  return request.headers.get('x-webhook-secret') || request.headers.get('authorization');
}

function isAuthorized(request: Request, env: Env): boolean {
  if (!env.WEBHOOK_SECRET) return false;
  const header = getAuthHeader(request);
  if (!header) return false;
  return header === env.WEBHOOK_SECRET || header === `Bearer ${env.WEBHOOK_SECRET}`;
}

function clean(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function boundedTop(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 10;
  return Math.min(parsed, 100);
}

function odataQuote(value: string): string {
  return value.replace(/'/g, "''");
}

async function bridgeFetch(env: Env, path: string, params: Record<string, string | number | undefined>): Promise<any> {
  if (!env.BRIDGE_ACCESS_TOKEN) {
    throw new Error('BRIDGE_ACCESS_TOKEN is not configured.');
  }

  const url = new URL(`https://api.bridgedataoutput.com/api/v2/OData/reviews/${path}`);
  url.searchParams.set('access_token', env.BRIDGE_ACCESS_TOKEN);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  return {
    ok: res.ok,
    status: res.status,
    resource: path,
    body
  };
}

export function bridgeStatusRoute(env: Env): Response {
  return Response.json({
    ok: true,
    provider: 'bridge-zillow-agent-reviews',
    configured: Boolean(env.BRIDGE_ACCESS_TOKEN),
    resources: ['Reviewees', 'Reviews'],
    note: 'Requires approved Zillow Agent Reviews access in Bridge and BRIDGE_ACCESS_TOKEN.'
  });
}

export async function bridgeRevieweesRoute(request: Request, env: Env): Promise<Response> {
  try {
    if (!isAuthorized(request, env)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!env.BRIDGE_ACCESS_TOKEN) {
      return Response.json({ ok: false, error: 'BRIDGE_ACCESS_TOKEN is not configured.' }, { status: 503 });
    }

    const payload = await request.json() as BridgeReviewsRequest;
    const revieweeEmail = clean(payload.revieweeEmail);
    const params: Record<string, string | number | undefined> = {
      '$top': boundedTop(payload.top),
      '$skip': Number.isInteger(payload.skip) && Number(payload.skip) >= 0 ? Number(payload.skip) : undefined
    };

    if (revieweeEmail) {
      params['$filter'] = `RevieweeEmail eq '${odataQuote(revieweeEmail)}'`;
      params['$expand'] = 'Reviews';
    }

    const result = await bridgeFetch(env, 'Reviewees', params);
    if (payload.store !== false) {
      await env.RAW_PAYLOADS.put(
        `bridge-zillow-reviews/reviewees-${crypto.randomUUID()}.json`,
        JSON.stringify({ fetchedAt: new Date().toISOString(), request: { ...payload, store: undefined }, result }, null, 2),
        { httpMetadata: { contentType: 'application/json' } }
      );
    }

    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown Bridge reviewees error'
    }, { status: 500 });
  }
}

export async function bridgeReviewsRoute(request: Request, env: Env): Promise<Response> {
  try {
    if (!isAuthorized(request, env)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!env.BRIDGE_ACCESS_TOKEN) {
      return Response.json({ ok: false, error: 'BRIDGE_ACCESS_TOKEN is not configured.' }, { status: 503 });
    }

    const payload = await request.json() as BridgeReviewsRequest;
    const revieweeKey = clean(payload.revieweeKey);
    const params: Record<string, string | number | undefined> = {
      '$top': boundedTop(payload.top),
      '$skip': Number.isInteger(payload.skip) && Number(payload.skip) >= 0 ? Number(payload.skip) : undefined
    };

    if (revieweeKey) {
      params['$filter'] = `RevieweeKey eq '${odataQuote(revieweeKey)}'`;
    }

    const result = await bridgeFetch(env, 'Reviews', params);
    if (payload.store !== false) {
      await env.RAW_PAYLOADS.put(
        `bridge-zillow-reviews/reviews-${crypto.randomUUID()}.json`,
        JSON.stringify({ fetchedAt: new Date().toISOString(), request: { ...payload, store: undefined }, result }, null, 2),
        { httpMetadata: { contentType: 'application/json' } }
      );
    }

    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown Bridge reviews error'
    }, { status: 500 });
  }
}
