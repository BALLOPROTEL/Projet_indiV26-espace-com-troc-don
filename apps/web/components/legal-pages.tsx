import Link from 'next/link';

const controllerName =
  process.env.NEXT_PUBLIC_LEGAL_CONTROLLER_NAME?.trim() ||
  'Responsable à configurer avant publication réelle';
const contactEmail =
  process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() ||
  'Adresse de contact à configurer';
const hostName =
  process.env.NEXT_PUBLIC_LEGAL_HOST_NAME?.trim() ||
  'Hébergeur à configurer avant publication réelle';

function LegalHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <header className="pm-prototype-title pm-legal-hero">
      <span className="pm-overline">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{intro}</p>
    </header>
  );
}

function LegalNotice() {
  return (
    <div className="pm-info-notice" role="note">
      Cette version est un projet pédagogique CESI. Les coordonnées définitives
      de l’éditeur, du responsable de traitement et de l’hébergeur doivent être
      renseignées avant toute mise en production publique réelle.
    </div>
  );
}

export function PrivacyPolicyPage() {
  return (
    <div className="pm-prototype-page pm-legal-page">
      <LegalHeader
        eyebrow="CONFIDENTIALITÉ"
        title="Politique de confidentialité"
        intro="Ce document décrit les traitements réellement présents dans la plateforme et les droits disponibles."
      />
      <LegalNotice />

      <section>
        <h2>Responsable et contact</h2>
        <dl>
          <div><dt>Responsable</dt><dd>{controllerName}</dd></div>
          <div><dt>Contact droits</dt><dd>{contactEmail}</dd></div>
        </dl>
      </section>

      <section>
        <h2>Données traitées</h2>
        <p>
          La plateforme traite uniquement les données nécessaires à ses
          fonctionnalités : identité et e-mail provenant de Keycloak, annonces
          et médias publiés, favoris, propositions de don/troc, transactions,
          conversations privées, notifications, panier et commandes, ainsi que
          les demandes de contact lorsqu’elles sont activées.
        </p>
        <p>
          Les mots de passe et les données de carte bancaire ne sont jamais
          stockés par l’application. L’authentification est déléguée à Keycloak.
        </p>
      </section>

      <section>
        <h2>Finalités</h2>
        <ul>
          <li>authentifier les membres et sécuriser les accès ;</li>
          <li>permettre la publication, la modération, le don et le troc ;</li>
          <li>permettre les conversations privées entre participants concernés ;</li>
          <li>gérer les favoris, notifications, paniers et commandes ;</li>
          <li>prévenir les abus, incidents et accès non autorisés ;</li>
          <li>répondre aux demandes de support et d’exercice des droits.</li>
        </ul>
      </section>

      <section>
        <h2>Cookies et stockage navigateur</h2>
        <p>
          Aucun outil publicitaire ou de mesure d’audience applicatif n’est
          activé dans la version actuelle. Les stockages strictement nécessaires
          à l’authentification et au fonctionnement du service ne doivent pas
          être présentés comme des cookies marketing.
        </p>
        <p>
          Si un traceur soumis au consentement est ajouté ultérieurement, il
          devra rester bloqué avant le choix de l’utilisateur et un mécanisme de
          retrait aussi simple devra être fourni.
        </p>
      </section>

      <section>
        <h2>Durée de conservation</h2>
        <p>
          Aucune durée arbitraire n’est inventée dans cette version. Les données
          actives sont conservées tant qu’elles sont nécessaires au service.
          Avant publication réelle, un calendrier de conservation devra être
          fixé pour les comptes, messages, annonces, commandes, journaux
          techniques et demandes de support.
        </p>
        <p>
          Une suppression de compte ne doit pas effacer aveuglément une donnée
          qu’une obligation légale ou la défense de droits impose de conserver ;
          dans ce cas, l’anonymisation ou une conservation restreinte est
          privilégiée.
        </p>
      </section>

      <section>
        <h2>Vos droits</h2>
        <p>
          Depuis <Link href="/parametres">Paramètres</Link>, un membre
          authentifié peut exporter les données accessibles de son compte dans
          un fichier JSON structuré et lisible par machine. Il peut également
          gérer son identité Keycloak et initier une demande
          d’effacement/anonymisation des données applicatives.
        </p>
        <p>
          Les demandes sont traitées conformément aux droits d’accès,
          rectification, effacement, limitation, opposition et portabilité
          applicables au traitement concerné.
        </p>
      </section>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="pm-prototype-page pm-legal-page">
      <LegalHeader
        eyebrow="CONDITIONS"
        title="Conditions d’utilisation"
        intro="Règles d’usage de la communauté, de la boutique de démonstration et des espaces membres."
      />
      <LegalNotice />

      <section>
        <h2>Objet du service</h2>
        <p>
          La Petite Maison de l’Épouvante réunit un espace communautaire de
          don/troc et une boutique. La version actuelle reste un projet
          pédagogique et ne doit pas être présentée comme une activité
          commerciale publique tant que les éléments juridiques et
          opérationnels de production ne sont pas finalisés.
        </p>
      </section>

      <section>
        <h2>Comptes et sécurité</h2>
        <p>
          Chaque utilisateur doit utiliser son propre compte. Les rôles et
          autorisations sont contrôlés côté serveur. Toute tentative d’accès à
          une conversation, une commande ou une ressource appartenant à un tiers
          est interdite.
        </p>
      </section>

      <section>
        <h2>Annonces et échanges</h2>
        <ul>
          <li>publier uniquement des contenus licites et que l’on est autorisé à proposer ;</li>
          <li>ne pas publier de données sensibles ou coordonnées privées inutiles ;</li>
          <li>respecter les décisions de modération ;</li>
          <li>confirmer une remise uniquement lorsqu’elle a réellement eu lieu ;</li>
          <li>ne pas utiliser la messagerie pour le spam, le harcèlement ou la fraude.</li>
        </ul>
      </section>

      <section>
        <h2>Boutique et paiement</h2>
        <p>
          Les fonctionnalités commerciales présentes dans le code peuvent être
          configurées en environnement de test. Aucun paiement live ne doit être
          activé tant que les conditions commerciales, l’identité de l’éditeur,
          la fiscalité, les modalités de livraison et les obligations
          consommateurs ne sont pas finalisées.
        </p>
      </section>

      <section>
        <h2>Modération et disponibilité</h2>
        <p>
          Une annonce peut être refusée ou retirée lorsqu’elle enfreint les
          règles du service. La plateforme peut limiter temporairement une
          fonctionnalité pour raisons de sécurité, maintenance ou intégrité des
          données.
        </p>
      </section>
    </div>
  );
}

export function LegalNoticePage() {
  return (
    <div className="pm-prototype-page pm-legal-page">
      <LegalHeader
        eyebrow="INFORMATIONS LÉGALES"
        title="Mentions légales"
        intro="Informations disponibles pour la version actuelle du projet."
      />
      <LegalNotice />

      <section>
        <dl>
          <div><dt>Service</dt><dd>La Petite Maison de l’Épouvante</dd></div>
          <div><dt>Nature actuelle</dt><dd>Projet pédagogique CESI</dd></div>
          <div><dt>Responsable / éditeur</dt><dd>{controllerName}</dd></div>
          <div><dt>Contact</dt><dd>{contactEmail}</dd></div>
          <div><dt>Hébergement</dt><dd>{hostName}</dd></div>
        </dl>
      </section>

      <section>
        <h2>Avant publication réelle</h2>
        <p>
          Les coordonnées légales complètes, les informations d’hébergement,
          les conditions commerciales et le calendrier de conservation doivent
          être configurés avec les informations réelles de l’exploitant.
        </p>
      </section>
    </div>
  );
}
