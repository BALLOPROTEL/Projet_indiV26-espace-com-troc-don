import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const design = readFileSync(new URL('../app/design-system.css', import.meta.url), 'utf8');
const operational = readFileSync(new URL('../app/prototype-operational.css', import.meta.url), 'utf8');
const space = readFileSync(new URL('../app/espace/space-v3.css', import.meta.url), 'utf8');
const moderation = readFileSync(new URL('../app/moderation/management-v2.css', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../app/admin/admin-v2.css', import.meta.url), 'utf8');
const header = readFileSync(new URL('../components/site-header.tsx', import.meta.url), 'utf8');
const account = readFileSync(new URL('../components/account-shell.tsx', import.meta.url), 'utf8');
const exchanges = readFileSync(new URL('../components/exchange-space.tsx', import.meta.url), 'utf8');
const keycloak = readFileSync(
  new URL('../../../infra/keycloak/themes/petite-maison/login/resources/css/login.css', import.meta.url),
  'utf8',
);

const migratedCss = [space, moderation, admin, operational, keycloak].join('\n');
const legacyPalette = [
  '#172c27',
  '#0b553a',
  '#083e2e',
  '#173a2b',
  '#176a47',
  '#146c49',
  '#17784e',
  '#7a3441',
];

describe('#149 prototype visual contract', () => {
  it('uses one prototype palette on every migrated surface', () => {
    for (const color of ['#17324d', '#20afa3', '#f28c45', '#f7f9fb', '#344054']) {
      expect((design + operational + keycloak).toLowerCase()).toContain(color);
    }

    for (const legacy of legacyPalette) {
      expect(migratedCss.toLowerCase()).not.toContain(legacy);
    }
  });

  it('exposes a real exchange screen rather than only the old homepage anchor', () => {
    expect(header).toContain("href: '/echanges'");
    expect(exchanges).toContain('pm-exchange-hero');
    expect(exchanges).toContain('listingsApi.public()');
    expect(exchanges).toContain('<ListingCard');
  });

  it('uses the prototype account sidebar for operational member surfaces', () => {
    expect(account).toContain('pm-account-sidebar');
    expect(account).toContain('Vue d’ensemble');
    expect(account).toContain('Mes annonces');
    expect(account).toContain('Messages & échanges');
    expect(account).toContain('Modération');
  });

  it('keeps mobile account and footer interactions reachable', () => {
    expect(design).toContain('max-height: calc(100dvh');
    expect(design).toContain('overflow-y: auto');
    expect(design).toContain('.pm-footer a');
    expect(design).toContain('min-height: 44px');
  });
});
