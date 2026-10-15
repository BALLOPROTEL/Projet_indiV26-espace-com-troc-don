import { describe, expect, it } from 'vitest';
import { headerLinks } from './header-navigation';

describe('headerLinks role-aware navigation', () => {
  it('only shows public home to anonymous visitors', () => {
    expect(headerLinks(false, ['ADMIN']).map((item) => item.href)).toEqual(['/']);
  });

  it('shows member space, never moderation, for USER', () => {
    expect(headerLinks(true, ['USER']).map((item) => item.href))
      .toEqual(['/', '/espace']);
  });

  it.each([
    { roles: ['MODERATOR'] as const },
    { roles: ['USER', 'MODERATOR'] as const },
  ])('shows moderation, not administration, for $roles', ({ roles }) => {
    expect(headerLinks(true, roles).map((item) => item.href))
      .toEqual(['/', '/espace', '/moderation']);
  });

  it('shows a distinct administration link only for ADMIN', () => {
    expect(headerLinks(true, ['ADMIN']).map((item) => item.href))
      .toEqual(['/', '/espace', '/moderation', '/admin']);
    expect(headerLinks(true, ['MODERATOR', 'ADMIN']).map((item) => item.href))
      .toContain('/admin');
    expect(headerLinks(false, ['ADMIN']).map((item) => item.href)).toEqual(['/']);
  });

  it('does not expose nonfunctional messages or favorites entries', () => {
    const urls = headerLinks(true, ['ADMIN']).map((item) => item.href);
    expect(urls).not.toContain('/messages');
    expect(urls).not.toContain('/favoris');
  });
});
