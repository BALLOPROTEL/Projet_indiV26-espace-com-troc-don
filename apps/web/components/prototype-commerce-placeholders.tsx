import Link from 'next/link';
import { RoadmapBadge } from './design-system';

function Breadcrumb({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav className="pm-breadcrumbs" aria-label="Fil d’Ariane">
      <Link href="/">Accueil</Link>
      {items.map((item) => (
        <span key={item.label} className="pm-breadcrumbs__pair">
          <span aria-hidden="true">›</span>
          {item.href ? <Link href={item.href}>{item.label}</Link> : <strong>{item.label}</strong>}
        </span>
      ))}
    </nav>
  );
}

export function ProductPlaceholderPage() {
  return (
    <div className="pm-prototype-page">
      <Breadcrumb items={[{ label: 'Boutique', href: '/boutique' }, { label: 'Fiche produit' }]} />

      <div className="pm-product-placeholder">
        <div className="pm-product-placeholder__visual" aria-hidden="true">
          <span>✦</span>
          <strong>PRODUIT</strong>
        </div>

        <section className="pm-product-placeholder__info">
          <span className="pm-overline">BOUTIQUE · PRODUIT</span>
          <h1>Fiche produit</h1>
          <RoadmapBadge>BACKEND PRODUITS REQUIS</RoadmapBadge>
          <p>
            Cette page reprend la structure de la maquette 03, mais aucun nom,
            prix, stock, avis ou disponibilité fictive n’est affiché.
          </p>

          <div className="pm-product-placeholder__price">Prix réel à connecter</div>
          <div className="pm-product-placeholder__availability">
            Disponibilité réelle à connecter
          </div>

          <div className="pm-product-placeholder__actions">
            <button className="pm-button pm-button--orange" type="button" disabled>
              Ajouter au panier
            </button>
            <button className="pm-button pm-button--outline" type="button" disabled>
              Ajouter aux favoris
            </button>
          </div>

          <ul className="pm-product-placeholder__specs">
            <li><strong>Livraison :</strong> contrat e-commerce à définir</li>
            <li><strong>Retours :</strong> politique réelle à connecter</li>
            <li><strong>Paiement :</strong> aucun encaissement actif</li>
          </ul>
        </section>
      </div>

      <section className="pm-prototype-section">
        <h2>Vous aimerez aussi</h2>
        <p>Les recommandations apparaîtront ici à partir de vraies données produit.</p>
        <div className="pm-empty-shelf">
          <span aria-hidden="true">♡</span>
          <strong>Aucune recommandation fictive</strong>
        </div>
      </section>
    </div>
  );
}

export function ReaderPlaceholderPage() {
  return (
    <div className="pm-prototype-page">
      <Breadcrumb items={[{ label: 'Fanzines', href: '/fanzines' }, { label: 'Lecteur numérique' }]} />
      <header className="pm-prototype-title">
        <h1>Lecteur numérique</h1>
        <p>Écran 05 — lecture intégrée au compte.</p>
      </header>

      <section className="pm-reader-shell">
        <div className="pm-reader-shell__toolbar">
          <strong>FANZINE · LECTEUR</strong>
          <Link className="pm-button pm-button--outline" href="/fanzines">
            Fermer le lecteur ✕
          </Link>
        </div>

        <div className="pm-reader-page">
          <span className="pm-overline">CONTENU NUMÉRIQUE</span>
          <h2>Aucun numéro réel connecté</h2>
          <div className="pm-reader-page__art" aria-hidden="true">☾</div>
          <p>
            Le lecteur reprendra cette mise en page lorsque les véritables numéros,
            pages et droits d’accès seront exposés par le backend éditorial.
          </p>
        </div>

        <div className="pm-reader-shell__pager">
          <button className="pm-button pm-button--outline" type="button" disabled>← Page précédente</button>
          <span>Page réelle non disponible</span>
          <button className="pm-button pm-button--navy" type="button" disabled>Page suivante →</button>
        </div>
      </section>
    </div>
  );
}

