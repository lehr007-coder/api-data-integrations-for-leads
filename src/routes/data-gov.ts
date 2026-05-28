import type { Env } from '../ghl';

interface DataGovRequest {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
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

export function dataGovStatusRoute(env: Env): Response {
  return Response.json({
    ok: true,
    provider: 'data.gov',
    configured: Boolean(env.DATA_GOV_API_KEY),
    note: 'DATA_GOV_API_KEY is stored for agency APIs that use api.data.gov gateway authentication.'
  });
}

function safeDataGovUrl(value?: string): URL {
  if (!value) throw new Error('url is required.');
  const url = new URL(value);
  const allowedHosts = new Set([
    'api.data.gov',
    'developer.nrel.gov',
    'developer.nps.gov',
    'api.nal.usda.gov',
    'api.usa.gov'
  ]);

  if (url.protocol !== 'https:') {
    throw new Error('Only https data.gov agency URLs are allowed.');
  }

  if (!allowedHosts.has(url.hostname)) {
    throw new Error(`Host ${url.hostname} is not on the data.gov allowlist.`);
  }

  if (!url.searchParams.has('api_key')) {
    url.searchParams.set('api_key', 'DATA_GOV_API_KEY_PLACEHOLDER');
  }

  return url;
}

export async function dataGovRequestRoute(request: Request, env: Env): Promise<Response> {
  try {
    if (!isAuthorized(request, env)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!env.DATA_GOV_API_KEY) {
      return Response.json({ ok: false, error: 'DATA_GOV_API_KEY is not configured.' }, { status: 503 });
    }

    const payload = await request.json() as DataGovRequest;
    const url = safeDataGovUrl(payload.url);
    url.searchParams.set('api_key', env.DATA_GOV_API_KEY);

    const method = (payload.method || 'GET').toUpperCase();
    if (!['GET', 'POST'].includes(method)) {
      return Response.json({ ok: false, error: 'method must be GET or POST.' }, { status: 400 });
    }

    const headers: HeadersInit = {
      Accept: 'application/json',
      ...(payload.headers || {})
    };
    delete (headers as Record<string, string>).authorization;
    delete (headers as Record<string, string>).Authorization;

    const upstream = await fetch(url.toString(), {
      method,
      headers,
      body: method === 'POST' && payload.body !== undefined ? JSON.stringify(payload.body) : undefined
    });

    const text = await upstream.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }

    const result = {
      ok: upstream.ok,
      status: upstream.status,
      provider: 'data.gov',
      url: `${url.origin}${url.pathname}`,
      body
    };

    if (payload.store !== false) {
      await env.RAW_PAYLOADS.put(
        `data-gov/${crypto.randomUUID()}.json`,
        JSON.stringify({ fetchedAt: new Date().toISOString(), result }, null, 2),
        { httpMetadata: { contentType: 'application/json' } }
      );
    }

    return Response.json(result, { status: upstream.ok ? 200 : 502 });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown data.gov request error'
    }, { status: 500 });
  }
}
