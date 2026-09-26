import { Injectable } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from '@prometheus-io/client';

type HttpMetricLabels = {
  method: string;
  route: string;
  statusCode: number;
};

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  private readonly httpRequests = new Counter({
    name: 'projet_indiv26_http_requests_total',
    help: 'Total HTTP requests handled by the API.',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  });

  private readonly httpDuration = new Histogram({
    name: 'projet_indiv26_http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'projet_indiv26_',
    });
  }

  observeHttpRequest(
    labels: HttpMetricLabels,
    durationSeconds: number,
  ): void {
    const normalized = {
      method: labels.method,
      route: labels.route,
      status_code: String(labels.statusCode),
    };

    this.httpRequests.inc(normalized);
    this.httpDuration.observe(normalized, durationSeconds);
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
