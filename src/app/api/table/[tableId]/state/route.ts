import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/lib/db/kv';
import { getSessionId } from '@/lib/utils/session';
import { filterGameStateForPlayer } from '@/lib/game/state-filter';
import type { Player } from '@/types/game';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
): Promise<NextResponse> {
  const { tableId } = await params;

  if (!tableId || tableId.length !== 6) {
    return NextResponse.json({ error: 'Invalid table ID' }, { status: 400 });
  }

  const table = await getTable(tableId);
  if (!table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
  }

  if (!table.gameState) {
    return NextResponse.json({ error: 'No active game' }, { status: 404 });
  }

  const sessionId = await getSessionId();
  const requestingPlayerId = sessionId
    ? Object.values(table.players as Record<string, Player>).find((p) => p.sessionId === sessionId)?.id ?? null
    : null;

  const filteredState = filterGameStateForPlayer(table.gameState, requestingPlayerId);

  return NextResponse.json(filteredState);
}
