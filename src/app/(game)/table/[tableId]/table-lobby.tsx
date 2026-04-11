'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicTable, Table } from '@/types/game';
import { useTable } from '@/hooks/use-table';
import { useI18n } from '@/components/layout/i18n-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { joinTable, startGame, resetGame } from '@/app/actions';
import { PageContainer } from '@/components/layout/page-container';

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
  const [linkCopied, setLinkCopied] = useState(false);

  const { t } = useI18n();

  const isHost = playerId === liveTable.hostPlayerId;
  const isPlayer = playerId !== null;
  const players = Object.values(liveTable.players);
  // Always use the canonical domain — don't rely on window.location which may differ in previews
  const canonicalUrl = `https://airtexas.club/table/${liveTable.id}`;
  const shareUrl = typeof window !== 'undefined' ? canonicalUrl : canonicalUrl;

  function handleJoin(): void {
    if (!playerName.trim()) {
      setJoinError(t.lobby.enterName);
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
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <>
      <PageContainer className="py-8 px-4">
        {/* Table header */}
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {t.tableLobby.table}{' '}
              <span className="text-[var(--color-gold)] font-mono tracking-wider">
                {liveTable.id}
              </span>
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {liveTable.state === 'ended'
                ? t.tableLobby.gameEnded
                : t.tableLobby.waitingShare}
            </p>
          </div>
          <Badge variant="muted" className="self-start sm:self-auto">
            {players.length} / {liveTable.settings.maxPlayers} {t.tableLobby.players}
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
              {t.tableLobby.players}
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
                        <span className="ml-2 text-xs text-[var(--color-gold)]">{t.tableLobby.host}</span>
                      )}
                      {p.id === playerId && (
                        <span className="ml-2 text-xs text-[var(--color-text-muted)]">{t.tableLobby.you}</span>
                      )}
                    </div>
                  </div>
                  <span className="tabular-nums text-sm text-[var(--color-text-muted)]">
                    {p.chips.toLocaleString()} {t.tableLobby.chips}
                  </span>
                </li>
              ))}
              {players.length === 0 && (
                <li className="text-sm text-[var(--color-text-muted)] italic">
                  {t.tableLobby.noPlayersYet}
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
                  {t.tableLobby.startGame}
                </Button>
                {players.length < 2 && (
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                    {t.tableLobby.needMorePlayers}
                  </p>
                )}
              </div>
            )}

            {/* Reset for new game (host only, game ended) */}
            {isHost && liveTable.state === 'ended' && (
              <div className="mt-6 pt-4 border-t border-[var(--color-border-muted)]">
                <p className="mb-3 text-sm text-[var(--color-text-muted)]">
                  {t.tableLobby.gameOverResetDesc.replace('{chips}', liveTable.settings.startingChips.toLocaleString())}
                </p>
                <Button
                  variant="gold"
                  size="md"
                  isLoading={isPending}
                  onClick={handleReset}
                >
                  {t.tableLobby.resetAndPlay}
                </Button>
              </div>
            )}

            {/* Non-host waiting message */}
            {isPlayer && !isHost && liveTable.state === 'waiting' && (
              <p className="mt-6 text-sm text-[var(--color-text-muted)] italic">
                {t.tableLobby.waitingForHost}
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
                {t.tableLobby.inviteFriends}
              </h2>
              {/* Table code */}
              <p className="text-2xl font-bold font-mono tracking-widest text-[var(--color-gold)] mb-2">
                {liveTable.id}
              </p>
              {/* Full URL (truncated for display) */}
              <p className="text-xs text-[var(--color-text-muted)] font-mono break-all mb-3 select-all">
                {canonicalUrl}
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  variant={linkCopied ? 'gold' : 'secondary'}
                  size="sm"
                  onClick={() => void handleCopyLink()}
                >
                  {linkCopied ? t.tableLobby.copyLinkDone : t.tableLobby.copyLink}
                </Button>
                {/* WhatsApp share */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Join my Texas Hold'em table! ${canonicalUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border-muted)] bg-[#25d366]/10 px-3 py-2 text-sm font-medium text-[#25d366] hover:bg-[#25d366]/20 transition-colors"
                  aria-label="Share via WhatsApp"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  {t.tableLobby.shareWhatsApp}
                </a>
              </div>
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
                  {t.tableLobby.joinThisTable}
                </h2>
                <div className="flex flex-col gap-3">
                  <Input
                    label={t.tableLobby.yourName}
                    placeholder={t.tableLobby.enterYourName}
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
                    {t.tableLobby.join}
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
                {t.tableLobby.settings}
              </h2>
              <dl className="flex flex-col gap-2 text-sm">
                {[
                  [t.tableLobby.startingChips, liveTable.settings.startingChips.toLocaleString()],
                  [t.tableLobby.blinds, `${liveTable.settings.smallBlind} / ${liveTable.settings.bigBlind}`],
                  [t.tableLobby.maxPlayers, String(liveTable.settings.maxPlayers)],
                  [t.tableLobby.buyBack, liveTable.settings.allowBuyBack ? t.tableLobby.allowed : t.tableLobby.disabled],
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
