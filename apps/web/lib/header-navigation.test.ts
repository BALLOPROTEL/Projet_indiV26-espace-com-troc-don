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

  it.each([['MODERATOR'], ['ADMIN'], ['USER', 'MODERATOR']] as const)(
    'shows moderation for an authenticated elevated role %s',
    (roles) => {
      expect(headerLinks(true, roles).map((item) => item.href))
        .toEqual(['/', '/espace', '/moderation']);
    },
  );

  it('never exposes an unsupported /admin or fake messages link', () => {
    const urls = headerLinks(true, ['ADMIN']).map((item) => item.href);
    expect(urls).not.toContain('/admin');
    expect(urls).not.toContain('/messages');
  });
});
