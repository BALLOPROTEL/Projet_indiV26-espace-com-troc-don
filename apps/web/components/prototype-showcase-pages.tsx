import Link from 'next/link';
import { RoadmapBadge } from './design-system';

const boutiqueCategories = [
  ['🧛', 'Figurines'],
  ['🎬', 'Films & Blu-ray'],
  ['📚', 'BD & Livres'],
  ['🎲', 'Jeux'],
  ['🎁', 'Goodies'],
  ['📖', 'Fanzines'],
] as const;

function Breadcrumb({ current }: { current: string }) {
  return (
    <nav className="pm-breadcrumbs" aria-label="Fil d’Ariane">
      <Link href="/">Accueil</Link>
      <span aria-hidden="true">›</span>
      <strong>{current}</strong>
    </nav>
  );
}

export function BoutiqueShowcase() {
  return (
    <div className="pm-prototype-page">
      <Breadcrumb current="Boutique" />
      <header className="pm-prototype-title">
        <h1>Notre boutique fantastique</h1>
        <p>Figurines, films, bandes dessinées, jeux et objets de collection.</p>
      </header>

      <div className="pm-shop-layout">
        <aside className="pm-shop-filters" aria-label="Filtres de la boutique">
          <div className="pm-shop-filters__head">
            <strong>Filtres</strong>
            <span>À venir</span>
          </div>
          <h2>Catégories</h2>
          {boutiqueCategories.map(([, label], index) => (
            <label key={label}>
              <input type="radio" name="future-category" checked={index === 0} readOnly disabled />
              {label}
            </label>
          ))}
          <hr />
          <h2>Disponibilité</h2>
          <label><input type="checkbox" disabled /> En stock</label>
          <label><input type="checkbox" disabled /> En promotion</label>
          <p className="pm-future-note">
            Chaque univers aura ses propres filtres quand le catalogue commercial réel sera connecté.
          </p>
        </aside>

        <section className="pm-shop-content" aria-labelledby="shop-future-title">
          <div className="pm-shop-toolbar">
            <span>Catalogue commercial</span>
            <input type="search" placeholder="Rechercher un article…" disabled aria-label="Recherche boutique en préparation" />
            <select disabled aria-label="Tri boutique en préparation">
              <option>Pertinence</option>
            </select>
          </div>

          <div className="pm-category-showcase">
            {boutiqueCategories.map(([icon, label]) => (
              <article key={label}>
                <div className="pm-category-showcase__visual" aria-hidden="true">{icon}</div>
                <small>UNIVERS</small>
                <h2>{label}</h2>
                <RoadmapBadge>BIENTÔT</RoadmapBadge>
              </article>
            ))}
          </div>

          <div className="pm-prototype-empty" id="shop-future-title">
            <RoadmapBadge>LOT L4–L5</RoadmapBadge>
            <h2>Le design de la boutique est prêt.</h2>
            <p>
              Les produits, prix, stocks, favoris, panier et commandes ne seront affichés
              qu’après connexion de leurs vrais contrats backend.
            </p>
            <div className="pm-prototype-empty__actions">
              <Link className="pm-button pm-button--outline" href="/boutique/produit">Voir la fiche produit</Link>
              <Link className="pm-button pm-button--outline" href="/panier">Voir le panier</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function FanzinesShowcase() {
  return (
    <div className="pm-prototype-page">
      <Breadcrumb current="Fanzines" />
      <header className="pm-prototype-title">
        <h1>Le Fanzine de l’Épouvante</h1>
        <p>Un espace éditorial dédié au cinéma, à l’horreur et à l’imaginaire.</p>
      </header>

      <section className="pm-editorial-hero">
        <div>
          <span>✦ L’ESPACE FANZINE</span>
          <h2>Le fantastique entre vos mains.</h2>
          <p>Lecture numérique, archives et futures éditions réunies dans un seul univers.</p>
          <Link className="pm-button pm-button--orange" href="/fanzines/lecteur">
            Ouvrir le lecteur →
          </Link>
        </div>
        <div className="pm-fanzine-cover" aria-hidden="true">ÉPOUVANTE</div>
      </section>

      <section className="pm-prototype-section" aria-labelledby="fanzine-formules">
        <h2 id="fanzine-formules">Choisissez votre formule</h2>
        <p>Les offres seront activées uniquement lorsque les contenus et abonnements réels seront disponibles.</p>
        <div className="pm-formula-grid">
          {[
            ['📱', 'Numéro numérique', 'Lecture depuis votre espace membre'],
            ['💻', 'Abonnement numérique', 'Numéros et archives numériques'],
            ['📦', 'Papier + numérique', 'Version papier et accès en ligne'],
          ].map(([icon, title, text]) => (
            <article key={title}>
              <span aria-hidden="true">{icon}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <RoadmapBadge>BIENTÔT</RoadmapBadge>
            </article>
          ))}
        </div>
      </section>

      <section className="pm-prototype-section">
        <h2>Les derniers numéros</h2>
        <p>Les vraies éditions publiées apparaîtront ici sans contenu fictif.</p>
        <div className="pm-editorial-placeholder-grid">
          {['Archives', 'Nouveautés', 'Collections', 'Lecture'].map((label) => (
            <article key={label}>
              <div aria-hidden="true">☾</div>
              <strong>{label}</strong>
              <span>Contenu en préparation</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function FestivalShowcase() {
  return (
    <div className="pm-prototype-page">
      <Breadcrumb current="Festival & actualités" />
      <header className="pm-prototype-title">
        <h1>Le festival et les nouvelles de la maison</h1>
        <p>Projections, rencontres, jeux et actualités de la communauté.</p>
      </header>

      <section className="pm-festival-hero">
        <div>
          <span>LE PETIT FESTIVAL DE L’ÉPOUVANTE</span>
          <h2>Le frisson se partage aussi en vrai.</h2>
          <p>L’espace accueillera le programme réel, les rencontres et les contenus éditoriaux.</p>
          <button className="pm-button pm-button--orange" type="button" disabled>
            Découvrir le programme — bientôt
          </button>
        </div>
        <strong aria-hidden="true">🎥</strong>
      </section>

      <section className="pm-prototype-section">
        <h2>À la une</h2>
        <p>Les actualités réelles seront publiées ici lorsqu’un flux éditorial sera disponible.</p>
        <div className="pm-news-grid">
          {[
            ['🎬', 'Festival'],
            ['📚', 'Coulisses'],
            ['🎲', 'Communauté'],
          ].map(([icon, label]) => (
            <article key={label}>
              <div aria-hidden="true">{icon}</div>
              <small>ACTUALITÉS</small>
              <h3>{label}</h3>
              <p>Aucun article fictif : ce bloc sera alimenté par de vraies publications.</p>
              <RoadmapBadge>BIENTÔT</RoadmapBadge>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
