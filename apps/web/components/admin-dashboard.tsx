'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { adminApi } from '../lib/api';
import { adminCatalogBars, canAccessAdmin } from '../lib/admin-dashboard';
import type { AdminCatalogSummary } from '../lib/types';
import { useAuth } from './auth-provider';

type SummaryState =
  | { status: 'loading' }
  | { status: 'ready'; summary: AdminCatalogSummary }
  | { status: 'error'; message: string };

function Metric({
  title, value, description,
}: { title: string; value: number; description: string }) {
  return (
    <div className="admin-v2__metric">
      <span>{title}</span>
      <strong>{value.toLocaleString('fr-FR')}</strong>
      <small>{description}</small>
    </div>
  );
}

export function AdminDashboard() {
  const { ready, authenticated, roles, username, getToken, login } = useAuth();
  const authorized = canAccessAdmin(authenticated, roles);
  const [result, setResult] = useState<SummaryState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready || !authorized) return;
    let active = true;
    void getToken()
      .then((token) => adminApi.catalogSummary(token))
      .then((summary) => {
        if (active) setResult({ status: 'ready', summary });
      })
      .catch((reason: unknown) => {
        if (active) {
          setResult({
            status: 'error',
            message: reason instanceof Error
              ? reason.message : 'Statistiques indisponibles.',
          });
        }
      });
    return () => { active = false; };
  }, [ready, authorized, attempt, getToken]);

  if (!ready) {
    return (
      <div className="page-loading" role="status">
        <span className="page-loading__mark" aria-hidden="true" />
        <span>Vérification des autorisations administrateur…</span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <section className="gate-card">
        <span className="eyebrow">Administration protégée</span>
        <h1>Connectez-vous pour accéder à la gestion.</h1>
        <p>Ce tableau de bord nécessite une session Keycloak disposant du rôle ADMIN.</p>
        <button className="button" type="button" onClick={() => void login()}>
          Se connecter
        </button>
      </section>
    );
  }

  if (!authorized) {
    return (
      <section className="gate-card gate-card--denied" role="alert">
        <span className="eyebrow">Accès refusé</span>
        <h1>Accès réservé aux administrateurs.</h1>
        <p>Votre compte ne dispose pas du rôle ADMIN. Le rôle MODERATOR autorise uniquement la modération.</p>
        <Link className="button" href="/espace">Revenir à mon espace</Link>
      </section>
    );
  }

  const summary = result.status === 'ready' ? result.summary : null;
  const breakdown = summary ? adminCatalogBars(summary) : [];

  return (
    <section className="admin-v2" aria-labelledby="admin-v2-title">
      <div className="admin-v2__layout">
        <aside className="admin-v2__sidebar" aria-label="Navigation administration">
          <div className="admin-v2__brand">
            <span className="admin-v2__monogram" aria-hidden="true">PM</span>
            <span><strong>Petite Maison</strong><small>Espace de gestion</small></span>
          </div>
          <p className="admin-v2__nav-label">Navigation</p>
          <nav aria-label="Menu administrateur">
            <Link href="/admin" aria-current="page">Vue d’ensemble</Link>
            <Link href="/moderation">Modération des annonces</Link>
            <Link href="/espace">Mon espace</Link>
            <Link href="/">Voir le catalogue</Link>
          </nav>
          <div className="admin-v2__sidebar-note">
            <strong>Accès administrateur</strong>
            <p>Les statistiques proviennent du Catalog Service. Les permissions sont contrôlées côté API.</p>
          </div>
        </aside>

        <div className="admin-v2__body">
          <header className="admin-v2__hero">
            <div>
              <span className="admin-v2__overline">Tableau de bord · Administration</span>
              <h1 id="admin-v2-title">Vue d’ensemble</h1>
              <p>Bonjour{username ? ` ${username}` : ''}, retrouvez l’état réel des annonces de la communauté.</p>
            </div>
            <span className="admin-v2__role">Administrateur</span>
          </header>

          <div className="admin-v2__section-title">
            <div>
              <span className="admin-v2__caption">Activité du catalogue</span>
              <h2>Indicateurs des annonces</h2>
              <p>Données actualisées depuis l’API d’administration sécurisée.</p>
            </div>
            <button
              className="admin-v2__refresh"
              type="button"
              disabled={result.status === 'loading'}
              onClick={() => {
                setResult({ status: 'loading' });
                setAttempt((current) => current + 1);
              }}
            >
              Actualiser
            </button>
          </div>

          {result.status === 'loading' ? (
            <div className="admin-v2__loading" role="status">
              <span className="page-loading__mark" aria-hidden="true" />
              Chargement des statistiques réelles…
            </div>
          ) : null}

          {result.status === 'error' ? (
            <div className="admin-v2__error" role="alert">
              <strong>Les statistiques ne sont pas disponibles.</strong>
              <p>{result.message}</p>
              <p>Vérifiez que le contrat ADMIN F4 est déployé et que votre compte dispose des droits nécessaires.</p>
              <button type="button" onClick={() => {
                setResult({ status: 'loading' });
                setAttempt((current) => current + 1);
              }}>
                Réessayer
              </button>
            </div>
          ) : null}

          {summary ? (
            <>
              <div className="admin-v2__stats">
                <Metric title="Annonces au total" value={summary.total} description="Tous statuts confondus" />
                <Metric title="Publiées" value={summary.byStatus.approved} description="Approuvées par modération" />
                <Metric title="En attente" value={summary.byStatus.pending} description="À examiner dans la file" />
                <Metric title="Rejetées" value={summary.byStatus.rejected} description="Refusées après examen" />
              </div>

              <div className="admin-v2__panels">
                <section className="admin-v2__panel" aria-labelledby="admin-v2-operations">
                  <h3 id="admin-v2-operations">Dons et trocs</h3>
                  <p>Répartition de toutes les annonces, y compris en attente et refusées.</p>
                  {breakdown.map((item) => (
                    <div className="admin-v2__bar-item" key={item.key}>
                      <div className="admin-v2__bar-label">
                        <span>{item.label}</span>
                        <strong>{item.count.toLocaleString('fr-FR')}</strong>
                      </div>
                      <div
                        className="admin-v2__bar-track"
                        role="progressbar"
                        aria-label={item.label}
                        aria-valuenow={item.count}
                        aria-valuemin={0}
                        aria-valuemax={Math.max(1, summary.total)}
                      >
                        <span style={{ width: `${item.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </section>
                <section className="admin-v2__panel" aria-labelledby="admin-v2-available">
                  <h3 id="admin-v2-available">Disponibilité des articles publiés</h3>
                  <p>Uniquement les annonces approuvées.</p>
                  <dl className="admin-v2__availability">
                    <div><dt>Disponibles</dt><dd>{summary.approvedAvailability.available}</dd></div>
                    <div><dt>Réservés</dt><dd>{summary.approvedAvailability.reserved}</dd></div>
                    <div><dt>Terminés</dt><dd>{summary.approvedAvailability.completed}</dd></div>
                  </dl>
                </section>
              </div>
              {summary.total === 0 ? (
                <p className="admin-v2__empty" role="status">Le catalogue ne contient encore aucune annonce.</p>
              ) : null}
            </>
          ) : null}

          <section className="admin-v2__actions" aria-labelledby="admin-v2-next">
            <div>
              <h2 id="admin-v2-next">Gestion des publications</h2>
              <p>Examinez les fiches et leur galerie privée dans l’espace de modération.</p>
            </div>
            <Link href="/moderation" className="admin-v2__action-link">
              Ouvrir la modération <span aria-hidden="true">↗</span>
            </Link>
          </section>
          <p className="admin-v2__footnote">
            Les fonctions de gestion des utilisateurs, de suspension, d’audit global et de signalements
            ne sont pas activées : aucun contrat backend sécurisé ne les fournit encore.
          </p>
        </div>
      </div>
    </section>
  );
}
