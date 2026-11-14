import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Static contract test: the first UX navigation layer must point to real
// in-page destinations; browser E2E still verifies the live experience.
const home = readFileSync(new URL('../components/home-experience.tsx', import.meta.url), 'utf8');
const space = readFileSync(new URL('../components/personal-space.tsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../components/listing-detail.tsx', import.meta.url), 'utf8');
const header = readFileSync(new URL('../components/site-header.tsx', import.meta.url), 'utf8');
const exchanges = readFileSync(new URL('../components/marketplace-dashboard.tsx', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../components/admin-dashboard.tsx', import.meta.url), 'utf8');
const moderation = readFileSync(new URL('../components/moderation-space.tsx', import.meta.url), 'utf8');

describe('UX V4 task-first entry points', () => {
  it('offers catalogue browsing without authentication and an actual help section', () => {
    expect(home).toContain('href="#annonces"');
    expect(home).toContain('id="annonces"');
    expect(home).toContain('href="#fonctionnement"');
    expect(home).toContain('id="fonctionnement"');
    expect(home).toContain('href="/espace#publier"');
  });

  it('provides a real target for every member shortcut', () => {
    for (const id of ['publier', 'mes-articles', 'mes-echanges']) {
      expect(space).toContain(`id="${id}"`);
      expect(space).toContain(`href="#${id}"`);
      expect(header).toContain(`href="/espace#${id}"`);
    }
    expect(space).toContain('workspaceSectionFromHash(window.location.hash)');
    expect(space).toContain('requestAnimationFrame');
    expect(space).toContain('<MarketplaceDashboard />');
    expect(space).toContain('<ListingForm');
  });

  it('links the listing detail to its actual proposal form and back to catalogue', () => {
    expect(detail).toContain('href="/#annonces"');
    expect(detail).toContain('href="#faire-une-demande"');
    expect(detail).toContain('id="faire-une-demande"');
    expect(detail).toContain('<ListingProposalForm listing={listing} />');
    expect(detail).toContain('href="/espace#publier"');
  });

  it('exposes concrete sections for received, sent and completed exchange steps', () => {
    for (const section of ['echanges-recus', 'echanges-envoyes', 'echanges-remises']) {
      expect(exchanges).toContain(`href="#${section}"`);
      expect(exchanges).toContain(`id="${section}"`);
    }
    expect(exchanges).toContain("marketplaceApi.received");
    expect(exchanges).toContain("marketplaceApi.mine");
    expect(exchanges).toContain("marketplaceApi.transactions");
  });

  it('keeps administrators and moderators on real existing destinations', () => {
    expect(admin).toContain('href="/moderation"');
    expect(admin).toContain('href="/#annonces"');
    expect(admin).toContain('href="/espace#mes-echanges"');
    expect(moderation).toContain('id="file-moderation"');
    expect(moderation).toContain("hasAnyRole('MODERATOR', 'ADMIN')");
  });

  it('does not offer invented functional pages or bypass role-based menus', () => {
    expect(header).not.toContain('href="/messages"');
    expect(header).not.toContain('href="/favoris"');
    expect(header).toContain("roles.includes('ADMIN')");
    expect(header).toContain("roles.includes('MODERATOR')");
  });
});
