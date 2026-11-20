import Link from 'next/link';
import { BrandMark, RoadmapBadge } from './design-system';

export function SiteFooter() {
  return (
    <footer className="pm-footer">
      <div className="pm-wrap pm-footer__columns">
        <div className="pm-footer__about">
          <div className="pm-footer__brand">
            <BrandMark compact />
            <h2>La Petite Maison<br />de l’Épouvante</h2>
          </div>
          <p>
            La plateforme des passionnés d’horreur et de fantastique :
            une communauté DON/TROC déjà active, et une boutique en construction.
          </p>
        </div>

        <div>
          <h3>Explorer</h3>
          <Link href="/echanges">Dons &amp; échanges</Link>
          <Link href="/#boutique">La boutique <RoadmapBadge>BIENTÔT</RoadmapBadge></Link>
          <Link href="/#fanzines">Fanzines <RoadmapBadge>BIENTÔT</RoadmapBadge></Link>
        </div>

        <div>
          <h3>Communauté</h3>
          <Link href="/espace#publier">Publier une annonce</Link>
          <Link href="/echanges">Découvrir les échanges</Link>
          <Link href="/moderation">Modération</Link>
        </div>

        <div>
          <h3>Projet</h3>
          <Link href="/#actualites">Actualités <RoadmapBadge>BIENTÔT</RoadmapBadge></Link>
          <span className="pm-footer__muted">FAQ · lot L6</span>
          <span className="pm-footer__muted">Contact · lot L6</span>
        </div>
      </div>

      <div className="pm-wrap pm-footer__bottom">
        <span>© La Petite Maison de l’Épouvante · Projet CESI</span>
        <span>Fonctions commerciales non actives dans ce lot</span>
      </div>
    </footer>
  );
}