export function CartPlaceholderPage() {
  return (
    <div className="pm-prototype-page">
      <Breadcrumb items={[{ label: 'Mon panier' }]} />
      <header className="pm-prototype-title">
        <h1>Mon panier</h1>
        <p>Les articles commerciaux sélectionnés apparaîtront ici.</p>
      </header>

      <div className="pm-cart-empty">
        <span aria-hidden="true">🛒</span>
        <h2>Votre panier est vide</h2>
        <p>
          Le panier réel sera activé avec les contrats produits, prix, stock et
          session panier du lot e-commerce.
        </p>
        <Link className="pm-button pm-button--orange" href="/boutique">
          Découvrir la boutique
        </Link>
      </div>
    </div>
  );
}

export function CheckoutPlaceholderPage() {
  return (
    <div className="pm-prototype-page">
      <Breadcrumb items={[{ label: 'Panier', href: '/panier' }, { label: 'Commande' }]} />
      <header className="pm-prototype-title">
        <h1>Finaliser ma commande</h1>
        <div className="pm-checkout-steps" aria-label="Étapes de commande">
          <span>1. Panier</span><b aria-hidden="true">›</b>
          <span>2. Livraison et paiement</span><b aria-hidden="true">›</b>
          <span>3. Confirmation</span>
        </div>
      </header>

      <div className="pm-checkout-layout">
        <section className="pm-checkout-form" aria-labelledby="checkout-disabled-title">
          <h2 id="checkout-disabled-title">📦 Vos coordonnées</h2>
          <div className="pm-checkout-fields">
            <label><span>Prénom</span><input disabled placeholder="Prénom" /></label>
            <label><span>Nom</span><input disabled placeholder="Nom" /></label>
            <label className="pm-checkout-fields__wide"><span>Adresse e-mail</span><input disabled type="email" placeholder="vous@exemple.fr" /></label>
            <label className="pm-checkout-fields__wide"><span>Adresse</span><input disabled placeholder="Numéro et rue" /></label>
            <label><span>Code postal</span><input disabled placeholder="75000" /></label>
            <label><span>Ville</span><input disabled placeholder="Paris" /></label>
          </div>
          <h3>💳 Mode de paiement</h3>
          <div className="pm-info-notice">
            Aucun paiement n’est actif. Les champs sont désactivés tant que le
            backend commande/paiement n’existe pas.
          </div>
          <button className="pm-button pm-button--orange" type="button" disabled>
            Confirmer la commande
          </button>
        </section>

        <aside className="pm-checkout-summary">
          <h2>Votre commande</h2>
          <p>Aucun article réel dans le panier.</p>
          <div className="pm-summary-line"><span>Sous-total</span><strong>—</strong></div>
          <div className="pm-summary-line"><span>Livraison</span><strong>—</strong></div>
          <div className="pm-summary-line pm-summary-line--total"><span>Total</span><strong>—</strong></div>
          <Link className="pm-button pm-button--outline" href="/panier">← Retour au panier</Link>
        </aside>
      </div>
    </div>
  );
}

export function ConfirmationPlaceholderPage() {
  return (
    <div className="pm-prototype-page">
      <section className="pm-confirmation-placeholder">
        <div aria-hidden="true">✓</div>
        <h1>Confirmation de commande</h1>
        <p>
          Aucune commande réelle n’a été créée. Cet écran 13 sera alimenté
          uniquement après validation d’un vrai checkout.
        </p>
        <RoadmapBadge>LOT E-COMMERCE REQUIS</RoadmapBadge>
        <div className="pm-confirmation-placeholder__actions">
          <Link className="pm-button pm-button--orange" href="/boutique">Retourner en boutique</Link>
          <Link className="pm-button pm-button--outline" href="/mes-commandes">Voir mes commandes</Link>
        </div>
      </section>
    </div>
  );
}
