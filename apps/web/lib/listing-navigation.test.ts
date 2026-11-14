import { describe, expect, it } from 'vitest';
import { canRestoreProposalAnchor } from './listing-navigation';

describe('return to the real proposal form after Keycloak', () => {
  it('defers the request fragment until the product API finishes loading', () => {
    expect(canRestoreProposalAnchor('#faire-une-demande', false)).toBe(false);
    expect(canRestoreProposalAnchor('#faire-une-demande', true)).toBe(true);
  });

  it('does not navigate on unrelated or malformed fragments', () => {
    for (const hash of ['', '#', '#annonces', '#../../admin', '#faire-une-demande%0A']) {
      expect(canRestoreProposalAnchor(hash, true)).toBe(false);
    }
  });
});
