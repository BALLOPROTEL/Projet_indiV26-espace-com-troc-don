/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { listingsApi, marketplaceApi } from '../lib/api';
import { listingAssetUrl } from '../lib/api';
import type { Listing } from '../lib/types';
import { useAuth } from './auth-provider';

/** Public listing interaction. Authentication and ownership are rechecked server-side. */
export function ListingProposalForm({ listing }: { listing: Listing }) {
  const { ready, authenticated, login, getToken, subject } = useAuth();
  const [available, setAvailable] = useState<Listing[]>([]);
  const [offeredId, setOfferedId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated || listing.operationType !== 'TRADE') return;
    let active = true;
    void getToken()
      .then(listingsApi.mine)
      .then((items) => {
        if (active) {
          setAvailable(items.filter((item) =>
            item.operationType === 'TRADE' &&
            item.status === 'APPROVED' &&
            item.availabilityStatus === 'AVAILABLE' &&
            item.id !== listing.id,
          ));
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Impossible de charger vos objets.');
      });
    return () => { active = false; };
  }, [authenticated, getToken, listing.id, listing.operationType]);

  if (!ready) return null;

  if (listing.availabilityStatus !== 'AVAILABLE') {
    return <p className="notice">Cet objet est déjà réservé ou attribué.</p>;
  }

  if (!authenticated) {
    return (
      <section className="marketplace-action">
        <h2>Cette trouvaille vous intéresse ?</h2>
        <p>Connectez-vous pour faire une demande de don ou proposer un troc.</p>
        <button type="button" className="button" onClick={() => void login()}>
          Se connecter
        </button>
      </section>
    );
  }

  if (subject === listing.ownerId) {
    return <p className="notice">C’est votre annonce. Retrouvez les demandes reçues dans <Link href="/espace">votre espace</Link>.</p>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setFeedback(null);
    if (listing.operationType === 'TRADE' && !offeredId) {
      setError('Sélectionnez un de vos objets disponibles pour cet échange.');
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      await marketplaceApi.create(token, {
        targetListingId: listing.id,
        type: listing.operationType === 'DONATION' ? 'DONATION_REQUEST' : 'TRADE_OFFER',
        ...(listing.operationType === 'TRADE' ? { offeredListingId: offeredId } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      setFeedback('Proposition envoyée. Vous pouvez suivre sa progression dans votre espace.');
      setOfferedId('');
      setMessage('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’envoyer votre proposition.');
    } finally {
      setBusy(false);
    }
  }

  const selected = available.find((item) => item.id === offeredId);

  return (
    <section className="marketplace-action" aria-label="Faire une proposition">
      <span className="eyebrow">Échange entre membres</span>
      <h2>{listing.operationType === 'DONATION' ? 'Demander ce don' : 'Proposer un troc'}</h2>
      <form className="listing-form" onSubmit={(event) => void submit(event)}>
        {listing.operationType === 'TRADE' ? (
          <label className="field">
            <span>Votre objet proposé en échange</span>
            <select value={offeredId} onChange={(event) => setOfferedId(event.target.value)} required>
              <option value="">Sélectionnez une annonce approuvée et disponible</option>
              {available.map((item) => (
                <option value={item.id} key={item.id}>{item.title}</option>
              ))}
            </select>
            {available.length === 0 ? (
              <small>Vous n’avez pas encore d’objet échangeable. <Link href="/espace">Déposer un objet</Link>.</small>
            ) : null}
          </label>
        ) : null}
        {selected ? (
          <div className="marketplace-compare">
            <div><strong>Objet demandé</strong><p>{listing.title}</p>
              {listing.images[0] ? <img src={listingAssetUrl(listing.images[0].contentUrl)} alt={listing.title} /> : null}
            </div>
            <div><strong>Votre contrepartie</strong><p>{selected.title}</p>
              {selected.images[0] ? <img src={listingAssetUrl(selected.images[0].contentUrl)} alt={selected.title} /> : null}
            </div>
          </div>
        ) : null}
        <label className="field">
          <span>Message au propriétaire (facultatif)</span>
          <textarea value={message} maxLength={1000} rows={3}
            onChange={(event) => setMessage(event.target.value)} />
        </label>
        {error ? <p role="alert" className="notice notice--error">{error}</p> : null}
        {feedback ? <p role="status" className="notice notice--success">{feedback}</p> : null}
        <button type="submit" className="button" disabled={busy || (listing.operationType === 'TRADE' && !offeredId)}>
          {busy ? 'Envoi en cours…' : listing.operationType === 'DONATION' ? 'Envoyer ma demande' : 'Envoyer ma proposition de troc'}
        </button>
      </form>
    </section>
  );
}
