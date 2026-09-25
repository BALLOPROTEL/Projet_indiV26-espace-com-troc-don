'use client';

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { listingsApi } from '../lib/api';
import { canEditListing } from '../lib/presentation';
import type {
  Listing,
  ListingInput,
  ListingOperationType,
} from '../lib/types';
import { useAuth } from './auth-provider';
import { EmptyState } from './empty-state';
import { ListingCard } from './listing-card';

const blankForm: ListingInput = {
  title: '',
  description: '',
  operationType: 'TRADE',
};

export function PersonalSpace() {
  const {
    ready,
    authenticated,
    username,
    login,
    getToken,
  } = useAuth();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ListingInput>(blankForm);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [editForm, setEditForm] =
    useState<ListingInput>(blankForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadMine = useCallback(async () => {
    if (!authenticated) {
      return;
    }

    setLoading(true);

    try {
      const token = await getToken();
      const data = await listingsApi.mine(token);
      setListings(data);
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Impossible de charger vos annonces.',
      );
    } finally {
      setLoading(false);
    }
  }, [authenticated, getToken]);

  useEffect(() => {
    if (ready && authenticated) {
      void loadMine();
    }
  }, [ready, authenticated, loadMine]);

  async function createListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);

    try {
      const token = await getToken();
      await listingsApi.create(token, {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
      });
      setForm(blankForm);
      setFeedback(
        'Annonce déposée. Elle attend maintenant la relecture de la réserve.',
      );
      await loadMine();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Impossible de déposer cette annonce.',
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditing(listing: Listing) {
    setEditing(listing);
    setEditForm({
      title: listing.title,
      description: listing.description,
      operationType: listing.operationType,
    });
    setFeedback(null);
    setError(null);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editing) {
      return;
    }

    setSaving(true);
    setFeedback(null);
    setError(null);

    try {
      const token = await getToken();
      await listingsApi.update(token, editing.id, {
        ...editForm,
        title: editForm.title.trim(),
        description: editForm.description.trim(),
      });
      setEditing(null);
      setFeedback(
        'Modification enregistrée. L’annonce repasse en relecture.',
      );
      await loadMine();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Impossible de modifier cette annonce.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return <PageLoading label="Ouverture de votre étagère…" />;
  }

  if (!authenticated) {
    return (
      <section className="gate-card">
        <span className="eyebrow">Espace membre</span>
        <h1>Votre étagère vous attend.</h1>
        <p>
          Connectez-vous pour déposer un objet, suivre sa relecture
          et corriger une annonce refusée.
        </p>
        <button
          className="button"
          type="button"
          onClick={() => void login()}
        >
          Se connecter
        </button>
      </section>
    );
  }

  return (
    <div className="workspace">
      <section className="workspace-intro">
        <div>
          <span className="eyebrow">Mon étagère</span>
          <h1>Bonjour {username ?? 'vous'}.</h1>
        </div>
        <p>
          Déposez peu, décrivez bien. La réserve relit chaque
          proposition avant publication dans le cabinet.
        </p>
      </section>

      <div className="workspace-grid">
        <section className="form-panel">
          <span className="form-panel__index">01</span>
          <div className="form-panel__heading">
            <span className="eyebrow">Nouvelle fiche</span>
            <h2>Proposer un objet</h2>
            <p>
              Quelques lignes précises valent mieux qu’un long
              catalogue.
            </p>
          </div>

          <ListingForm
            value={form}
            submitLabel={saving ? 'Dépôt en cours…' : 'Déposer pour relecture'}
            disabled={saving}
            onChange={setForm}
            onSubmit={createListing}
          />
        </section>

        <section className="shelf-panel">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">Suivi</span>
              <h2>Mes annonces</h2>
            </div>
            <span className="counter">
              {listings.length.toString().padStart(2, '0')}
            </span>
          </div>

          <div className="feedback-stack" aria-live="polite">
            {feedback ? (
              <div className="notice notice--success">{feedback}</div>
            ) : null}
            {error ? (
              <div className="notice notice--error">{error}</div>
            ) : null}
          </div>

          {loading ? (
            <PageLoading label="Classement des fiches…" compact />
          ) : null}

          {!loading && listings.length === 0 ? (
            <EmptyState
              eyebrow="Étagère vide"
              title="Aucune fiche à votre nom."
              text="Votre première proposition apparaîtra ici avec son statut de relecture."
            />
          ) : null}

          <div className="personal-list">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                showStatus
                footer={
                  canEditListing(listing.status) ? (
                    <button
                      className="text-button text-button--strong"
                      type="button"
                      onClick={() => startEditing(listing)}
                    >
                      Corriger la fiche
                    </button>
                  ) : (
                    <span className="quiet-note">
                      Cette fiche publiée est verrouillée.
                    </span>
                  )
                }
              />
            ))}
          </div>
        </section>
      </div>

      {editing ? (
        <div className="dialog-backdrop">
          <section
            className="edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-listing-title"
          >
            <button
              className="dialog-close"
              type="button"
              aria-label="Fermer la modification"
              onClick={() => setEditing(null)}
            >
              ×
            </button>
            <span className="eyebrow">Révision</span>
            <h2 id="edit-listing-title">Corriger la fiche</h2>
            <p>
              Une modification remet automatiquement l’annonce en
              relecture.
            </p>

            <ListingForm
              value={editForm}
              submitLabel={
                saving ? 'Enregistrement…' : 'Enregistrer la correction'
              }
              disabled={saving}
              onChange={setEditForm}
              onSubmit={saveEdit}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ListingForm({
  value,
  submitLabel,
  disabled,
  onChange,
  onSubmit,
}: {
  value: ListingInput;
  submitLabel: string;
  disabled: boolean;
  onChange: (value: ListingInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  function changeOperation(operationType: ListingOperationType) {
    onChange({ ...value, operationType });
  }

  return (
    <form className="listing-form" onSubmit={onSubmit}>
      <fieldset className="choice-group">
        <legend>Je souhaite</legend>
        <label
          className={
            value.operationType === 'TRADE'
              ? 'choice-card is-selected'
              : 'choice-card'
          }
        >
          <input
            type="radio"
            name="operationType"
            value="TRADE"
            checked={value.operationType === 'TRADE'}
            onChange={() => changeOperation('TRADE')}
          />
          <strong>Troquer</strong>
          <span>contre un autre objet</span>
        </label>
        <label
          className={
            value.operationType === 'DONATION'
              ? 'choice-card is-selected'
              : 'choice-card'
          }
        >
          <input
            type="radio"
            name="operationType"
            value="DONATION"
            checked={value.operationType === 'DONATION'}
            onChange={() => changeOperation('DONATION')}
          />
          <strong>Donner</strong>
          <span>sans contrepartie</span>
        </label>
      </fieldset>

      <label className="field">
        <span>Titre de la fiche</span>
        <input
          required
          minLength={3}
          maxLength={120}
          value={value.title}
          placeholder="Ex. Lot de romans fantastiques"
          onChange={(event) =>
            onChange({ ...value, title: event.target.value })
          }
        />
        <small>{value.title.length}/120</small>
      </label>

      <label className="field">
        <span>Description</span>
        <textarea
          required
          minLength={10}
          maxLength={2000}
          rows={7}
          value={value.description}
          placeholder="État, particularités, ce que vous proposez ou recherchez…"
          onChange={(event) =>
            onChange({
              ...value,
              description: event.target.value,
            })
          }
        />
        <small>{value.description.length}/2000</small>
      </label>

      <button className="button button--full" type="submit" disabled={disabled}>
        {submitLabel}
      </button>
    </form>
  );
}

function PageLoading({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'page-loading is-compact' : 'page-loading'}>
      <span className="page-loading__mark" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
