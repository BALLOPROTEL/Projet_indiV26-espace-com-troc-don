import {
  request as httpRequest,
  type ClientRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type RequestOptions,
  type ServerResponse,
} from 'node:http';
import { request as httpsRequest } from 'node:https';
import { resolveGatewayRoute } from './routes';

type Next = () => void;

type GatewayRequest = IncomingMessage & {
  originalUrl?: string;
};

type TargetMap = {
  catalog: URL;
  marketplace: URL;
  legacy: URL;
};

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function copyRequestHeaders(
  headers: IncomingHttpHeaders,
  target: URL,
): IncomingHttpHeaders {
  const forwarded: IncomingHttpHeaders = {};

  for (const [name, value] of Object.entries(headers)) {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      forwarded[name] = value;
    }
  }

  forwarded.host = target.host;
  return forwarded;
}

function copyResponseHeaders(
  upstream: IncomingMessage,
  response: ServerResponse,
): void {
  for (const [name, value] of Object.entries(upstream.headers)) {
    if (
      value !== undefined &&
      !HOP_BY_HOP_HEADERS.has(name.toLowerCase())
    ) {
      response.setHeader(name, value);
    }
  }
}

function proxyRequest(
  request: GatewayRequest,
  response: ServerResponse,
  target: URL,
  upstreamPath: string,
): ClientRequest {
  const transport =
    target.protocol === 'https:' ? httpsRequest : httpRequest;

  const options: RequestOptions = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || undefined,
    method: request.method,
    path: upstreamPath,
    headers: copyRequestHeaders(request.headers, target),
  };

  const upstreamRequest = transport(options, (upstreamResponse) => {
    response.statusCode = upstreamResponse.statusCode ?? 502;
    if (upstreamResponse.statusMessage) {
      response.statusMessage = upstreamResponse.statusMessage;
    }

    copyResponseHeaders(upstreamResponse, response);
    upstreamResponse.pipe(response);
  });

  upstreamRequest.setTimeout(15_000, () => {
    upstreamRequest.destroy(
      new Error('Gateway upstream request timed out'),
    );
  });

  upstreamRequest.on('error', (error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }

    response.statusCode = 502;
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'Upstream service is unavailable',
      }),
    );
  });

  request.on('aborted', () => upstreamRequest.destroy());
  request.pipe(upstreamRequest);

  return upstreamRequest;
}

export function createProxyMiddleware(
  targets: TargetMap,
) {
  return (
    request: GatewayRequest,
    response: ServerResponse,
    next: Next,
  ): void => {
    const requestUrl = request.originalUrl ?? request.url ?? '/';
    const route = resolveGatewayRoute(requestUrl);

    if (!route || route.target === 'gateway') {
      next();
      return;
    }

    proxyRequest(
      request,
      response,
      targets[route.target],
      route.upstreamPath,
    );
  };
}
