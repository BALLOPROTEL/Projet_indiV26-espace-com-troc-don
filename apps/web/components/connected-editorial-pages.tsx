'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { editorialApi } from '../lib/api';
import type { Fanzine, FestivalEntry } from '../lib/types';

function Breadcrumb({ current }: { current: string }) {
  return (
    <nav className="pm-breadcrumbs" aria-label="Fil d’Ariane">
      <Link href="/">Accueil</Link>
      <span aria-hidden="true">›</span>
      <strong>{current}</strong>
    </nav>
  );
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
  }).format(date);
}

export function FanzinesConnectedPage() {
  const [items, setItems] = useState<Fanzine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void editorialApi.fanzines()
      .then((value) => {
        if (!active) return;
        setItems(value);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : 'Impossible de charger les fanzines.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="pm-prototype-page">
      <Breadcrumb current="Fanzines" />
      <header className="pm-prototype-title">
        <h1>Le Fanzine de l’Épouvante</h1>
        <p>
          Les numéros publiés par l’équipe éditoriale apparaissent ici
          directement depuis le backend.
        </p>
      </header>

      <section className="pm-editorial-hero">
        <div>
          <span>✦ L’ESPACE FANZINE</span>
          <h2>Le fantastique entre vos mains.</h2>
          <p>
            Lecture numérique et archives réelles, sans faux numéros ni faux
            abonnements.
          </p>
        </div>
        <div className="pm-fanzine-cover" aria-hidden="true">ÉPOUVANTE</div>
      </section>

      <section className="pm-prototype-section" aria-labelledby="fanzines-title">
        <h2 id="fanzines-title">Numéros publiés</h2>

        {loading ? (
          <div className="pm-prototype-empty" role="status" aria-busy="true">
            <h3>Chargement des publications…</h3>
          </div>
        ) : null}

        {error ? (
          <p className="notice notice--error" role="alert">{error}</p>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className="pm-prototype-empty" role="status">
            <h3>Aucun fanzine publié pour le moment.</h3>
            <p>
              La page reste vide tant qu’un administrateur n’a pas publié un
              vrai numéro.
            </p>
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="pm-news-grid">
            {items.map((item) => (
              <article key={item.id} className="pm-editorial-real-card">
                <div aria-hidden="true">📖</div>
                <small>{item.issueLabel ?? 'FANZINE'}</small>
                <h3>{item.title}</h3>
                <p>{item.excerpt}</p>
                {item.publishedAt ? (
                  <time dateTime={item.publishedAt}>
                    {formatDate(item.publishedAt)}
                  </time>
                ) : null}
                <Link
                  className="pm-button pm-button--outline"
                  href={`/fanzines/lecteur?slug=${encodeURIComponent(item.slug)}`}
                >
                  Lire le numéro →
                </Link>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function FanzineReader({
  slug,
}: {
  slug: string | null;
}) {
  const [item, setItem] = useState<Fanzine | null>(null);
  const [loading, setLoading] = useState(Boolean(slug));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    void editorialApi.fanzine(slug)
      .then((value) => {
        if (!active) return;
        setItem(value);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : 'Impossible de charger ce fanzine.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <div className="pm-prototype-page pm-reader-real">
      <Breadcrumb current="Lecteur fanzine" />

      {!slug ? (
        <div className="pm-prototype-empty">
          <h1>Sélectionnez un fanzine.</h1>
          <Link className="pm-button pm-button--navy" href="/fanzines">
            Voir les numéros publiés
          </Link>
        </div>
      ) : null}

      {loading ? <p role="status">Chargement du numéro…</p> : null}
      {error ? <p className="notice notice--error" role="alert">{error}</p> : null}

      {item ? (
        <article className="pm-reader-real__article">
          <span className="pm-overline">{item.issueLabel ?? 'FANZINE'}</span>
          <h1>{item.title}</h1>
          <p className="pm-reader-real__lead">{item.excerpt}</p>
          {item.publishedAt ? (
            <time dateTime={item.publishedAt}>
              Publié le {formatDate(item.publishedAt)}
            </time>
          ) : null}
          <div className="pm-reader-real__body">
            {item.body.split(/\n{2,}/).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </article>
      ) : null}
    </div>
  );
}

export function FestivalConnectedPage() {
  const [items, setItems] = useState<FestivalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void editorialApi.festival()
      .then((value) => {
        if (!active) return;
        setItems(value);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : 'Impossible de charger le festival et les actualités.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="pm-prototype-page">
      <Breadcrumb current="Festival & actualités" />
      <header className="pm-prototype-title">
        <h1>Le festival et les nouvelles de la maison</h1>
        <p>
          Programme, rencontres et actualités publiés depuis le backend
          éditorial.
        </p>
      </header>

      <section className="pm-festival-hero">
        <div>
          <span>LE PETIT FESTIVAL DE L’ÉPOUVANTE</span>
          <h2>Le frisson se partage aussi en vrai.</h2>
          <p>
            Seules les annonces réellement publiées par l’équipe sont visibles.
          </p>
        </div>
        <strong aria-hidden="true">🎥</strong>
      </section>

      <section className="pm-prototype-section" aria-labelledby="festival-feed-title">
        <h2 id="festival-feed-title">Programme & actualités</h2>

        {loading ? (
          <div className="pm-prototype-empty" role="status" aria-busy="true">
            <h3>Chargement des publications…</h3>
          </div>
        ) : null}

        {error ? (
          <p className="notice notice--error" role="alert">{error}</p>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className="pm-prototype-empty" role="status">
            <h3>Aucune actualité publiée pour le moment.</h3>
            <p>
              Aucun faux événement n’est affiché. Le flux s’alimente uniquement
              avec les publications réelles.
            </p>
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="pm-news-grid">
            {items.map((item) => (
              <article key={item.id} className="pm-editorial-real-card">
                <div aria-hidden="true">🎬</div>
                <small>FESTIVAL / ACTUALITÉ</small>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <dl className="pm-editorial-real-card__meta">
                  {item.location ? (
                    <div><dt>Lieu</dt><dd>{item.location}</dd></div>
                  ) : null}
                  {item.startsAt ? (
                    <div>
                      <dt>Date</dt>
                      <dd>
                        <time dateTime={item.startsAt}>
                          {formatDate(item.startsAt)}
                        </time>
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <details>
                  <summary>Lire la publication</summary>
                  <div className="pm-editorial-real-card__body">
                    {item.body.split(/\n{2,}/).map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                </details>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
