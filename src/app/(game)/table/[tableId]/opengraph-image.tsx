import { ImageResponse } from 'next/og';
import { getTable } from '@/lib/db/kv';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };

interface Props {
  params: Promise<{ tableId: string }>;
}

export default async function TableOGImage({ params }: Props): Promise<ImageResponse> {
  const { tableId } = await params;

  // Best-effort — if KV is unavailable we show a generic image
  let hostName = 'Someone';
  try {
    const table = await getTable(tableId);
    if (table) {
      const host = table.players[table.hostPlayerId];
      if (host?.name) hostName = host.name;
    }
  } catch {
    // Silently fall back to generic host name
  }

  const playerCount = 0; // can't know at image-generation time without extra fetch
  void playerCount; // suppress unused-var

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
          position: 'relative',
        }}
      >
        {/* Radial glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(45,106,79,0.4) 0%, transparent 70%)',
          }}
        />

        {/* Suits header */}
        <div style={{ fontSize: 52, letterSpacing: 10, marginBottom: 20, display: 'flex' }}>
          <span style={{ color: '#d4af37' }}>♠</span>
          <span style={{ color: '#c0392b', marginLeft: 10 }}>♥</span>
          <span style={{ color: '#c0392b', marginLeft: 10 }}>♦</span>
          <span style={{ color: '#d4af37', marginLeft: 10 }}>♣</span>
        </div>

        {/* Invite headline */}
        <div
          style={{
            fontSize: 42,
            color: '#a89f96',
            marginBottom: 12,
            display: 'flex',
          }}
        >
          You&apos;re invited to play poker!
        </div>

        {/* Host name */}
        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            color: '#f0ede8',
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
          }}
        >
          <span style={{ color: '#d4af37' }}>{hostName}</span>
          <span style={{ fontWeight: 400, fontSize: 52 }}>&apos;s Table</span>
        </div>

        {/* Table code pill */}
        <div
          style={{
            marginTop: 28,
            padding: '14px 36px',
            background: 'rgba(212,175,55,0.12)',
            border: '2px solid rgba(212,175,55,0.5)',
            borderRadius: 48,
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: 8,
            color: '#d4af37',
            display: 'flex',
          }}
        >
          {tableId.toUpperCase()}
        </div>

        {/* CTA */}
        <div
          style={{
            marginTop: 26,
            fontSize: 26,
            color: '#a89f96',
            display: 'flex',
          }}
        >
          Tap to join — no account needed
        </div>

        {/* Domain */}
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            fontSize: 22,
            color: 'rgba(168,159,150,0.6)',
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
