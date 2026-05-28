import type { Env } from '../ghl';

const STAGES = [
  { key: 'attom', suffix: '.attom.json' },
  { key: 'skipTrace', suffix: '.skip-trace-complete.json' },
  { key: 'dnc', suffix: '.dnc-complete.json' },
  { key: 'readyActions', suffix: '.ghl-ready-actions.json' },
  { key: 'adminRelease', suffix: '.admin-release.json' },
  { key: 'adminHold', suffix: '.admin-hold.json' },
  { key: 'intake', suffix: '.json' }
] as const;

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

async function readJson(env: Env, key: string): Promise<any | null> {
  const object = await env.RAW_PAYLOADS.get(key);
  if (!object) return null;
  return object.json();
}

function summarizeStage(stage: string, record: any): Record<string, unknown> {
  if (!record) return { exists: false };

  if (stage === 'attom') {
    return {
      exists: true,
      receivedAt: record.receivedAt,
      route: record.feeder?.route,
      matched: Boolean(record.attomBody?.property?.length),
      attomStatus: record.attomBody?.status,
      lead: record.payload
    };
  }

  if (stage === 'skipTrace') {
    return {
      exists: true,
      completedAt: record.completedAt,
      route: record.feeder?.route,
      contactAppended: {
        hasEmail: Boolean(record.input?.hasEmail),
        hasPhone: Boolean(record.input?.hasPhone)
      },
      ghl: record.ghl,
      lead: record.payload
    };
  }

  if (stage === 'dnc') {
    return {
      exists: true,
      completedAt: record.completedAt,
      route: record.route,
      dncStatus: record.input?.dnc_status,
      provider: record.input?.provider,
      resultId: record.input?.result_id,
      ghl: record.ghl
    };
  }

  if (stage === 'readyActions') {
    return {
      exists: true,
      createdAt: record.createdAt,
      action: record.action
    };
  }

  if (stage === 'adminHold') {
    return {
      exists: true,
      heldAt: record.heldAt,
      reason: record.decision?.reason,
      allowGhlSync: record.decision?.allowGhlSync,
      lead: record.lead
    };
  }

  if (stage === 'adminRelease') {
    return {
      exists: true,
      releasedAt: record.releasedAt,
      ghl: record.ghl,
      lead: record.lead
    };
  }

  return {
    exists: true,
    receivedAt: record.receivedAt,
    payload: record.payload
  };
}

export async function recordStatusRoute(request: Request, env: Env): Promise<Response> {
  try {
    if (!isAuthorized(request, env)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const cloudflareRecordRef = clean(url.searchParams.get('cloudflareRecordRef'));

    if (!cloudflareRecordRef) {
      return Response.json({ ok: false, error: 'cloudflareRecordRef query parameter is required.' }, { status: 400 });
    }

    const stageEntries = await Promise.all(
      STAGES.map(async ({ key, suffix }) => {
        const record = await readJson(env, `${cloudflareRecordRef}${suffix}`);
        return [key, summarizeStage(key, record)] as const;
      })
    );
    const stages = Object.fromEntries(stageEntries);
    const found = Object.values(stages).some((stage: any) => Boolean(stage.exists));

    if (!found) {
      return Response.json({ ok: false, error: `No records found for ${cloudflareRecordRef}.` }, { status: 404 });
    }

    const currentRoute =
      (stages.readyActions as any).exists ? 'worked' :
      (stages.adminRelease as any).exists ? 'admin_released' :
      (stages.adminHold as any).exists ? 'admin_hold' :
      (stages.dnc as any).route ||
      (stages.skipTrace as any).route ||
      (stages.attom as any).route ||
      'intake';

    return Response.json({
      ok: true,
      cloudflareRecordRef,
      currentRoute,
      stages
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown record status error'
    }, { status: 500 });
  }
}

function boundedLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 25;
  return Math.min(parsed, 100);
}

function stageFromKey(key: string): string {
  const match = STAGES.find((stage) => key.endsWith(stage.suffix));
  return match?.key || 'unknown';
}

function recordRefFromKey(key: string): string {
  const match = STAGES.find((stage) => key.endsWith(stage.suffix));
  return match ? key.slice(0, -match.suffix.length) : key;
}

export async function recordListRoute(request: Request, env: Env): Promise<Response> {
  try {
    if (!isAuthorized(request, env)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = boundedLimit(url.searchParams.get('limit'));
    const prefix = clean(url.searchParams.get('prefix'));
    const cursor = clean(url.searchParams.get('cursor'));

    const listed = await env.RAW_PAYLOADS.list({
      limit,
      prefix,
      cursor
    });

    return Response.json({
      ok: true,
      truncated: listed.truncated,
      cursor: listed.truncated ? listed.cursor : undefined,
      records: listed.objects.map((object) => ({
        key: object.key,
        cloudflareRecordRef: recordRefFromKey(object.key),
        stage: stageFromKey(object.key),
        size: object.size,
        uploaded: object.uploaded?.toISOString()
      }))
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown record list error'
    }, { status: 500 });
  }
}
