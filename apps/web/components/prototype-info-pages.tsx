import Link from 'next/link';

const faqItems = [
  [
    'Comment acheter un article ?',
    'La boutique, le panier et les commandes utilisent des données réelles. Le paiement est intégré avec Stripe Checkout en mode test tant que la mise en production commerciale n’est pas décidée.',
  ],
  [
    'Comment donner ou échanger un objet ?',
    'Accédez à Échanges & dons, puis utilisez Publier une annonce. Décrivez l’article et soumettez-le à la modération.',
  ],
  [
    'Qui valide les annonces de troc ?',
    'Une équipe de modération contrôle les annonces avant leur publication.',
  ],
  [
    'Comment recevoir des notifications ?',
    'L’espace Notifications affiche l’inbox personnelle liée à votre compte pour les événements de don et de troc.',
  ],
  [
    'Puis-je lire le fanzine en ligne ?',
    'Le lecteur numérique sera activé lorsque les numéros et leurs contenus réels seront disponibles.',
  ],
  [
    'La plateforme est-elle déjà en service ?',
    'DON/TROC, publication, modération, conversations privées, favoris, notifications, catalogue, panier et commandes sont connectés. Les espaces Fanzines, Festival et Contact restent partiellement éditoriaux ou non transactionnels.',
  ],
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

export function FaqPage() {
  return (
    <div className="pm-prototype-page">
      <Breadcrumb current="Aide & FAQ" />
      <header className="pm-prototype-title">
        <h1>Comment peut-on vous aider ?</h1>
        <p>Les principales questions, de la boutique aux échanges.</p>
      </header>

      <section className="pm-faq-list" aria-label="Questions fréquentes">
        {faqItems.map(([question, answer]) => (
          <details key={question} className="pm-faq-item">
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>

      <Link className="pm-button pm-button--navy pm-info-cta" href="/contact">
        Contacter l’équipe →
      </Link>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="pm-prototype-page">
      <Breadcrumb current="Notre histoire" />
      <header className="pm-prototype-title">
        <h1>La Petite Maison de l’Épouvante</h1>
        <p>Le lieu de rêve pour frissonner.</p>
      </header>

      <section className="pm-about-feature">
        <div>
          <span className="pm-overline">NOTRE UNIVERS</span>
          <h2>Un refuge pour tous les passionnés de l’imaginaire.</h2>
          <p>
            Au départ, un fanzine. Puis des magasins, des objets de collection
            et un festival. Aujourd’hui, notre univers s’étend vers une
            plateforme unique pour acheter, donner et échanger.
          </p>
          <Link className="pm-button pm-button--navy" href="/boutique">
            Explorer notre boutique
          </Link>
        </div>
        <div className="pm-about-art" aria-hidden="true">
          <span>☾</span>
          <strong>LA PETITE MAISON<br />DE L’ÉPOUVANTE</strong>
        </div>
      </section>

      <section className="pm-prototype-section">
        <h2>Nos trois piliers</h2>
        <p>Une plateforme pensée pour l’expérience des passionnés.</p>
        <div className="pm-pillar-grid">
          {[
            ['🛍️', 'La boutique', 'Acheter produits, fanzines, BD et jeux.'],
            ['♻️', 'La communauté', 'Échanger et donner entre utilisateurs.'],
            ['🎥', 'Le fantastique', 'Lire, jouer, découvrir et se retrouver.'],
          ].map(([icon, title, text]) => (
            <article key={title}>
              <span aria-hidden="true">{icon}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ContactPage() {
  return (
    <div className="pm-prototype-page">
      <Breadcrumb current="Contact" />
      <header className="pm-prototype-title">
        <h1>Nous contacter</h1>
        <p>Une question sur la boutique ou la communauté ?</p>
      </header>

      <div className="pm-contact-layout">
        <section className="pm-contact-form" aria-labelledby="contact-title">
          <h2 id="contact-title">Envoyer un message</h2>

          <label>
            <span>Votre nom</span>
            <input type="text" placeholder="Votre nom" disabled />
          </label>
          <label>
            <span>Votre e-mail</span>
            <input type="email" placeholder="vous@example.fr" disabled />
          </label>
          <label>
            <span>Sujet</span>
            <select disabled defaultValue="question-boutique">
              <option value="question-boutique">Une question sur la boutique</option>
              <option value="signalement">Signaler une annonce</option>
              <option value="compte">Une question sur mon compte</option>
              <option value="autre">Autre demande</option>
            </select>
          </label>
          <label>
            <span>Votre message</span>
            <textarea rows={5} placeholder="Écrivez votre message…" disabled />
          </label>

          <button className="pm-button pm-button--teal" type="button" disabled>
            Envoi non activé
          </button>
        </section>

        <aside className="pm-contact-aside">
          <h2>Service client</h2>
          <p>
            Nous imaginons un support simple, accessible et rassurant pour
            accompagner les acheteurs et les membres de la communauté.
          </p>
          <div className="pm-info-notice">
            Aucun message n’est transmis pour le moment : le backend Contact
            n’existe pas encore.
          </div>
          <Link className="pm-button pm-button--outline" href="/faq">
            Voir la FAQ →
          </Link>
        </aside>
      </div>
    </div>
  );
}
