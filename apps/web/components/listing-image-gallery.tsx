/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, type KeyboardEvent } from 'react';
import { listingAssetUrl } from '../lib/api';
import { galleryMove, sortGalleryImages } from '../lib/listing-gallery';
import type { ListingImage } from '../lib/types';

export function ListingImageGallery({
  listingTitle,
  images,
}: {
  listingTitle: string;
  images: readonly ListingImage[];
}) {
  const ordered = sortGalleryImages(images);
  const [selected, setSelected] = useState(0);
  const current = ordered[selected] ?? ordered[0];
  const count = ordered.length;

  if (!current) {
    return (
      <div className="product-gallery__empty" role="status">
        Aucune photo disponible pour cet article.
      </div>
    );
  }

  function move(delta: number) {
    setSelected((currentIndex) => galleryMove(currentIndex, delta, count));
  }

  function onKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    }
  }

  return (
    <section
      className="product-gallery"
      aria-label={`Galerie de photos : ${listingTitle}`}
      onKeyDown={onKeys}
    >
      <figure className="product-gallery__main">
        <img
          key={current.id}
          src={listingAssetUrl(current.contentUrl)}
          alt={`${listingTitle} — photo ${selected + 1} sur ${count}`}
          loading="eager"
        />
        <figcaption aria-live="polite">
          Photo {selected + 1} / {count}
        </figcaption>
        {count > 1 ? (
          <div className="product-gallery__navigation">
            <button
              type="button"
              aria-label="Photo précédente"
              onClick={() => move(-1)}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              aria-label="Photo suivante"
              onClick={() => move(1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : null}
      </figure>
      {count > 1 ? (
        <div className="product-gallery__thumbnails" role="group" aria-label="Choisir une photo">
          {ordered.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={`Afficher la photo ${index + 1} sur ${count}`}
              aria-pressed={selected === index}
              className={selected === index ? 'is-selected' : ''}
              onClick={() => setSelected(index)}
            >
              <img
                src={listingAssetUrl(image.contentUrl)}
                alt=""
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
      <p className="product-gallery__help">
        {count > 1
          ? 'Cliquez sur une miniature ou utilisez les flèches du clavier pour parcourir les photos.'
          : 'Photo principale de cet article.'}
      </p>
    </section>
  );
}
