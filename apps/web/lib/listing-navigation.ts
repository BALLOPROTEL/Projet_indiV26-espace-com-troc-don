/** Restore a product's request intent after its API-backed detail loads.
 * Never dereference arbitrary URL fragments from a redirected login. */
export function canRestoreProposalAnchor(
  hash: string,
  detailReady: boolean,
): boolean {
  return detailReady && hash === '#faire-une-demande';
}
