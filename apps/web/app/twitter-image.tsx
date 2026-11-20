import { ImageResponse } from 'next/og';

export const alt =
  'La Petite Maison de l’Épouvante — plateforme communautaire de don et de troc';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: '#f4efe6',
          color: '#171512',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 5 }}>
          LA PETITE MAISON
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', fontSize: 76, fontWeight: 700 }}>
            Donnez. Troquez. Faites circuler.
          </div>
          <div style={{ display: 'flex', fontSize: 34, maxWidth: 940 }}>
            Une plateforme communautaire pour offrir une seconde vie aux objets.
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 24 }}>
          Don · Troc · Communauté
        </div>
      </div>
    ),
    size,
  );
}
