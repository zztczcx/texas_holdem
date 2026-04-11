import { NextRequest, NextResponse } from 'next/server';
import { getTable } from '@/lib/db/kv';
import { getSessionId } from '@/lib/utils/session';
import { buildPublicTable } from '@/lib/game/state-filter';
import { getApiRatelimit } from '@/lib/utils/ratelimit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
): Promise<NextResponse> {
  // Rate limit: 120 polls per minute per IP
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const { success: rlOk } = await getApiRatelimit().limit(ip);
  if (!rlOk) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const { tableId } = await params;

  if (!tableId || tableId.length !== 6) {
    return NextResponse.json({ error: 'Invalid table ID' }, { status: 400 });
  }

  const table = await getTable(tableId);
  if (!table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
  }

  const sessionId = await getSessionId();
  const requestingPlayerId = sessionId
    ? Object.values(table.players).find((p) => p.sessionId === sessionId)?.id ?? null
    : null;

  const publicTable = buildPublicTable(table, requestingPlayerId);

  return NextResponse.json(publicTable);
}
