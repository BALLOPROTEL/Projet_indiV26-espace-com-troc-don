import { describe, expect, it } from 'vitest';
import {
  canEditListing,
  formatListingDate,
  operationLabel,
  statusLabel,
} from './presentation';

describe('listing presentation helpers', () => {
  it('uses human-readable operation labels', () => {
    expect(operationLabel('DONATION')).toBe('Don');
    expect(operationLabel('TRADE')).toBe('Troc');
  });

  it('uses editorial status labels', () => {
    expect(statusLabel('PENDING')).toBe('À relire');
    expect(statusLabel('APPROVED')).toBe('Publié');
    expect(statusLabel('REJECTED')).toBe('À corriger');
  });

  it('formats dates in one stable France timezone for SSR and hydration', () => {
    expect(formatListingDate('2026-11-20T23:30:00.000Z')).toBe(
      '21 nov. 2026',
    );
  });

  it('prevents editing an approved listing', () => {
    expect(canEditListing('APPROVED')).toBe(false);
    expect(canEditListing('PENDING')).toBe(true);
    expect(canEditListing('REJECTED')).toBe(true);
  });
});
