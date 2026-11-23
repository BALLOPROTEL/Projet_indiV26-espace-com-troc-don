'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  cartApi,
  conversationsApi,
  favoritesApi,
  listingsApi,
  marketplaceApi,
  notificationsApi,
  ordersApi,
} from '../lib/api';
import { useAuth } from './auth-provider';

type ExportState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; generatedAt: string }
  | { status: 'error'; message: string };

export function PrivacyRightsPanel() {
  const {
    username,
    firstName,
    lastName,
    email,
    emailVerified,
    subject,
    roles,
    getToken,
    deleteAccount,
  } = useAuth();
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function exportMyData() {
    if (exportState.status === 'loading') return;

    setExportState({ status: 'loading' });

    try {
      const token = await getToken();
      const [
        listings,
        favorites,
        proposalsSent,
        proposalsReceived,
        transactions,
        notifications,
        orders,
        cart,
        conversations,
      ] = await Promise.all([
        listingsApi.mine(token),
        favoritesApi.mine(token),
        marketplaceApi.mine(token),
        marketplaceApi.received(token),
        marketplaceApi.transactions(token),
        notificationsApi.mine(token),
        ordersApi.mine(token),
        cartApi.mine(token),
        conversationsApi.mine(token),
      ]);

      const conversationThreads = await Promise.all(
        conversations.map(async (conversation) => ({
          ...conversation,
          messages: await conversationsApi.messages(
            token,
            conversation.id,
          ),
        })),
      );

      const generatedAt = new Date().toISOString();
      const payload = {
        schema: 'petite-maison-account-export/v1',
        generatedAt,
        identity: {
          subject,
          username,
          firstName,
          lastName,
          email,
          emailVerified,
          roles,
        },
        catalog: {
          listings,
          favorites,
        },
        marketplace: {
          proposalsSent,
          proposalsReceived,
          transactions,
          conversations: conversationThreads,
        },
        notifications,
        commerce: {
          cart,
          orders,
        },
        notes: [
          'Les mots de passe ne sont jamais inclus dans cet export.',
          'Les données de carte bancaire ne sont pas stockées par cette application.',
          'Certaines données techniques ou de sécurité peuvent relever de règles de conservation distinctes.',
        ],
      };

      const blob = new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: 'application/json;charset=utf-8' },
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download =
        'petite-maison-mes-donnees-' +
        generatedAt.slice(0, 10) +
        '.json';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setExportState({ status: 'success', generatedAt });
    } catch (reason) {
      setExportState({
        status: 'error',
        message:
          reason instanceof Error
            ? reason.message
            : 'Impossible de préparer votre export.',
      });
    }
  }

  async function startDeleteAccount() {
    setDeleteError(null);

    try {
      await deleteAccount();
    } catch (reason) {
      setDeleteError(
        reason instanceof Error
          ? reason.message
          : 'Impossible d’ouvrir la suppression sécurisée du compte.',
      );
    }
  }

  return (
    <section className="pm-privacy-rights" aria-labelledby="privacy-rights-title">
      <div>
        <span className="pm-overline">MES DONNÉES</span>
        <h3 id="privacy-rights-title">Confidentialité & droits du compte</h3>
        <p>
          Exportez les données accessibles de votre compte dans un format JSON
          structuré, ou gérez la suppression de votre identité via Keycloak.
        </p>
      </div>

      <div className="pm-privacy-rights__actions">
        <button
          className="pm-button pm-button--navy"
          type="button"
          disabled={exportState.status === 'loading'}
          onClick={() => void exportMyData()}
        >
          {exportState.status === 'loading'
            ? 'Préparation de l’export…'
            : 'Exporter mes données'}
        </button>

        <Link
          className="pm-button pm-button--outline"
          href="/contact?subject=privacy&request=anonymize"
        >
          Demander l’anonymisation
        </Link>

        {!confirmDelete ? (
          <button
            className="pm-button pm-button--danger"
            type="button"
            onClick={() => setConfirmDelete(true)}
          >
            Supprimer mon identité
          </button>
        ) : null}
      </div>

      {exportState.status === 'success' ? (
        <p className="notice notice--success" role="status">
          Export généré le{' '}
          {new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(exportState.generatedAt))}
          .
        </p>
      ) : null}

      {exportState.status === 'error' ? (
        <p className="notice notice--error" role="alert">
          {exportState.message}
        </p>
      ) : null}

      {confirmDelete ? (
        <div className="pm-privacy-rights__danger" role="alert">
          <strong>Suppression irréversible de l’identité Keycloak</strong>
          <p>
            Cette action supprime le compte d’authentification si la capacité
            de suppression est activée pour votre utilisateur. Les données
            applicatives qui doivent être conservées ou anonymisées suivent un
            traitement séparé : utilisez d’abord la demande d’anonymisation si
            vous souhaitez fermer complètement votre présence sur la
            plateforme.
          </p>
          <div>
            <button
              className="pm-button pm-button--danger"
              type="button"
              onClick={() => void startDeleteAccount()}
            >
              Continuer vers Keycloak
            </button>
            <button
              className="pm-button pm-button--outline"
              type="button"
              onClick={() => setConfirmDelete(false)}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      {deleteError ? (
        <p className="notice notice--error" role="alert">{deleteError}</p>
      ) : null}

      <p className="pm-settings-hint">
        En savoir plus : <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>
    </section>
  );
}
