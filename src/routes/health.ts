export async function healthRoute(): Promise<Response> {
  return Response.json({
    ok: true,
    service: 'api-data-integrations-for-leads',
    timestamp: new Date().toISOString()
  });
}
