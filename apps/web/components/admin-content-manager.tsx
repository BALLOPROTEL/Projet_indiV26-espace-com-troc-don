'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminContentApi } from '../lib/api';
import type {
  AdminContactMessage,
  AdminFanzineInput,
  AdminFestivalInput,
  Fanzine,
  FestivalEntry,
} from '../lib/types';
import { AccountShell } from './account-shell';
import { useAuth } from './auth-provider';

const emptyFanzine: AdminFanzineInput = {
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  issueLabel: '',
};

const emptyFestival: AdminFestivalInput = {
  slug: '',
  title: '',
  summary: '',
  body: '',
  location: '',
  startsAt: '',
  endsAt: '',
};

export function AdminContentManager() {
  const {
    ready,
    authenticated,
    username,
    roles,
    getToken,
    login,
    logout,
  } = useAuth();
  const isAdmin = roles.includes('ADMIN');

  const [fanzines, setFanzines] = useState<Fanzine[]>([]);
  const [festival, setFestival] = useState<FestivalEntry[]>([]);
  const [contacts, setContacts] = useState<AdminContactMessage[]>([]);
  const [fanzineForm, setFanzineForm] = useState(emptyFanzine);
  const [festivalForm, setFestivalForm] = useState(emptyFestival);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!authenticated || !isAdmin) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const [nextFanzines, nextFestival, nextContacts] = await Promise.all([
        adminContentApi.fanzines(token),
        adminContentApi.festival(token),
        adminContentApi.contacts(token),
      ]);
      setFanzines(nextFanzines);
      setFestival(nextFestival);
      setContacts(nextContacts);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Impossible de charger la gestion éditoriale.',
      );
    } finally {
      setLoading(false);
    }
  }, [authenticated, isAdmin, getToken]);

  useEffect(() => {
    if (ready && authenticated && isAdmin) {
      void refresh();
    }
  }, [ready, authenticated, isAdmin, refresh]);

  async function execute(key: string, action: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'L’action administrative a échoué.',
      );
    } finally {
      setBusy(null);
    }
  }

  if (!ready) {
    return <div className="pm-private-state" aria-busy="true">Vérification des droits…</div>;
  }

  if (!authenticated) {
    return (
      <div className="pm-private-state">
        <h1>Administration éditoriale</h1>
        <p>Connectez-vous avec un compte ADMIN.</p>
        <button
          className="pm-button pm-button--navy"
          type="button"
          onClick={() => void login()}
        >
          Se connecter
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="pm-private-state" role="alert">
        <h1>Accès refusé</h1>
        <p>Cette page est réservée aux administrateurs.</p>
      </div>
    );
  }

  return (
    <AccountShell
      username={username}
      active="admin"
      canModerate
      isAdmin
      onLogout={() => void logout()}
      heading="Contenus & demandes"
      description="Fanzines, festival, actualités et inbox Contact/Privacy."
    >
      <div className="pm-admin-content">
        <div className="pm-admin-content__toolbar">
          <div>
            <span className="pm-overline">BACKEND ÉDITORIAL RÉEL</span>
            <h2>Contenus & demandes</h2>
          </div>
          <button
            className="pm-button pm-button--outline"
            type="button"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>

        {error ? <p className="notice notice--error" role="alert">{error}</p> : null}
        {notice ? <p className="notice notice--success" role="status">{notice}</p> : null}

        <section className="pm-admin-content__panel" aria-labelledby="admin-fanzines-title">
          <h3 id="admin-fanzines-title">Fanzines</h3>
          <div className="pm-admin-content__form">
            <input
              aria-label="Slug fanzine"
              placeholder="slug-du-numero"
              value={fanzineForm.slug}
              onChange={(event) =>
                setFanzineForm((current) => ({ ...current, slug: event.target.value }))
              }
            />
            <input
              aria-label="Titre fanzine"
              placeholder="Titre"
              value={fanzineForm.title}
              onChange={(event) =>
                setFanzineForm((current) => ({ ...current, title: event.target.value }))
              }
            />
            <input
              aria-label="Numéro ou édition"
              placeholder="N° / édition (optionnel)"
              value={fanzineForm.issueLabel ?? ''}
              onChange={(event) =>
                setFanzineForm((current) => ({ ...current, issueLabel: event.target.value }))
              }
            />
            <textarea
              aria-label="Résumé fanzine"
              placeholder="Résumé"
              rows={3}
              value={fanzineForm.excerpt}
              onChange={(event) =>
                setFanzineForm((current) => ({ ...current, excerpt: event.target.value }))
              }
            />
            <textarea
              aria-label="Contenu fanzine"
              placeholder="Contenu complet"
              rows={7}
              value={fanzineForm.body}
              onChange={(event) =>
                setFanzineForm((current) => ({ ...current, body: event.target.value }))
              }
            />
            <button
              className="pm-button pm-button--navy"
              type="button"
              disabled={
                Boolean(busy) ||
                fanzineForm.slug.trim().length < 3 ||
                fanzineForm.title.trim().length < 3 ||
                fanzineForm.excerpt.trim().length < 10 ||
                fanzineForm.body.trim().length < 20
              }
              onClick={() =>
                void execute(
                  'create-fanzine',
                  async () => {
                    const token = await getToken();
                    await adminContentApi.createFanzine(token, {
                      ...fanzineForm,
                      issueLabel: fanzineForm.issueLabel?.trim() || undefined,
                    });
                    setFanzineForm(emptyFanzine);
                  },
                  'Fanzine créé en brouillon.',
                )
              }
            >
              Créer le brouillon
            </button>
          </div>

          <div className="pm-admin-content__list">
            {fanzines.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.status} · /{item.slug}</small>
                </div>
                <div>
                  {item.status === 'DRAFT' ? (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void execute(
                          'publish-fanzine-' + item.id,
                          async () => adminContentApi.publishFanzine(await getToken(), item.id),
                          'Fanzine publié.',
                        )
                      }
                    >
                      Publier
                    </button>
                  ) : null}
                  {item.status !== 'ARCHIVED' ? (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void execute(
                          'archive-fanzine-' + item.id,
                          async () => adminContentApi.archiveFanzine(await getToken(), item.id),
                          'Fanzine archivé.',
                        )
                      }
                    >
                      Archiver
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {!loading && fanzines.length === 0 ? <p>Aucun fanzine.</p> : null}
          </div>
        </section>

        <section className="pm-admin-content__panel" aria-labelledby="admin-festival-title">
          <h3 id="admin-festival-title">Festival & actualités</h3>
          <div className="pm-admin-content__form">
            <input
              aria-label="Slug publication festival"
              placeholder="slug-publication"
              value={festivalForm.slug}
              onChange={(event) =>
                setFestivalForm((current) => ({ ...current, slug: event.target.value }))
              }
            />
            <input
              aria-label="Titre publication festival"
              placeholder="Titre"
              value={festivalForm.title}
              onChange={(event) =>
                setFestivalForm((current) => ({ ...current, title: event.target.value }))
              }
            />
            <input
              aria-label="Lieu festival"
              placeholder="Lieu (optionnel)"
              value={festivalForm.location ?? ''}
              onChange={(event) =>
                setFestivalForm((current) => ({ ...current, location: event.target.value }))
              }
            />
            <input
              aria-label="Début festival"
              type="datetime-local"
              value={festivalForm.startsAt ?? ''}
              onChange={(event) =>
                setFestivalForm((current) => ({ ...current, startsAt: event.target.value }))
              }
            />
            <input
              aria-label="Fin festival"
              type="datetime-local"
              value={festivalForm.endsAt ?? ''}
              onChange={(event) =>
                setFestivalForm((current) => ({ ...current, endsAt: event.target.value }))
              }
            />
            <textarea
              aria-label="Résumé publication festival"
              placeholder="Résumé"
              rows={3}
              value={festivalForm.summary}
              onChange={(event) =>
                setFestivalForm((current) => ({ ...current, summary: event.target.value }))
              }
            />
            <textarea
              aria-label="Contenu publication festival"
              placeholder="Contenu complet"
              rows={7}
              value={festivalForm.body}
              onChange={(event) =>
                setFestivalForm((current) => ({ ...current, body: event.target.value }))
              }
            />
            <button
              className="pm-button pm-button--navy"
              type="button"
              disabled={
                Boolean(busy) ||
                festivalForm.slug.trim().length < 3 ||
                festivalForm.title.trim().length < 3 ||
                festivalForm.summary.trim().length < 10 ||
                festivalForm.body.trim().length < 20
              }
              onClick={() =>
                void execute(
                  'create-festival',
                  async () => {
                    const token = await getToken();
                    await adminContentApi.createFestival(token, {
                      ...festivalForm,
                      location: festivalForm.location?.trim() || undefined,
                      startsAt: festivalForm.startsAt
                        ? new Date(festivalForm.startsAt).toISOString()
                        : undefined,
                      endsAt: festivalForm.endsAt
                        ? new Date(festivalForm.endsAt).toISOString()
                        : undefined,
                    });
                    setFestivalForm(emptyFestival);
                  },
                  'Publication créée en brouillon.',
                )
              }
            >
              Créer le brouillon
            </button>
          </div>

          <div className="pm-admin-content__list">
            {festival.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.status} · /{item.slug}</small>
                </div>
                <div>
                  {item.status === 'DRAFT' ? (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void execute(
                          'publish-festival-' + item.id,
                          async () => adminContentApi.publishFestival(await getToken(), item.id),
                          'Publication Festival publiée.',
                        )
                      }
                    >
                      Publier
                    </button>
                  ) : null}
                  {item.status !== 'ARCHIVED' ? (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void execute(
                          'archive-festival-' + item.id,
                          async () => adminContentApi.archiveFestival(await getToken(), item.id),
                          'Publication Festival archivée.',
                        )
                      }
                    >
                      Archiver
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {!loading && festival.length === 0 ? <p>Aucune publication Festival.</p> : null}
          </div>
        </section>

        <section className="pm-admin-content__panel" aria-labelledby="admin-contact-title">
          <h3 id="admin-contact-title">Inbox Contact & Privacy</h3>
          <div className="pm-admin-contact-list">
            {contacts.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>
                    {item.subject}
                    {item.privacyAction ? ' · ' + item.privacyAction : ''}
                  </strong>
                  <small>
                    {item.name ?? item.userId ?? 'Visiteur'} ·{' '}
                    {new Intl.DateTimeFormat('fr-FR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(item.createdAt))}
                  </small>
                </div>
                <p>{item.message}</p>
                <select
                  aria-label={'Statut de la demande ' + item.id}
                  value={item.status}
                  disabled={Boolean(busy)}
                  onChange={(event) =>
                    void execute(
                      'contact-' + item.id,
                      async () =>
                        adminContentApi.updateContactStatus(
                          await getToken(),
                          item.id,
                          event.target.value as 'NEW' | 'IN_PROGRESS' | 'CLOSED',
                        ),
                      'Statut de la demande mis à jour.',
                    )
                  }
                >
                  <option value="NEW">NEW</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </article>
            ))}
            {!loading && contacts.length === 0 ? <p>Aucune demande reçue.</p> : null}
          </div>
        </section>
      </div>
    </AccountShell>
  );
}
