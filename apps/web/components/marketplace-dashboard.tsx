/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { listingAssetUrl, listingsApi, marketplaceApi } from '../lib/api';
import type { Listing, MarketplaceProposal, MarketplaceTransaction } from '../lib/types';
import { useAuth } from './auth-provider';

const proposalStatus: Record<MarketplaceProposal['status'], string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
  CANCELLED: 'Annulée',
};

export function MarketplaceDashboard() {
  const { ready, authenticated, getToken, subject } = useAuth();
  const [received, setReceived] = useState<MarketplaceProposal[]>([]);
  const [sent, setSent] = useState<MarketplaceProposal[]>([]);
  const [transactions, setTransactions] = useState<MarketplaceTransaction[]>([]);
  const [listings, setListings] = useState<Record<string, Listing>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = await getToken();
    const [incoming, outgoing, active] = await Promise.all([
      marketplaceApi.received(token),
      marketplaceApi.mine(token),
      marketplaceApi.transactions(token),
    ]);
    setReceived(incoming);
    setSent(outgoing);
    setTransactions(active);
    const ids = new Set<string>();
    for (const proposal of [...incoming, ...outgoing]) {
      ids.add(proposal.targetListingId);
      if (proposal.offeredListingId) ids.add(proposal.offeredListingId);
    }
    for (const transaction of active) {
      ids.add(transaction.targetListingId);
      if (transaction.offeredListingId) ids.add(transaction.offeredListingId);
    }
    const pairs = await Promise.all([...ids].map(async (id) => {
      try {
        const detail = await listingsApi.publicById(id);
        return [id, detail] as const;
      } catch {
        return null; // Historical or no-longer-public listing; never expose a private Catalog record.
      }
    }));
    setListings(Object.fromEntries(pairs.filter((item): item is readonly [string, Listing] => item !== null)));
  }, [getToken]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    let active = true;
    // Schedule the API refresh after the initial effect; avoid synchronous
    // cascading state updates during React's effect execution.
    void getToken()
      .then(() => {
        if (active) return refresh();
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Impossible de charger les échanges.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready, authenticated, refresh]);

  if (!ready || !authenticated) return null;

  async function execute(id: string, action: 'accept' | 'reject' | 'confirm') {
    if (busy) return;
    setBusy(id);
    setError(null);
    setNotice(null);
    try {
      const token = await getToken();
      if (action === 'accept') await marketplaceApi.accept(token, id);
      if (action === 'reject') await marketplaceApi.reject(token, id);
      if (action === 'confirm') await marketplaceApi.confirm(token, id);
      // Once the API mutation succeeds, a transient refresh failure must not
      // present the committed action as a failure (and invite a conflicting retry).
      setNotice(action === 'reject' ? 'Proposition refusée.' : action === 'accept'
        ? 'Proposition acceptée. Les deux participants doivent confirmer la remise.'
        : 'Confirmation enregistrée. La transaction sera clôturée après celle de l’autre participant.');
      try {
        await refresh();
      } catch {
        setError('Opération enregistrée, mais impossible d’actualiser les échanges. Cliquez sur Actualiser.');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Opération impossible.');
    } finally {
      setBusy(null);
    }
  }

  function listingPreview(id: string) {
    const item = listings[id];
    return (
      <div className="marketplace-preview">
        {item?.images[0] ? <img src={listingAssetUrl(item.images[0].contentUrl)} alt={item.title} loading="lazy" /> : null}
        <Link href={`/annonces/${encodeURIComponent(id)}`}>
          {item?.title ?? `Annonce ${id.slice(0, 8)}`}
        </Link>
      </div>
    );
  }

  function proposalCard(proposal: MarketplaceProposal, incoming: boolean) {
    return (
      <article className="marketplace-entry" key={proposal.id}>
        <div className="marketplace-entry__heading">
          <strong>{proposal.type === 'DONATION_REQUEST' ? 'Demande de don' : 'Proposition de troc'}</strong>
          <span className="status">{proposalStatus[proposal.status]}</span>
        </div>
        <div className="marketplace-compare">
          <div><span className="eyebrow">Objet demandé</span>{listingPreview(proposal.targetListingId)}</div>
          {proposal.offeredListingId ? (
            <div><span className="eyebrow">Contrepartie proposée</span>{listingPreview(proposal.offeredListingId)}</div>
          ) : <div><span className="eyebrow">Sans contrepartie</span><p>Don gratuit</p></div>}
        </div>
        {proposal.message ? <p className="quiet-note">Message : {proposal.message}</p> : null}
        {incoming && proposal.status === 'PENDING' ? (
          <div className="marketplace-entry__buttons">
            <button type="button" className="button button--small" disabled={busy !== null}
              onClick={() => void execute(proposal.id, 'accept')}>
              {busy === proposal.id ? 'En cours…' : 'Accepter'}
            </button>
            <button type="button" className="button button--quiet button--small" disabled={busy !== null}
              onClick={() => void execute(proposal.id, 'reject')}>Refuser</button>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <section className="marketplace-dashboard" aria-label="Mes dons et trocs">
      <div className="section-heading section-heading--compact">
        <div><span className="eyebrow">Échanges entre membres</span><h2>Mes dons et trocs</h2></div>
        <button type="button" className="button button--quiet button--small" onClick={() => {
          setLoading(true);
          void refresh().catch((e: unknown) => {
            setError(e instanceof Error ? e.message : 'Erreur de chargement.');
          }).finally(() => setLoading(false));
        }} disabled={loading || busy !== null}>Actualiser</button>
      </div>
      {notice ? <p role="status" className="notice notice--success">{notice}</p> : null}
      {error ? <p role="alert" className="notice notice--error">{error}</p> : null}
      {loading ? <p>Chargement des propositions…</p> : null}
      <div className="marketplace-dashboard__grid">
        <section>
          <h3>Demandes reçues ({received.length})</h3>
          {received.length ? received.map((proposal) => proposalCard(proposal, true)) :
            <p className="quiet-note">Aucune proposition reçue pour vos annonces.</p>}
        </section>
        <section>
          <h3>Mes demandes envoyées ({sent.length})</h3>
          {sent.length ? sent.map((proposal) => proposalCard(proposal, false)) :
            <p className="quiet-note">Vous n’avez pas encore demandé de don ni proposé de troc.</p>}
        </section>
      </div>
      <section className="marketplace-transactions">
        <h3>Remises et échanges ({transactions.length})</h3>
        <div className="marketplace-dashboard__grid">
          {transactions.map((transaction) => {
            const mine = subject === transaction.ownerId ? transaction.ownerConfirmedAt : transaction.requesterConfirmedAt;
            const other = subject === transaction.ownerId ? transaction.requesterConfirmedAt : transaction.ownerConfirmedAt;
            return (
              <article className="marketplace-entry" key={transaction.id}>
                <strong>{transaction.offeredListingId ? 'Échange de deux objets' : 'Remise de don'}</strong>
                <div className="marketplace-compare">
                  {listingPreview(transaction.targetListingId)}
                  {transaction.offeredListingId ? listingPreview(transaction.offeredListingId) : null}
                </div>
                <p>État : <strong>{transaction.status === 'COMPLETED' ? 'Terminé' : transaction.status === 'IN_PROGRESS' ? 'Remise en cours' : 'Annulé'}</strong></p>
                <p className="quiet-note">Votre confirmation : {mine ? 'reçue' : 'en attente'} · Autre participant : {other ? 'confirmé' : 'en attente'}</p>
                {transaction.status === 'IN_PROGRESS' && !mine ? (
                  <button type="button" className="button button--small" disabled={busy !== null}
                    onClick={() => void execute(transaction.id, 'confirm')}>Confirmer la remise</button>
                ) : null}
              </article>
            );
          })}
        </div>
        {!transactions.length ? <p className="quiet-note">Aucune transaction en cours.</p> : null}
      </section>
    </section>
  );
}
