import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };

export default function HomeOGImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #0d1b12 0%, #1a3d2b 60%, #0d1b12 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Felt texture overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(45,106,79,0.35) 0%, transparent 70%)',
          }}
        />

        {/* Card suits */}
        <div
          style={{
            fontSize: 72,
            letterSpacing: 12,
            marginBottom: 24,
            display: 'flex',
          }}
        >
          <span style={{ color: '#d4af37' }}>♠</span>
          <span style={{ color: '#c0392b', marginLeft: 12 }}>♥</span>
          <span style={{ color: '#c0392b', marginLeft: 12 }}>♦</span>
          <span style={{ color: '#d4af37', marginLeft: 12 }}>♣</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 74,
            fontWeight: 800,
            color: '#f0ede8',
            textAlign: 'center',
            lineHeight: 1.1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <span>Play Texas Hold&apos;em</span>
          <span style={{ color: '#d4af37' }}>with Friends</span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 30,
            color: '#a89f96',
            marginTop: 24,
            display: 'flex',
          }}
        >
          Create a private table · Share one link · No account needed
        </div>

        {/* Domain badge */}
        <div
          style={{
            marginTop: 40,
            padding: '10px 28px',
            background: 'rgba(212,175,55,0.15)',
            border: '1px solid rgba(212,175,55,0.4)',
            borderRadius: 40,
            fontSize: 24,
            color: '#d4af37',
            display: 'flex',
          }}
        >
          airtexas.club
        </div>
      </div>
    ),
    { ...size },
  );
}
