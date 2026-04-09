import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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
  return {
    title: `Table ${tableId}`,
    description: `Join the Texas Hold'em table ${tableId}.`,
  };
}

export default async function TablePage({ params }: TablePageProps): Promise<React.ReactElement> {
  const { tableId } = await params;
  const table = await getTable(tableId).catch(() => null);

  if (!table) notFound();

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
