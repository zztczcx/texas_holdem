import { type NextRequest, NextResponse } from 'next/server';
import { getPusherServer } from '@/lib/pusher/server';
import { getSessionId } from '@/lib/utils/session';

/**
 * POST /api/pusher/auth
 *
 * Authenticates a client for Pusher presence and private channels.
 * Pusher sends: socket_id + channel_name in the POST body (form-encoded).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Retrieve the session to identify the player
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  if (channelName.startsWith('private-')) {
    // Only allow a player to subscribe to their own private channel
    const targetId = channelName.replace(/^private-player-/, '');
    if (targetId !== sessionId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const authResponse = pusher.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  }

  return NextResponse.json({ error: 'Channel not allowed' }, { status: 403 });
}
