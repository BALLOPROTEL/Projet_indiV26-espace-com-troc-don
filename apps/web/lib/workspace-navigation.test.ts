import { describe, expect, it } from 'vitest';
import { workspaceSectionFromHash } from './workspace-navigation';

describe('workspace section after asynchronous Keycloak login', () => {
  it.each(['publier', 'mes-articles', 'mes-echanges'] as const)(
    'restores the trusted %s destination',
    (id) => { expect(workspaceSectionFromHash('#' + id)).toBe(id); },
  );

  it('accepts percent-encoded fragment and rejects unrelated or invalid values', () => {
    expect(workspaceSectionFromHash('#mes-%65changes')).toBe('mes-echanges');
    expect(workspaceSectionFromHash('#')).toBeNull();
    expect(workspaceSectionFromHash('mes-articles')).toBeNull();
    expect(workspaceSectionFromHash('#%')).toBeNull();
    expect(workspaceSectionFromHash('#../../admin')).toBeNull();
    expect(workspaceSectionFromHash('#mes-echanges%0A')).toBeNull();
  });
});
