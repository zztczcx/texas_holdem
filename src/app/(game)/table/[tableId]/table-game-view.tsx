'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { buyBack, performAction } from '@/app/actions';
import { cn } from '@/lib/utils/cn';
import { ActionBar } from '@/components/game/action-bar';
import { CardBack } from '@/components/game/card-back';
import { CommunityCards } from '@/components/game/community-cards';
import { GameEndScreen } from '@/components/game/game-end-screen';
import { HandResult } from '@/components/game/hand-result';
import { PlayerRow, type PlayerRowActionBadge } from '@/components/game/player-row';
import { PlayingCard } from '@/components/game/playing-card';
import { TurnTimer } from '@/components/game/turn-timer';
import { Button } from '@/components/ui/button';
import { ToastContainer, useToast } from '@/components/ui/toast';
import { useGameState } from '@/hooks/use-game-state';
import { useSounds } from '@/hooks/use-sounds';
import { useI18n } from '@/components/layout/i18n-provider';
import type { Dictionary } from '@/i18n/dictionaries';
import type {
  ActionType,
  FilteredGameState,
  HandEndResult,
  HandResult as PokerHandResult,
  PlayerAction,
  Table,
} from '@/types/game';

interface TableGameViewProps {
  table: Table;
  currentPlayerId: string | null;
}

type PlayerActionHistory = Record<number, Record<string, PlayerRowActionBadge>>;
// Tracks cumulative chips wagered per player per hand (across all betting rounds)
type CumulativeBets = Record<number, Record<string, number>>;

// Deterministic animal emoji per seat — mirrors player-row.tsx
const AVATAR_ANIMALS_TABLE = ['🦊', '🐻', '🐯', '🦁', '🐼', '🐺', '🦝', '🦅', '🦉'] as const;

/**
 * The in-game view: top board strip, scrollable player list, and sticky action footer.
 */
