// Keep navigation aligned with actual pages and Keycloak realm roles.
// Backend guards, not this menu, are the authorization boundary.
export type HeaderRole = 'USER' | 'MODERATOR' | 'ADMIN';
export type HeaderLink = {
  href: '/' | '/espace' | '/moderation' | '/admin';
  label: string;
  icon: 'home' | 'box' | 'shield';
};

export function headerLinks(
  authenticated: boolean,
  roles: readonly HeaderRole[],
): HeaderLink[] {
  const links: HeaderLink[] = [
    { href: '/', label: 'Accueil', icon: 'home' },
  ];

  if (authenticated) {
    links.push({ href: '/espace', label: 'Mes articles', icon: 'box' });
    if (roles.includes('MODERATOR') || roles.includes('ADMIN')) {
      links.push({
        href: '/moderation',
        label: 'Modération',
        icon: 'shield',
      });
    }
    if (roles.includes('ADMIN')) {
      links.push({
        href: '/admin',
        label: 'Administration',
        icon: 'shield',
      });
    }
  }

  return links;
}
