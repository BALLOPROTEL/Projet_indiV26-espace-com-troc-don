import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  IncomingMessage,
  ServerResponse,
} from 'node:http';
import { applySecurityHeaders } from './security';

type GatewayRequest = IncomingMessage & {
  originalUrl?: string;
};

type MetricState = {
  count: number;
  sum: number;
  buckets: number[];
};

type GatewayFailure = {
  statusCode: number;
  outcome: string;
};

const gatewayFailures = new WeakMap<
  ServerResponse,
  GatewayFailure
>();

const HISTOGRAM_BUCKETS = [
  0.01,
  0.025,
  0.05,
  0.1,
  0.25,
  0.5,
  1,
  2.5,
  5,
  Number.POSITIVE_INFINITY,
];

function escapeLabel(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"');
}

function metricRouteLabel(requestUrl: string): string {
  const path = new URL(requestUrl, 'http://gateway.local').pathname;

  if (
    path === '/api/health/live' ||
    path === '/api/health/ready' ||
    path === '/api/metrics'
  ) {
    return path;
  }

  if (path === '/api/listings') {
    return path;
  }

  if (path.startsWith('/api/listings/')) {
    return '/api/listings/*';
  }

  if (path === '/api/moderation/listings') {
    return path;
  }

  if (path.startsWith('/api/moderation/listings/')) {
    return '/api/moderation/listings/*';
  }

  if (path === '/api/proposals') {
    return path;
  }

  if (path.startsWith('/api/proposals/')) {
    return '/api/proposals/*';
  }

  if (path === '/api/transactions') {
    return path;
  }

  if (path.startsWith('/api/transactions/')) {
    return '/api/transactions/*';
  }

  if (path === '/api/auth' || path.startsWith('/api/auth/')) {
    return '/api/auth/*';
  }

  return 'unknown';
}

@Injectable()
export class GatewayMetrics {
  private readonly states = new Map<string, MetricState>();

  observe(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const key = JSON.stringify([method, route, statusCode]);
    const state = this.states.get(key) ?? {
      count: 0,
      sum: 0,
      buckets: HISTOGRAM_BUCKETS.map(() => 0),
    };

    state.count += 1;
    state.sum += durationSeconds;

    HISTOGRAM_BUCKETS.forEach((bucket, index) => {
      if (durationSeconds <= bucket) {
        state.buckets[index] += 1;
      }
    });

    this.states.set(key, state);
  }

  metrics(): string {
    const counterLines = [
      '# HELP projet_indiv26_http_requests_total Total HTTP requests handled by the API Gateway.',
      '# TYPE projet_indiv26_http_requests_total counter',
    ];
    const histogramLines = [
      '# HELP projet_indiv26_http_request_duration_seconds HTTP request duration in seconds at the API Gateway.',
      '# TYPE projet_indiv26_http_request_duration_seconds histogram',
    ];

    for (const [key, state] of [...this.states.entries()].sort()) {
      const [method, route, statusCode] = JSON.parse(key) as [
        string,
        string,
        number,
      ];
      const labels =
        `method="${escapeLabel(method)}",route="${escapeLabel(route)}",status_code="${statusCode}"`;

      counterLines.push(
        `projet_indiv26_http_requests_total{${labels}} ${state.count}`,
      );

      HISTOGRAM_BUCKETS.forEach((bucket, index) => {
        const le = Number.isFinite(bucket) ? String(bucket) : '+Inf';
        histogramLines.push(
          `projet_indiv26_http_request_duration_seconds_bucket{${labels},le="${le}"} ${state.buckets[index]}`,
        );
      });
      histogramLines.push(
        `projet_indiv26_http_request_duration_seconds_sum{${labels}} ${state.sum}`,
      );
      histogramLines.push(
        `projet_indiv26_http_request_duration_seconds_count{${labels}} ${state.count}`,
      );
    }

    return `${counterLines.join('\n')}\n${histogramLines.join('\n')}\n`;
  }
}

export function markGatewayFailure(
  response: ServerResponse,
  outcome: string,
  statusCode = 502,
): void {
  gatewayFailures.set(response, {
    statusCode,
    outcome,
  });
}

function resolveRequestId(
  candidate: string | string[] | undefined,
): string {
  const value = Array.isArray(candidate)
    ? candidate[0]
    : candidate;

  if (
    typeof value === 'string' &&
    /^[A-Za-z0-9._:-]{1,128}$/.test(value)
  ) {
    return value;
  }

  return randomUUID();
}

export function createGatewayObservabilityMiddleware(
  metrics: GatewayMetrics,
) {
  return (
    request: GatewayRequest,
    response: ServerResponse,
    next: () => void,
  ): void => {
    const requestId = resolveRequestId(
      request.headers['x-request-id'],
    );
    const requestUrl = request.originalUrl ?? request.url ?? '/';
    const route = metricRouteLabel(requestUrl);
    const method = request.method ?? 'UNKNOWN';
    const startedAt = process.hrtime.bigint();
    let finalized = false;

    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);
    applySecurityHeaders(response);

    const finalize = (): void => {
      if (finalized) {
        return;
      }
      finalized = true;

      const durationSeconds =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      const durationMs = durationSeconds * 1_000;
      const failure = gatewayFailures.get(response);
      const completed = response.writableEnded;
      const statusCode =
        failure?.statusCode ??
        (completed ? response.statusCode || 0 : 499);
      const outcome =
        failure?.outcome ??
        (completed ? 'completed' : 'downstream_closed');

      metrics.observe(
        method,
        route,
        statusCode,
        durationSeconds,
      );

      process.stdout.write(
        `${JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          event: 'http_request',
          service: 'gateway',
          request_id: requestId,
          method,
          path: new URL(
            requestUrl,
            'http://gateway.local',
          ).pathname,
          route,
          status_code: statusCode,
          downstream_status_code: response.statusCode || 0,
          outcome,
          duration_ms: Number(durationMs.toFixed(2)),
        })}\n`,
      );
    };

    response.once('finish', finalize);
    response.once('close', finalize);

    next();
  };
}