export function TableGameView({ table: initialTable, currentPlayerId }: TableGameViewProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const { t } = useI18n();
  const [dismissedHandNumber, setDismissedHandNumber] = useState<number | null>(null);
  const [actionHistoryByHand, setActionHistoryByHand] = useState<PlayerActionHistory>({});
  const [cumulativeBetsByHand, setCumulativeBetsByHand] = useState<CumulativeBets>({});
  const { toasts, addToast, dismissToast } = useToast();
  const previousGameStateRef = useRef<FilteredGameState | null>(null);
  const processedActionKeyRef = useRef<string | null>(null);
  const { play: playSound } = useSounds();

  const initialGameState = initialTable.gameState
    ? { ...initialTable.gameState, deck: null as null }
    : null;

  const {
    tableState: liveTableState,
    gameState,
    livePlayers,
    handEndResult,
    refresh,
    applySnapshot,
    applyHandEndResult,
  } = useGameState(
    initialTable.id,
    currentPlayerId,
    initialTable.state,
    initialTable.revision,
    initialGameState,
    initialTable.players,
  );

  const liveGameState = gameState;
  const isGameEnded = liveTableState === 'ended';
  const activeHandEndResult =
    handEndResult && handEndResult.handNumber !== dismissedHandNumber
      ? handEndResult
      : null;
  const isShowingHandResult = Boolean(activeHandEndResult);
  const knownPlayers = { ...initialTable.players, ...livePlayers };

  // Play win/lose sound when hand result arrives
  const prevHandEndResultRef = useRef<HandEndResult | null>(null);
  useEffect(() => {
    if (!handEndResult || handEndResult === prevHandEndResultRef.current) return;
    prevHandEndResultRef.current = handEndResult;
    const isWinner = currentPlayerId
      ? handEndResult.winners.some((w) => w.playerId === currentPlayerId)
      : false;
    if (isWinner) playSound('win');
  }, [handEndResult, currentPlayerId, playSound]);

  useEffect(() => {
    if (!liveGameState) {
      previousGameStateRef.current = null;
      return;
    }

    const action = liveGameState.lastAction;
    if (!action) {
      previousGameStateRef.current = liveGameState;
      return;
    }

    const actionKey = [
      liveGameState.handNumber,
      action.playerId,
      action.type,
      action.timestamp,
    ].join(':');

    if (processedActionKeyRef.current !== actionKey) {
      // Play a sound for every action we observe from any player
      switch (action.type) {
        case 'fold':   playSound('fold');   break;
        case 'check':  playSound('check');  break;
        case 'call':   playSound('chip');   break;
        case 'raise':  playSound('raise');  break;
        case 'allIn':  playSound('allIn');  break;
      }

      // Play deal sound when community cards first appear
      const prevCards = previousGameStateRef.current?.communityCards?.length ?? 0;
      const nextCards = liveGameState.communityCards?.length ?? 0;
      if (nextCards > prevCards) {
        playSound('deal');
      }

      const nextBadge = buildPlayerActionBadge(action, previousGameStateRef.current, liveGameState, t);
      setActionHistoryByHand((currentHistory) => pruneActionHistory({
        ...currentHistory,
        [liveGameState.handNumber]: {
          ...(currentHistory[liveGameState.handNumber] ?? {}),
          [action.playerId]: nextBadge,
        },
      }));

      // Accumulate total chips wagered this hand per player
      const betNow = liveGameState.bettingRound.bets[action.playerId] ?? 0;
      const betBefore = previousGameStateRef.current?.bettingRound.bets[action.playerId] ?? 0;
      const betThisAction = Math.max(0, betNow - betBefore);
      if (betThisAction > 0) {
        setCumulativeBetsByHand((prev) => {
          const handBets = prev[liveGameState.handNumber] ?? {};
          return {
            ...prev,
            [liveGameState.handNumber]: {
              ...handBets,
              [action.playerId]: (handBets[action.playerId] ?? 0) + betThisAction,
            },
          };
        });
      }

      processedActionKeyRef.current = actionKey;
    }

    previousGameStateRef.current = liveGameState;
  }, [liveGameState, playSound, t]);

  const currentPlayer = currentPlayerId ? (livePlayers[currentPlayerId] ?? null) : null;
  const activePlayerId = getActivePlayerId(livePlayers, liveGameState);
  const isMyTurn =
    !isPending &&
    !isShowingHandResult &&
    !!currentPlayer &&
    !!liveGameState &&
    activePlayerId === currentPlayer.id &&
    currentPlayer.status === 'active';

  const displayPlayerIds = activeHandEndResult
    ? Object.keys(activeHandEndResult.playerChips)
    : Object.keys(livePlayers);
  const orderedPlayers = displayPlayerIds
    .map((playerId) => knownPlayers[playerId] ?? livePlayers[playerId])
    .filter((player): player is Table['players'][string] => Boolean(player))
    .sort((leftPlayer, rightPlayer) => leftPlayer.seatIndex - rightPlayer.seatIndex);
  const playerNames = Object.fromEntries(
    Object.values({ ...knownPlayers, ...livePlayers }).map((player) => [player.id, player.name]),
  );
  const winnerIds = new Set(activeHandEndResult?.winners.map((winner) => winner.playerId) ?? []);
  const isCurrentPlayerWinner = currentPlayerId ? winnerIds.has(currentPlayerId) : false;
  const currentPlayerWinAmount = currentPlayerId
    ? activeHandEndResult?.winners.find((w) => w.playerId === currentPlayerId)?.amount ?? 0
    : 0;
  const displayHandNumber = activeHandEndResult?.handNumber ?? liveGameState?.handNumber ?? null;
  const displayCommunityCards = activeHandEndResult?.communityCards ?? liveGameState?.communityCards ?? [];
  const displayPot = activeHandEndResult?.pot ?? liveGameState?.pot ?? 0;
  const displayRoundLabel = activeHandEndResult ? t.game.showdown : formatRoundLabel(liveGameState?.stage, t);
  const displayBestHand = getDisplayHandResult(liveGameState, activeHandEndResult, currentPlayerId);
  const displayActionHistory = displayHandNumber ? actionHistoryByHand[displayHandNumber] ?? {} : {};
  const displayCurrentPlayerChips = currentPlayerId
    ? activeHandEndResult?.playerChips[currentPlayerId] ?? currentPlayer?.chips ?? 0
    : currentPlayer?.chips ?? 0;
  const showBuyBack = Boolean(
    activeHandEndResult &&
    currentPlayerId &&
    initialTable.settings.allowBuyBack &&
    displayCurrentPlayerChips === 0,
  );

  // Derive last-action announcement data (null when hand result shown, or no action yet)
  const lastActionData = (() => {
    if (activeHandEndResult || !liveGameState?.lastAction) return null;
    const action = liveGameState.lastAction;
    const player = livePlayers[action.playerId] ?? null;
    const badge = displayHandNumber != null
      ? (actionHistoryByHand[displayHandNumber]?.[action.playerId] ?? null)
      : null;
    if (!player || !badge) return null;
    return { action, player, badge };
  })();

  async function handleAction(type: ActionType, amount?: number): Promise<void> {
    if (!currentPlayerId || isPending) return;

    startTransition(async () => {
      const result = await performAction(initialTable.id, currentPlayerId, {
        type,
        playerId: currentPlayerId,
        amount,
        timestamp: Date.now(),
      });
      if (result.error) {
        addToast({ message: result.error, variant: 'danger' });
      } else {
        if (result.data?.snapshot) {
          applySnapshot(result.data.snapshot);
        } else {
          await refresh();
        }

        if (result.data?.handEndResult) {
          applyHandEndResult(result.data.handEndResult);
        }
      }
    });
  }

  function handleNextHand(): void {
    if (!activeHandEndResult) {
      return;
    }

    setDismissedHandNumber(activeHandEndResult.handNumber);
    void refresh();
  }

  async function handleBuyBack(): Promise<void> {
    if (!currentPlayerId) return;

    const result = await buyBack(initialTable.id, currentPlayerId);
    if (result.error) {
      addToast({ message: result.error, variant: 'danger' });
    } else {
      addToast({ message: t.game.boughtBack, variant: 'success' });
    }
  }

  function handleTimerExpire(): void {
    void handleAction('fold');
    addToast({ message: t.game.timeout, variant: 'danger' });
  }

  if (!liveGameState && !isGameEnded) {
    return (
      <>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <p className="text-lg text-[var(--color-text-muted)]">{t.game.loading}</p>
        </div>
      </>
    );
  }

  return (
    <>
      {liveGameState && (
        <main className="h-[calc(100dvh-3.75rem)] bg-[radial-gradient(circle_at_top,var(--color-felt)_0%,var(--color-felt-dark)_42%,var(--color-canvas)_100%)] px-3 py-3 sm:px-4 sm:py-4 md:h-[calc(100dvh-4.25rem)] md:px-6">
          <section className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-[var(--color-border)] bg-[var(--color-surface)]/94 shadow-[0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            <div className="shrink-0 border-b border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(45,106,79,0.72),rgba(26,61,43,0.88))] px-3 py-3 sm:px-5 sm:py-5">
              <div className="flex flex-col gap-3">
                <div className="overflow-x-auto">
                  <CommunityCards
                    cards={displayCommunityCards}
                    className="min-w-max rounded-[20px] border border-[var(--color-border)] bg-[var(--color-felt-dark)]/72 px-3 py-3"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)]/92 px-4 py-3">
                  <div
                    aria-hidden="true"
                    className="relative h-10 w-10 shrink-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,#f4d998,#d4af37_58%,#a8770f_100%)] shadow-[0_6px_14px_rgba(0,0,0,0.24)]"
                  >
                    <span className="absolute inset-[18%] rounded-full border-2 border-dashed border-[#f5e7bc]/70" />
                    <span className="absolute inset-[34%] rounded-full bg-[#fff7df]/70" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                      {t.game.pot}
                    </p>
                    <p className="text-2xl font-semibold tabular-nums text-[var(--color-text-primary)] sm:text-3xl">
                      {formatCurrency(displayPot)}
                    </p>
                  </div>

                  {displayBestHand && (
                    <HandResult
                      rank={displayBestHand.rank}
                      description={displayBestHand.rankName}
                      isWinner={isCurrentPlayerWinner}
                      className="order-3 w-full border-[var(--color-border)] bg-[var(--color-surface)] sm:order-none sm:w-auto"
                    />
                  )}

                  <div className="ml-auto flex items-center gap-3 sm:gap-4">
                    {isMyTurn && initialTable.settings.turnTimerSeconds > 0 && (
                      <TurnTimer
                        totalSeconds={initialTable.settings.turnTimerSeconds}
                        isActive={isMyTurn}
                        onExpire={handleTimerExpire}
                        className="shrink-0"
                      />
                    )}
                    <span className="text-lg font-medium uppercase tracking-[0.18em] text-[var(--color-text-muted)] sm:text-xl">
                      {displayRoundLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto bg-[linear-gradient(180deg,rgba(20,38,26,0.94),rgba(13,27,18,0.98))] px-3 py-3 sm:px-5 sm:py-5">
                {/* Last-action announcement banner */}
                {lastActionData && (
                  <div
                    key={lastActionData.action.timestamp}
                    className={cn(
                      'mb-3 flex items-center gap-3 rounded-2xl border px-4 py-2.5 animate-action-announce',
                      lastActionData.badge.tone === 'raise' || lastActionData.badge.tone === 'all-in'
                        ? 'border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 shadow-[0_0_20px_rgba(212,175,55,0.2)]'
                        : lastActionData.badge.tone === 'danger'
                          ? 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/8'
                          : 'border-[var(--color-border-muted)] bg-[var(--color-border-muted)]/30',
                    )}
                  >
                    <span className="shrink-0 text-xl leading-none" aria-hidden="true">
                      {AVATAR_ANIMALS_TABLE[lastActionData.player.seatIndex % AVATAR_ANIMALS_TABLE.length]}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-muted)]">
                      {lastActionData.player.name}
                    </span>
                    <span
                      className={cn(
                        'ml-auto text-sm font-bold uppercase tracking-[0.14em]',
                        lastActionData.badge.tone === 'raise' || lastActionData.badge.tone === 'all-in'
                          ? 'text-[var(--color-gold)]'
                          : lastActionData.badge.tone === 'danger'
                            ? 'text-[var(--color-danger)]'
                            : 'text-[var(--color-text-muted)]',
                      )}
                    >
                      {lastActionData.badge.label}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {orderedPlayers.map((player) => {
                    const resultHand = activeHandEndResult?.playerHands[player.id];
                    const liveHand = liveGameState.playerHands[player.id];
                    const displayStack = activeHandEndResult?.playerChips[player.id] ?? livePlayers[player.id]?.chips ?? player.chips;
                    const isDimmed = activeHandEndResult
                      ? !winnerIds.has(player.id)
                      : player.status === 'folded' || player.status === 'disconnected' || player.status === 'sitOut';
                    // At showdown, reveal cards for all players who reached it (not folders)
                    const showHoleCards = activeHandEndResult
                      ? resultHand?.holeCards != null
                      : currentPlayerId === player.id;
                    const currentRoundBet = activeHandEndResult
                      ? undefined
                      : (displayHandNumber != null ? cumulativeBetsByHand[displayHandNumber]?.[player.id] : undefined);
                    const playerRole = getPlayerRole(player.seatIndex, liveGameState);

                    return (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        stack={displayStack}
                        isSelf={player.id === currentPlayerId}
                        isActive={!activeHandEndResult && player.id === activePlayerId}
                        isWinner={winnerIds.has(player.id)}
                        isDimmed={isDimmed}
                        isDealer={playerRole.isDealer}
                        isSmallBlind={playerRole.isSmallBlind}
                        isBigBlind={playerRole.isBigBlind}
                        currentRoundBet={currentRoundBet}
                        actionBadge={displayActionHistory[player.id] ?? null}
                        holeCards={resultHand?.holeCards ?? liveHand?.holeCards ?? null}
                        showHoleCards={showHoleCards}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Showdown bottom sheet — all users (players + observers).
                  Per Texas Hold'em rules: all players who didn't fold must show hole cards. */}
              {activeHandEndResult && (
                <div
                  key={activeHandEndResult.handNumber}
                  className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up"
                >
                  {/* Gradient scrim above the sheet */}
                  <div className="pointer-events-none absolute bottom-full left-0 right-0 h-28 bg-gradient-to-t from-[rgba(13,27,18,0.85)] to-transparent" />

                  <div
                    className={cn(
                      'relative max-h-[72vh] overflow-y-auto rounded-t-[28px] border-t shadow-[0_-16px_48px_rgba(0,0,0,0.72)]',
                      isCurrentPlayerWinner
                        ? 'border-[var(--color-gold)]/35 bg-gradient-to-b from-[var(--color-felt-dark)] to-[var(--color-surface)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)]',
                    )}
                  >
                    {/* Drag handle */}
                    <div className="flex justify-center pb-1 pt-3">
                      <div className="h-1 w-10 rounded-full bg-[var(--color-border)]" />
                    </div>

                    {/* Result headline */}
                    <div className="px-5 pb-4 pt-1 text-center">
                      {currentPlayerId ? (
                        isCurrentPlayerWinner ? (
                          <>
                            <p className="text-3xl select-none" aria-hidden="true">🏆</p>
                            <h2 className="mt-1 text-xl font-bold text-[var(--color-gold)]">{t.game.youWon}</h2>
                            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                              {t.game.youTook}{' '}
                              <span className="font-semibold text-[var(--color-gold)]">
                                {formatCurrency(currentPlayerWinAmount)}
                              </span>
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-3xl select-none" aria-hidden="true">🃏</p>
                            <h2 className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">
                              {t.game.betterLuck}
                            </h2>
                            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                              {formatWinnersText(activeHandEndResult, playerNames, t)}
                            </p>
                          </>
                        )
                      ) : (
                        <>
                          <p className="text-3xl select-none" aria-hidden="true">🃏</p>
                          <h2 className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">
                            {t.game.handComplete.replace('{n}', String(activeHandEndResult.handNumber))}
                          </h2>
                          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                            {formatWinnersText(activeHandEndResult, playerNames, t)}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Card reveal — who showed what (Texas Hold'em showdown rules) */}
                    <div className="px-4 pb-3 sm:px-5">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                        {t.game.showdown}
                      </p>
                      <div className="flex flex-col gap-2">
                        {orderedPlayers.map((player) => {
                          const pHand = activeHandEndResult.playerHands[player.id];
                          const isWinnerRow = winnerIds.has(player.id);
                          const winAmount = activeHandEndResult.winners.find((w) => w.playerId === player.id)?.amount;
                          const hasFolded = !pHand?.holeCards;
                          const animalEmoji = AVATAR_ANIMALS_TABLE[player.seatIndex % AVATAR_ANIMALS_TABLE.length];

                          return (
                            <div
                              key={player.id}
                              className={cn(
                                'flex items-center gap-3 rounded-2xl border px-3 py-2.5',
                                isWinnerRow
                                  ? 'border-[var(--color-gold)]/35 bg-[var(--color-gold)]/8 shadow-[0_0_12px_rgba(212,175,55,0.12)]'
                                  : hasFolded
                                    ? 'border-[var(--color-border-muted)] bg-[var(--color-canvas)]/30 opacity-50'
                                    : 'border-[var(--color-border-muted)] bg-[var(--color-canvas)]/50',
                              )}
                            >
                              <span className="shrink-0 text-xl leading-none" aria-hidden="true">
                                {animalEmoji}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-1.5">
                                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                    {player.name}
                                  </p>
                                  {player.id === currentPlayerId && (
                                    <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{t.game.you}</span>
                                  )}
                                  {isWinnerRow && winAmount != null && (
                                    <span className="ml-auto shrink-0 text-sm font-bold text-[var(--color-gold)]">
                                      +{formatCurrency(winAmount)}
                                    </span>
                                  )}
                                </div>
                                {pHand?.bestHand ? (
                                  <p className="text-xs text-[var(--color-gold)]/80">{translateHandRank(pHand.bestHand.rankName, t)}</p>
                                ) : hasFolded ? (
                                  <p className="text-xs italic text-[var(--color-text-muted)]/60">{t.game.folded}</p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 gap-1">
                                {pHand?.holeCards ? (
                                  <>
                                    <PlayingCard card={pHand.holeCards[0]} size="sm" />
                                    <PlayingCard card={pHand.holeCards[1]} size="sm" />
                                  </>
                                ) : (
                                  <>
                                    <CardBack size="sm" className="opacity-30" />
                                    <CardBack size="sm" className="opacity-30" />
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="sticky bottom-0 flex flex-col gap-2 border-t border-[var(--color-border-muted)] bg-[var(--color-surface)]/98 px-4 py-4 backdrop-blur-sm sm:px-5">
                      {showBuyBack && (
                        <Button variant="gold" size="sm" onClick={() => void handleBuyBack()}>
                          {t.game.buyBackIn}
                        </Button>
                      )}
                      <Button variant="primary" size="sm" onClick={() => void handleNextHand()}>
                        {t.game.nextHand}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isMyTurn && currentPlayer && !activeHandEndResult && (
              <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)]/96 px-3 py-3 sm:px-5 sm:py-4">
                <ActionBar
                  player={currentPlayer}
                  gameState={liveGameState}
                  settings={initialTable.settings}
                  onAction={handleAction}
                  className="border-0 bg-transparent p-0 shadow-none"
                />
              </div>
            )}
          </section>
        </main>
      )}

      {isGameEnded && (
        <GameEndScreen
          players={livePlayers}
          winnerPlayerId={Object.values(livePlayers).find((player) => player.chips > 0)?.id ?? null}
          tableId={initialTable.id}
          finalGameState={handEndResult
            ? {
                communityCards: handEndResult.communityCards,
                playerHands: handEndResult.playerHands,
              }
            : null}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

function getActivePlayerId(
  players: Table['players'],
  gameState: FilteredGameState | null,
): string | null {
  if (!gameState) {
    return null;
  }

  return Object.values(players).find((player) => player.seatIndex === gameState.currentSeatIndex)?.id ?? null;
}

function buildPlayerActionBadge(
  action: PlayerAction,
  previousState: FilteredGameState | null,
  currentState: FilteredGameState,
  t: Dictionary,
): PlayerRowActionBadge {
  const previousBet = previousState?.bettingRound.bets[action.playerId] ?? 0;
  const currentBet = currentState.bettingRound.bets[action.playerId] ?? 0;
  const committed = Math.max(0, currentBet - previousBet);
  const key = `${action.timestamp}:${action.playerId}`;

  switch (action.type) {
    case 'check':
      return { label: t.game.badge.check, tone: 'neutral', key };
    case 'call':
      return { label: `${t.game.badge.call} ${formatCurrency(committed || (action.amount ?? 0))}`, tone: 'call', key };
    case 'raise': {
      const verb = (previousState?.currentBet ?? 0) === 0 ? t.game.badge.bet : t.game.badge.raise;
      const amount = committed || action.amount || currentBet;
      return { label: `${verb} ${formatCurrency(amount)}`, tone: 'raise', key };
    }
    case 'allIn':
      return { label: t.game.badge.allIn, tone: 'all-in', key };
    case 'fold':
      return { label: t.game.badge.fold, tone: 'danger', key };
  }

  return { label: t.game.badge.check, tone: 'neutral', key };
}

function pruneActionHistory(history: PlayerActionHistory): PlayerActionHistory {
  const handNumbers = Object.keys(history)
    .map((handNumber) => Number(handNumber))
    .sort((leftHand, rightHand) => rightHand - leftHand)
    .slice(0, 3);

  return Object.fromEntries(
    handNumbers.map((handNumber) => [handNumber, history[handNumber] ?? {}]),
  );
}

function formatRoundLabel(stage: FilteredGameState['stage'] | undefined, t: Dictionary): string {
  switch (stage) {
    case 'pre-flop': return t.game.roundLabel.preFlop;
    case 'flop':     return t.game.roundLabel.flop;
    case 'turn':     return t.game.roundLabel.turn;
    case 'river':    return t.game.roundLabel.river;
    case 'showdown': return t.game.roundLabel.showdown;
    default:         return t.game.roundLabel.live;
  }
}

function getDisplayHandResult(
  gameState: FilteredGameState | null,
  handEndResult: HandEndResult | null,
  currentPlayerId: string | null,
): PokerHandResult | null {
  if (handEndResult) {
    // Prefer showing the current player's OWN best hand so they understand their result.
    // bestHand is populated for all non-folded players by computeHandEnd.
    if (currentPlayerId) {
      const myHand = handEndResult.playerHands[currentPlayerId]?.bestHand;
      if (myHand) return myHand;
    }
    // Fallback: observer or folded player — show winner's hand
    return handEndResult.winners.find((winner) => winner.hand)?.hand ?? null;
  }

  if (!gameState) {
    return null;
  }

  const currentPlayerHand = currentPlayerId ? gameState.playerHands[currentPlayerId]?.bestHand : undefined;
  if (currentPlayerHand) {
    return currentPlayerHand;
  }

  return Object.values(gameState.playerHands).find((hand) => hand?.bestHand)?.bestHand ?? null;
}

function formatWinnersText(result: HandEndResult, playerNames: Record<string, string>, t: Dictionary): string {
  const winners = result.winners.map((winner) => playerNames[winner.playerId] ?? 'Unknown');
  if (winners.length === 0) return '';
  if (winners.length === 1) {
    return t.game.winsText
      .replace('{name}', winners[0]!)
      .replace('{amount}', formatCurrency(result.winners[0]?.amount ?? result.pot));
  }
  return t.game.splitText
    .replace('{names}', winners.join(' & '))
    .replace('{amount}', formatCurrency(result.pot));
}

function translateHandRank(rankName: string, t: Dictionary): string {
  return (t.game.handRanks as Record<string, string>)[rankName] ?? rankName;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

interface PlayerRole {
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
}

function getPlayerRole(seatIndex: number, gameState: FilteredGameState): PlayerRole {
  return {
    isDealer: seatIndex === gameState.dealerSeatIndex,
    isSmallBlind: seatIndex === gameState.smallBlindSeatIndex,
    isBigBlind: seatIndex === gameState.bigBlindSeatIndex,
  };
}
