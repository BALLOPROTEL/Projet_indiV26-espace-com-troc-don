'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  conversationsApi,
  listingsApi,
} from '../lib/api';
import type {
  ConversationMessage,
  MarketplaceConversation,
} from '../lib/types';
import { AccountShell } from './account-shell';
import { useAuth } from './auth-provider';

function dateTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(value));
}

function statusLabel(status: MarketplaceConversation['proposal']['status']) {
  switch (status) {
    case 'PENDING':
      return 'En attente';
    case 'ACCEPTED':
      return 'Acceptée';
    case 'REJECTED':
      return 'Refusée';
    case 'CANCELLED':
      return 'Annulée';
  }
}

export function ConversationsPage() {
  const {
    ready,
    authenticated,
    username,
    subject,
    roles,
    hasAnyRole,
    login,
    logout,
    getToken,
  } = useAuth();

  const [conversations, setConversations] = useState<
    MarketplaceConversation[]
  >([]);
  const [listingTitles, setListingTitles] = useState<
    Record<string, string>
  >({});
  const [selectedId, setSelectedId] = useState<string | null>(
    null,
  );
  const [messages, setMessages] = useState<ConversationMessage[]>(
    [],
  );
  const [draft, setDraft] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === selectedId,
      ) ?? null,
    [conversations, selectedId],
  );

  const loadConversations = useCallback(async () => {
    const token = await getToken();
    const items = await conversationsApi.mine(token);
    setConversations(items);

    setSelectedId((current) => {
      if (
        current &&
        items.some((conversation) => conversation.id === current)
      ) {
        return current;
      }

      return items[0]?.id ?? null;
    });

    const ids = [
      ...new Set(
        items.map(
          (conversation) =>
            conversation.proposal.targetListingId,
        ),
      ),
    ];

    const entries = await Promise.all(
      ids.map(async (id) => {
        try {
          const listing = await listingsApi.publicById(id);
          return [id, listing.title] as const;
        } catch {
          return [id, 'Annonce non publique'] as const;
        }
      }),
    );

    setListingTitles(Object.fromEntries(entries));
  }, [getToken]);

  const loadThread = useCallback(
    async (conversationId: string) => {
      setLoadingThread(true);
      setError(null);

      try {
        const token = await getToken();
        const [items] = await Promise.all([
          conversationsApi.messages(
            token,
            conversationId,
          ),
          conversationsApi.markRead(
            token,
            conversationId,
          ),
        ]);

        setMessages([...items].reverse());
      } catch (reason) {
        setMessages([]);
        setError(
          reason instanceof Error
            ? reason.message
            : 'Impossible de charger cette conversation.',
        );
      } finally {
        setLoadingThread(false);
      }
    },
    [getToken],
  );

  useEffect(() => {
    if (!ready || !authenticated) {
      return;
    }

    let active = true;

    void loadConversations()
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Impossible de charger vos conversations.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoadingList(false);
        }
      });

    return () => {
      active = false;
    };
  }, [ready, authenticated, loadConversations]);

  useEffect(() => {
    if (!ready || !authenticated || !selectedId) {
      return;
    }

    void loadThread(selectedId);
  }, [
    ready,
    authenticated,
    selectedId,
    loadThread,
  ]);

  async function sendMessage(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const body = draft.trim();
    if (!selectedId || !body || sending) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      const token = await getToken();
      const created = await conversationsApi.send(
        token,
        selectedId,
        body,
      );

      setMessages((current) => [
        ...current,
        created,
      ]);
      setDraft('');
      await loadConversations();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Impossible d’envoyer ce message.',
      );
    } finally {
      setSending(false);
    }
  }

  if (!ready) {
    return (
      <div className="pm-private-state" aria-busy="true">
        Chargement de vos messages…
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="pm-private-state">
        <h1>Messages & échanges</h1>
        <p>
          Connectez-vous pour accéder à vos conversations privées.
        </p>
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

  return (
    <AccountShell
      username={username}
      active="exchanges"
      canModerate={hasAnyRole('MODERATOR', 'ADMIN')}
      isAdmin={roles.includes('ADMIN')}
      onLogout={() => void logout()}
      heading="Messages & échanges"
      description="Conversations privées liées à vos demandes de don et de troc."
    >
      <div className="pm-conversations">
        <aside
          className="pm-conversations__list"
          aria-label="Mes conversations"
        >
          <div className="pm-conversations__list-head">
            <div>
              <span className="pm-overline">
                CONVERSATIONS
              </span>
              <h2>Mes échanges</h2>
            </div>
            <button
              className="pm-button pm-button--outline"
              type="button"
              disabled={loadingList}
              onClick={() => {
                setLoadingList(true);
                void loadConversations()
                  .catch((reason: unknown) => {
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : 'Impossible d’actualiser.',
                    );
                  })
                  .finally(() => setLoadingList(false));
              }}
            >
              Actualiser
            </button>
          </div>

          {loadingList ? (
            <p role="status">Chargement…</p>
          ) : null}

          {!loadingList && conversations.length === 0 ? (
            <div className="pm-conversations__empty">
              <strong>Aucune conversation</strong>
              <p>
                Une conversation privée est créée automatiquement
                lorsqu’une demande de don ou une proposition de troc
                est envoyée.
              </p>
              <Link
                className="pm-button pm-button--teal"
                href="/echanges"
              >
                Découvrir les annonces
              </Link>
            </div>
          ) : null}

          <div className="pm-conversations__items">
            {conversations.map((conversation) => {
              const latest = conversation.messages[0];
              const listingTitle =
                listingTitles[
                  conversation.proposal.targetListingId
                ] ?? 'Annonce';

              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={
                    conversation.id === selectedId
                      ? 'pm-conversation-preview is-active'
                      : 'pm-conversation-preview'
                  }
                  onClick={() =>
                    setSelectedId(conversation.id)
                  }
                >
                  <span className="pm-conversation-preview__mark">
                    {conversation.proposal.type ===
                    'DONATION_REQUEST'
                      ? 'D'
                      : 'T'}
                  </span>
                  <span>
                    <strong>{listingTitle}</strong>
                    <small>
                      {statusLabel(
                        conversation.proposal.status,
                      )}
                      {' · '}
                      {latest
                        ? latest.body
                        : 'Aucun message'}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section
          className="pm-conversations__thread"
          aria-live="polite"
        >
          {error ? (
            <p
              className="notice notice--error"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {!selected ? (
            <div className="pm-conversations__empty">
              <strong>Sélectionnez une conversation</strong>
              <p>
                Vos messages privés apparaîtront ici.
              </p>
            </div>
          ) : (
            <>
              <header className="pm-conversations__thread-head">
                <div>
                  <span className="pm-overline">
                    {selected.proposal.type ===
                    'DONATION_REQUEST'
                      ? 'DEMANDE DE DON'
                      : 'PROPOSITION DE TROC'}
                  </span>
                  <h2>
                    {listingTitles[
                      selected.proposal.targetListingId
                    ] ?? 'Annonce'}
                  </h2>
                  <p>
                    {subject === selected.ownerId
                      ? 'Conversation avec le membre demandeur.'
                      : 'Conversation avec le propriétaire de l’annonce.'}
                    {' '}
                    Statut :{' '}
                    <strong>
                      {statusLabel(
                        selected.proposal.status,
                      )}
                    </strong>
                  </p>
                </div>
                <Link
                  className="pm-button pm-button--outline"
                  href={`/annonces/${encodeURIComponent(
                    selected.proposal.targetListingId,
                  )}`}
                >
                  Voir l’annonce
                </Link>
              </header>

              <div className="pm-conversations__messages">
                {loadingThread ? (
                  <p role="status">
                    Chargement des messages…
                  </p>
                ) : messages.length === 0 ? (
                  <p className="quiet-note">
                    Aucun message dans cette conversation.
                  </p>
                ) : (
                  messages.map((message) => {
                    const mine =
                      message.senderId === subject;

                    return (
                      <article
                        key={message.id}
                        className={
                          mine
                            ? 'pm-message is-mine'
                            : 'pm-message'
                        }
                      >
                        <div>
                          <strong>
                            {mine ? 'Vous' : 'Membre'}
                          </strong>
                          <time
                            dateTime={message.createdAt}
                          >
                            {dateTime(
                              message.createdAt,
                            )}
                          </time>
                        </div>
                        <p>{message.body}</p>
                      </article>
                    );
                  })
                )}
              </div>

              <form
                className="pm-conversations__composer"
                onSubmit={sendMessage}
              >
                <label htmlFor="conversation-message">
                  Votre message
                </label>
                <textarea
                  id="conversation-message"
                  rows={3}
                  maxLength={1000}
                  value={draft}
                  placeholder="Écrivez votre message…"
                  onChange={(event) =>
                    setDraft(event.target.value)
                  }
                />
                <div>
                  <small>
                    {draft.length}/1000
                  </small>
                  <button
                    className="pm-button pm-button--teal"
                    type="submit"
                    disabled={
                      sending || draft.trim().length === 0
                    }
                  >
                    {sending
                      ? 'Envoi…'
                      : 'Envoyer le message'}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </AccountShell>
  );
}
