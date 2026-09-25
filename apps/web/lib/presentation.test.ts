import { describe, expect, it } from 'vitest';
import {
  canEditListing,
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

  it('prevents editing an approved listing', () => {
    expect(canEditListing('APPROVED')).toBe(false);
    expect(canEditListing('PENDING')).toBe(true);
    expect(canEditListing('REJECTED')).toBe(true);
  });
});
