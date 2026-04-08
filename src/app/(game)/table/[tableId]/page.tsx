import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTable } from '@/lib/db/kv';
import { getSessionId } from '@/lib/utils/session';
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

  // Show game view when game is in progress
  if (table.state === 'playing' && table.gameState) {
    return (
      <TableGameView
        table={table}
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
