// Only trusted in-page sections are eligible for post-login hash navigation.
export type WorkspaceSectionId = 'publier' | 'mes-articles' | 'mes-echanges';
const sections = new Set<WorkspaceSectionId>(['publier', 'mes-articles', 'mes-echanges']);

export function workspaceSectionFromHash(hash: string): WorkspaceSectionId | null {
  if (!hash.startsWith('#')) return null;
  try {
    const decoded = decodeURIComponent(hash.slice(1));
    return sections.has(decoded as WorkspaceSectionId)
      ? decoded as WorkspaceSectionId
      : null;
  } catch {
    return null;
  }
}
