'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicTable, Table } from '@/types/game';
import { Header } from '@/components/layout/header';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { joinTable, startGame, resetGame } from '@/app/actions';
import { useTable } from '@/hooks/use-table';

interface TableLobbyProps {
  table: Table;
  currentPlayerId: string | null;
}

export function TableLobby({ table: initialTable, currentPlayerId: initialPlayerId }: TableLobbyProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialLobbyTable = initialTable as PublicTable;

  const { table, refresh } = useTable(initialTable.id, initialLobbyTable);
  const liveTable = table ?? initialLobbyTable;

  const [playerId, setPlayerId] = useState(initialPlayerId);

  useEffect(() => {
    if (liveTable.state === 'playing') {
      router.refresh();
    }
  }, [liveTable.state, router]);

  // Join form state (shown if the viewer is not yet a player)
  const [playerName, setPlayerName] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const isHost = playerId === liveTable.hostPlayerId;
  const isPlayer = playerId !== null;
  const players = Object.values(liveTable.players);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  function handleJoin(): void {
    if (!playerName.trim()) {
      setJoinError('Please enter your name.');
      return;
    }
    setJoinError(null);
    startTransition(async () => {
      const result = await joinTable(liveTable.id, playerName.trim());
      if (result.error) {
        setJoinError(result.error);
      } else if (result.data) {
        setPlayerId(result.data.playerId);
        await refresh();
      }
    });
  }

  function handleStart(): void {
    if (!playerId) return;
    startTransition(async () => {
      const result = await startGame(liveTable.id, playerId);
      if (result.error) {
        alert(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleReset(): void {
    if (!playerId) return;
    startTransition(async () => {
      const result = await resetGame(liveTable.id, playerId);
      if (result.error) {
        alert(result.error);
      } else {
        router.refresh();
      }
    });
  }

  async function handleCopyLink(): Promise<void> {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl).catch(() => null);
  }

  return (
    <>
      <Header />
      <PageContainer className="py-8 px-4">
        {/* Table header */}
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Table{' '}
              <span className="text-[var(--color-gold)] font-mono tracking-wider">
                {liveTable.id}
              </span>
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {liveTable.state === 'ended'
                ? 'Game over — the host can reset for a new game'
                : 'Waiting for players \u2014 share the code or link below'}
            </p>
          </div>
          <Badge variant="muted" className="self-start sm:self-auto">
            {players.length} / {liveTable.settings.maxPlayers} players
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Player list */}
          <section
            aria-labelledby="players-heading"
            className="lg:col-span-2 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-muted)] p-5"
          >
            <h2
              id="players-heading"
              className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4"
            >
              Players
            </h2>
            <ul className="flex flex-col gap-3">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                      aria-hidden="true"
                      className="w-9 h-9 rounded-full bg-[var(--color-felt)] flex items-center justify-center text-sm font-bold text-[var(--color-text-primary)] shrink-0"
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {p.name}
                      </span>
                      {p.id === liveTable.hostPlayerId && (
                        <span className="ml-2 text-xs text-[var(--color-gold)]">Host</span>
                      )}
                      {p.id === playerId && (
                        <span className="ml-2 text-xs text-[var(--color-text-muted)]">(you)</span>
                      )}
                    </div>
                  </div>
                  <span className="tabular-nums text-sm text-[var(--color-text-muted)]">
                    {p.chips.toLocaleString()} chips
                  </span>
                </li>
              ))}
              {players.length === 0 && (
                <li className="text-sm text-[var(--color-text-muted)] italic">
                  No players yet
                </li>
              )}
            </ul>

            {/* Start game (host only) */}
            {isHost && liveTable.state === 'waiting' && (
              <div className="mt-6 pt-4 border-t border-[var(--color-border-muted)]">
                <Button
                  variant="gold"
                  size="md"
                  isLoading={isPending}
                  disabled={players.length < 2}
                  onClick={handleStart}
                >
                  Start Game
                </Button>
                {players.length < 2 && (
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                    Need at least 2 players to start.
                  </p>
                )}
              </div>
            )}

            {/* Reset for new game (host only, game ended) */}
            {isHost && liveTable.state === 'ended' && (
              <div className="mt-6 pt-4 border-t border-[var(--color-border-muted)]">
                <p className="mb-3 text-sm text-[var(--color-text-muted)]">
                  Game over! Reset all chip stacks to {liveTable.settings.startingChips.toLocaleString()} and play again.
                </p>
                <Button
                  variant="gold"
                  size="md"
                  isLoading={isPending}
                  onClick={handleReset}
                >
                  Reset &amp; Play Again
                </Button>
              </div>
            )}

            {/* Non-host waiting message */}
            {isPlayer && !isHost && liveTable.state === 'waiting' && (
              <p className="mt-6 text-sm text-[var(--color-text-muted)] italic">
                Waiting for the host to start the game…
              </p>
            )}
          </section>

          {/* Side panel: share + join + settings */}
          <aside className="flex flex-col gap-4">
            {/* Share link */}
            <section
              aria-labelledby="share-heading"
              className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-muted)] p-5"
            >
              <h2
                id="share-heading"
                className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3"
              >
                Share
              </h2>
              <p className="text-2xl font-bold font-mono tracking-widest text-[var(--color-gold)] mb-3">
                {liveTable.id}
              </p>
              <Button variant="secondary" size="sm" onClick={handleCopyLink}>
                Copy Link
              </Button>
            </section>

            {/* Join form (for viewers who haven't joined yet) */}
            {!isPlayer && liveTable.state === 'waiting' && (
              <section
                aria-labelledby="join-heading"
                className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-muted)] p-5"
              >
                <h2
                  id="join-heading"
                  className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3"
                >
                  Join Table
                </h2>
                <div className="flex flex-col gap-3">
                  <Input
                    label="Your Name"
                    placeholder="Enter your name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    maxLength={20}
                    error={joinError ?? undefined}
                  />
                  <Button
                    variant="primary"
                    size="md"
                    isLoading={isPending}
                    onClick={handleJoin}
                  >
                    Join
                  </Button>
                </div>
              </section>
            )}

            {/* Table settings summary */}
            <section
              aria-labelledby="settings-heading"
              className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-muted)] p-5"
            >
              <h2
                id="settings-heading"
                className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3"
              >
                Settings
              </h2>
              <dl className="flex flex-col gap-2 text-sm">
                {[
                  ['Starting Chips', liveTable.settings.startingChips.toLocaleString()],
                  ['Blinds', `${liveTable.settings.smallBlind} / ${liveTable.settings.bigBlind}`],
                  ['Max Players', String(liveTable.settings.maxPlayers)],
                  ['Buy-backs', liveTable.settings.allowBuyBack ? 'Allowed' : 'Disabled'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt className="text-[var(--color-text-muted)]">{label}</dt>
                    <dd className="font-medium text-[var(--color-text-primary)] tabular-nums">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>
        </div>
      </PageContainer>
    </>
  );
}
