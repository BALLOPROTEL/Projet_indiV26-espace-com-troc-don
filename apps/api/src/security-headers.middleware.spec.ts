import { SecurityHeadersMiddleware } from './security-headers.middleware';

describe('SecurityHeadersMiddleware', () => {
  it('removes framework disclosure and sets hardening headers', () => {
    const headers = new Map<string, string>();
    const removed: string[] = [];
    const response = {
      setHeader: (name: string, value: string) => {
        headers.set(name, value);
      },
      removeHeader: (name: string) => {
        removed.push(name);
      },
    };
    const next = jest.fn();

    new SecurityHeadersMiddleware().use(
      {},
      response,
      next,
    );

    expect(removed).toContain('X-Powered-By');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(headers.get('Permissions-Policy')).toContain(
      'camera=()',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
