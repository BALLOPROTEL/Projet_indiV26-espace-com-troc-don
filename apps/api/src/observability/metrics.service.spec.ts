import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('exports default process metrics and observed HTTP metrics', async () => {
    const service = new MetricsService();

    service.observeHttpRequest(
      {
        method: 'GET',
        route: '/api/listings',
        statusCode: 200,
      },
      0.123,
    );

    const metrics = await service.metrics();

    expect(metrics).toContain(
      'projet_indiv26_http_requests_total',
    );
    expect(metrics).toContain(
      'projet_indiv26_http_request_duration_seconds_bucket',
    );
    expect(metrics).toContain(
      'projet_indiv26_process_resident_memory_bytes',
    );
    expect(metrics).toContain('method="GET"');
    expect(metrics).toContain('route="/api/listings"');
    expect(metrics).toContain('status_code="200"');
  });
});
