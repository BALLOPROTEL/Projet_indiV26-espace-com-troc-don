import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const home = readFileSync(new URL('../components/home-experience.tsx', import.meta.url), 'utf8');
const space = readFileSync(new URL('../components/personal-space.tsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../components/listing-detail.tsx', import.meta.url), 'utf8');
const header = readFileSync(new URL('../components/site-header.tsx', import.meta.url), 'utf8');
const exchanges = readFileSync(new URL('../components/marketplace-dashboard.tsx', import.meta.url), 'utf8');
const exchangePage = readFileSync(new URL('../components/exchange-space.tsx', import.meta.url), 'utf8');
const showcase = readFileSync(new URL('../components/prototype-showcase-pages.tsx', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../components/admin-dashboard.tsx', import.meta.url), 'utf8');
const moderation = readFileSync(new URL('../components/moderation-space.tsx', import.meta.url), 'utf8');
const accountShell = readFileSync(new URL('../components/account-shell.tsx', import.meta.url), 'utf8');
const designSystemCss = readFileSync(new URL('../app/design-system.css', import.meta.url), 'utf8');
const operationalCss = readFileSync(new URL('../app/prototype-operational.css', import.meta.url), 'utf8');

describe('#149 dedicated-page navigation', () => {
  it('uses five real top-level routes instead of homepage pseudo-pages', () => {
    for (const href of ['/', '/boutique', '/echanges', '/fanzines', '/festival']) {
      expect(header).toContain(`href: '${href}'`);
    }

    expect(home).toContain('href="/boutique"');
    expect(home).toContain('href="/echanges"');
    expect(home).toContain('href="/fanzines"');
    expect(home).toContain('href="/festival"');
    expect(home).not.toContain('href="#boutique"');
    expect(home).not.toContain('id="boutique"');
    expect(home).not.toContain('id="fanzines"');
    expect(home).not.toContain('id="actualites"');
  });

  it('keeps future commercial and editorial pages honest', () => {
    expect(showcase).toContain('BoutiqueShowcase');
    expect(showcase).toContain('FanzinesShowcase');
    expect(showcase).toContain('FestivalShowcase');
    expect(showcase).toContain('Les produits, prix, stocks, favoris, panier et commandes');
    expect(showcase).toContain('Aucun article fictif');
    expect(showcase).not.toContain('39,90');
    expect(showcase).not.toContain('29,00');
  });

  it('keeps catalogue CTAs and edit dialogs clear of fixed navigation', () => {
    expect(designSystemCss).toContain('padding-bottom: 72px');
    expect(designSystemCss).toContain('.dialog-backdrop');
    expect(designSystemCss).toContain('z-index: 80');
  });

  it('lets long listing titles wrap inside the detail breadcrumb', () => {
    expect(operationalCss).toContain('.listing-detail__breadcrumbs');
    expect(operationalCss).toContain('flex-wrap: wrap');
    expect(operationalCss).toContain("span[aria-current='page']");
    expect(operationalCss).toContain('overflow-wrap: anywhere');
  });

  it('provides real targets for publication, listings and exchanges', () => {
    for (const id of ['publier', 'mes-articles', 'mes-echanges']) {
      expect(space).toContain(`id="${id}"`);
      expect(header).toContain(`href="/espace#${id}"`);
    }

    // The prototype account sidebar deliberately keeps publication out of its
    // navigation. Publication remains reachable from the shared header/mobile
    // action, while the sidebar exposes the persistent account destinations.
    for (const id of ['mes-articles', 'mes-echanges']) {
      expect(accountShell).toContain(`href="/espace#${id}"`);
    }
    expect(accountShell).not.toContain('href="/espace#publier"');

    expect(space).toContain('workspaceSectionFromHash(window.location.hash)');
    expect(space).toContain('requestAnimationFrame');
    expect(space).toContain('<MarketplaceDashboard />');
    expect(space).toContain('<ListingForm');
  });

  it('links the listing detail to its actual proposal form and exchange catalogue', () => {
    expect(detail).toContain('href="/echanges"');
    expect(detail).toContain('href="#faire-une-demande"');
    expect(detail).toContain('id="faire-une-demande"');
    expect(detail).toContain('<ListingProposalForm listing={listing} />');
    expect(detail).toContain('canRestoreProposalAnchor(');
    expect(detail).toContain('requestAnimationFrame');
    expect(detail).toContain("document.getElementById('faire-une-demande')");
    expect(detail).toContain('href="/espace#publier"');
    expect(exchangePage).toContain('listingsApi.public()');
  });

  it('exposes concrete sections for received, sent and completed exchange steps', () => {
    for (const section of ['echanges-recus', 'echanges-envoyes', 'echanges-remises']) {
      expect(exchanges).toContain(`href="#${section}"`);
      expect(exchanges).toContain(`id="${section}"`);
    }
    expect(exchanges).toContain('marketplaceApi.received');
    expect(exchanges).toContain('marketplaceApi.mine');
    expect(exchanges).toContain('marketplaceApi.transactions');
  });

  it('keeps administrators and moderators on real existing destinations', () => {
    expect(admin).toContain('href="/moderation"');
    expect(admin).toContain('href="/echanges"');
    expect(admin).toContain('href="/espace#mes-echanges"');
    expect(moderation).toContain('id="file-moderation"');
    expect(moderation).toContain("hasAnyRole('MODERATOR', 'ADMIN')");
  });

  it('does not invent unsupported functional pages or bypass role-based menus', () => {
    expect(header).not.toContain('href="/messages"');
    expect(header).not.toContain('href="/favoris"');
    expect(header).toContain("roles.includes('ADMIN')");
    expect(header).toContain("roles.includes('MODERATOR')");
  });
});
