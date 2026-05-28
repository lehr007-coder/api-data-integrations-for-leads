import type { Env } from '../ghl';

interface SmartyAddressRequest {
  street?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  candidates?: number;
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

export function smartyStatusRoute(env: Env): Response {
  return Response.json({
    ok: true,
    provider: 'smarty',
    configured: Boolean(env.SMARTY_AUTH_ID && env.SMARTY_AUTH_TOKEN),
    hasAuthId: Boolean(env.SMARTY_AUTH_ID),
    hasAuthToken: Boolean(env.SMARTY_AUTH_TOKEN),
    note: 'Smarty US Street API requires both SMARTY_AUTH_ID and SMARTY_AUTH_TOKEN for server-side requests.'
  });
}

export async function smartyUsStreetRoute(request: Request, env: Env): Promise<Response> {
  try {
    if (!isAuthorized(request, env)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!env.SMARTY_AUTH_ID || !env.SMARTY_AUTH_TOKEN) {
      return Response.json({
        ok: false,
        error: 'SMARTY_AUTH_ID and SMARTY_AUTH_TOKEN are required.'
      }, { status: 503 });
    }

    const payload = await request.json() as SmartyAddressRequest;
    const street = clean(payload.street);
    if (!street) {
      return Response.json({ ok: false, error: 'street is required.' }, { status: 400 });
    }

    const url = new URL('https://us-street.api.smarty.com/street-address');
    url.searchParams.set('auth-id', env.SMARTY_AUTH_ID);
    url.searchParams.set('auth-token', env.SMARTY_AUTH_TOKEN);
    url.searchParams.set('street', street);
    if (payload.city) url.searchParams.set('city', payload.city);
    if (payload.state) url.searchParams.set('state', payload.state);
    if (payload.zipcode) url.searchParams.set('zipcode', payload.zipcode);
    url.searchParams.set('candidates', String(Math.min(Math.max(payload.candidates || 1, 1), 10)));

    const upstream = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    const body = await upstream.json();
    const result = {
      ok: upstream.ok,
      status: upstream.status,
      provider: 'smarty',
      candidates: Array.isArray(body) ? body.length : 0,
      body
    };

    if (payload.store !== false) {
      await env.RAW_PAYLOADS.put(
        `smarty/${crypto.randomUUID()}.json`,
        JSON.stringify({ checkedAt: new Date().toISOString(), request: { ...payload, store: undefined }, result }, null, 2),
        { httpMetadata: { contentType: 'application/json' } }
      );
    }

    return Response.json(result, { status: upstream.ok ? 200 : 502 });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown Smarty request error'
    }, { status: 500 });
  }
}
