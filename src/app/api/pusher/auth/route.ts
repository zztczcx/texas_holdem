import { type NextRequest, NextResponse } from 'next/server';
import { getPusherServer } from '@/lib/pusher/server';
import { getOrCreateSessionId } from '@/lib/utils/session';
import { getSession } from '@/lib/db/kv';

/**
 * POST /api/pusher/auth
 *
 * Authenticates a client for Pusher presence and private channels.
 * Pusher sends: socket_id + channel_name in the POST body (form-encoded).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Ensure every viewer has a stable session so anonymous spectators can
  // subscribe to presence channels before joining the table.
  const sessionId = await getOrCreateSessionId();

  // Pusher sends the auth request as form-encoded body
  const body = await request.text();
  const params = new URLSearchParams(body);
  const socketId = params.get('socket_id');
  const channelName = params.get('channel_name');

  if (!socketId || !channelName) {
    return NextResponse.json(
      { error: 'Missing socket_id or channel_name' },
      { status: 400 },
    );
  }

  const pusher = getPusherServer();

  // For presence channels, include user data
  if (channelName.startsWith('presence-')) {
    const authResponse = pusher.authorizeChannel(socketId, channelName, {
      user_id: sessionId,
      user_info: { sessionId },
    });
    return NextResponse.json(authResponse);
  }

  // For private channels (e.g. private-player-{playerId})
  if (channelName.startsWith('private-player-')) {
    // Look up the player ID stored for this session in Redis.
    // The channel name embeds the playerId (UUID assigned on join), which is
    // different from sessionId, so we must resolve via the session record.
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 403 });
    }

    const targetPlayerId = channelName.replace(/^private-player-/, '');
    if (targetPlayerId !== session.playerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const authResponse = pusher.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  }

  return NextResponse.json({ error: 'Channel not allowed' }, { status: 403 });
}
