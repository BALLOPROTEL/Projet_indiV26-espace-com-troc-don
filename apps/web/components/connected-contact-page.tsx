'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { contactApi } from '../lib/api';
import type {
  ContactReceipt,
  ContactSubject,
  PrivacyAction,
} from '../lib/types';
import { useAuth } from './auth-provider';

const subjectLabels: Record<ContactSubject, string> = {
  SHOP: 'Une question sur la boutique',
  ACCOUNT: 'Une question sur mon compte',
  FESTIVAL: 'Festival & actualités',
  FANZINE: 'Fanzines',
  OTHER: 'Autre demande',
};

const privacyLabels: Record<PrivacyAction, string> = {
  ACCESS: 'Accéder à mes données',
  EXPORT: 'Obtenir un export',
  RECTIFY: 'Rectifier mes données',
  ANONYMIZE: 'Anonymiser mes données applicatives',
  ERASE: 'Demander l’effacement de mes données',
};

export function ConnectedContactPage({
  initialPrivacyAction = null,
}: {
  initialPrivacyAction?: PrivacyAction | null;
}) {
  const {
    ready,
    authenticated,
    firstName,
    lastName,
    email: accountEmail,
    getToken,
    login,
  } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState<ContactSubject>('SHOP');
  const [privacyAction, setPrivacyAction] =
    useState<PrivacyAction | null>(initialPrivacyAction);
  const [message, setMessage] = useState('');
  const [receipt, setReceipt] = useState<ContactReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const identity = [firstName, lastName].filter(Boolean).join(' ');
    if (identity && !name) setName(identity);
    if (accountEmail && !email) setEmail(accountEmail);
  }, [firstName, lastName, accountEmail, name, email]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setReceipt(null);

    try {
      const result = privacyAction
        ? await contactApi.privacy(
            await getToken(),
            {
              action: privacyAction,
              message,
            },
          )
        : await contactApi.send({
            name,
            email,
            subject,
            message,
          });

      setReceipt(result);
      setMessage('');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Impossible d’envoyer votre demande.',
      );
    } finally {
      setBusy(false);
    }
  }

  const privacyMode = privacyAction !== null;

  return (
    <div className="pm-prototype-page">
      <nav className="pm-breadcrumbs" aria-label="Fil d’Ariane">
        <Link href="/">Accueil</Link>
        <span aria-hidden="true">›</span>
        <strong>Contact</strong>
      </nav>

      <header className="pm-prototype-title">
        <h1>Nous contacter</h1>
        <p>
          Support, fanzines, festival ou exercice de vos droits : la demande est
          désormais transmise au backend.
        </p>
      </header>

      <div className="pm-contact-layout">
        <section className="pm-contact-form" aria-labelledby="contact-title">
          <h2 id="contact-title">
            {privacyMode ? 'Exercer un droit sur mes données' : 'Envoyer un message'}
          </h2>

          {privacyMode ? (
            <>
              <label>
                <span>Type de demande</span>
                <select
                  value={privacyAction}
                  onChange={(event) =>
                    setPrivacyAction(event.target.value as PrivacyAction)
                  }
                >
                  {Object.entries(privacyLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              {!ready ? (
                <p role="status">Vérification de votre session…</p>
              ) : !authenticated ? (
                <div className="pm-info-notice">
                  <p>
                    Une demande liée à vos données doit être rattachée à votre
                    compte authentifié.
                  </p>
                  <button
                    className="pm-button pm-button--navy"
                    type="button"
                    onClick={() => void login()}
                  >
                    Se connecter
                  </button>
                </div>
              ) : (
                <p className="pm-settings-hint">
                  La demande sera liée à votre identifiant Keycloak, sans
                  demander de pièce d’identité supplémentaire dans le formulaire.
                </p>
              )}
            </>
          ) : (
            <>
              <label>
                <span>Votre nom</span>
                <input
                  type="text"
                  value={name}
                  maxLength={120}
                  autoComplete="name"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                <span>Votre e-mail</span>
                <input
                  type="email"
                  value={email}
                  maxLength={254}
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                <span>Sujet</span>
                <select
                  value={subject}
                  onChange={(event) =>
                    setSubject(event.target.value as ContactSubject)
                  }
                >
                  {Object.entries(subjectLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label>
            <span>Votre message</span>
            <textarea
              rows={6}
              value={message}
              maxLength={4000}
              placeholder={
                privacyMode
                  ? 'Précisez votre demande et les éléments utiles…'
                  : 'Écrivez votre message…'
              }
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>

          <button
            className="pm-button pm-button--teal"
            type="button"
            disabled={
              busy ||
              message.trim().length < 10 ||
              (privacyMode && !authenticated) ||
              (!privacyMode &&
                (name.trim().length < 2 || !email.includes('@')))
            }
            onClick={() => void submit()}
          >
            {busy ? 'Envoi…' : 'Envoyer la demande'}
          </button>

          {error ? (
            <p className="notice notice--error" role="alert">{error}</p>
          ) : null}

          {receipt ? (
            <div className="notice notice--success" role="status">
              <strong>Demande enregistrée.</strong>
              <span>
                Référence {receipt.id.slice(0, 12)} · statut {receipt.status}
              </span>
            </div>
          ) : null}
        </section>

        <aside className="pm-contact-aside">
          <h2>Service client & confidentialité</h2>
          <p>
            Chaque demande est enregistrée avec un statut de suivi. Les demandes
            Privacy authentifiées sont séparées des messages de support
            ordinaires.
          </p>

          {!privacyMode ? (
            <button
              className="pm-button pm-button--outline"
              type="button"
              onClick={() => setPrivacyAction('ACCESS')}
            >
              Exercer un droit sur mes données
            </button>
          ) : (
            <button
              className="pm-button pm-button--outline"
              type="button"
              onClick={() => setPrivacyAction(null)}
            >
              Revenir au contact général
            </button>
          )}

          <Link className="pm-button pm-button--outline" href="/faq">
            Voir la FAQ →
          </Link>
        </aside>
      </div>
    </div>
  );
}
