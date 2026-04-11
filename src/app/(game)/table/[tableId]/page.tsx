import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { Table } from '@/types/game';
import { getTable } from '@/lib/db/kv';
import { getSessionId } from '@/lib/utils/session';
import { filterGameStateForPlayer } from '@/lib/game/state-filter';
import { TableLobby } from './table-lobby';
import { TableGameView } from './table-game-view';

interface TablePageProps {
  params: Promise<{ tableId: string }>;
}

export async function generateMetadata({ params }: TablePageProps): Promise<Metadata> {
  const { tableId } = await params;

  // Best-effort fetch — fall back to generic meta if KV unavailable
  let hostName: string | null = null;
  try {
    const table = await getTable(tableId).catch(() => null);
    if (table) {
      hostName = table.players[table.hostPlayerId]?.name ?? null;
    }
  } catch {
    // ignore
  }

  const title = hostName
    ? `${hostName}'s Poker Table — Join Now 🃏`
    : `Table ${tableId} — Texas Hold'em`;

  const description = hostName
    ? `${hostName} invited you to play Texas Hold'em. Table ${tableId.toUpperCase()} — no account needed.`
    : `Join the Texas Hold'em table ${tableId.toUpperCase()}. No account required.`;

  return {
    title,
    description,
    // Private tables must not appear in search results
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://airtexas.club/table/${tableId}`,
      siteName: "Texas Hold'em — airtexas.club",
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function TablePage({ params }: TablePageProps): Promise<React.ReactElement> {
  const { tableId } = await params;
  const table = await getTable(tableId).catch(() => null);

  if (!table) redirect('/?expired=1');

  const sessionId = await getSessionId();
  const currentPlayerId =
    sessionId
      ? Object.values(table.players).find((p) => p.sessionId === sessionId)?.id ?? null
      : null;

  // Show game view when game is in progress.
  // Filter the game state before passing to the client: the current player sees
  // their own hole cards; all other players' hole cards and the deck are hidden.
  if (table.state === 'playing' && table.gameState) {
    const filteredGameState = filterGameStateForPlayer(table.gameState, currentPlayerId);
    const safeTable = { ...table, gameState: filteredGameState } as unknown as Table;
    return (
      <TableGameView
        table={safeTable}
        currentPlayerId={currentPlayerId}
      />
    );
  }

  return (
    <TableLobby
      table={table}
      currentPlayerId={currentPlayerId}
    />
  );
}
