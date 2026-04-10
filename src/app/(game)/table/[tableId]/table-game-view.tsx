'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { buyBack, performAction } from '@/app/actions';
import { ActionBar } from '@/components/game/action-bar';
import { CommunityCards } from '@/components/game/community-cards';
import { GameEndScreen } from '@/components/game/game-end-screen';
import { HandResult } from '@/components/game/hand-result';
import { PlayerRow, type PlayerRowActionBadge } from '@/components/game/player-row';
import { TurnTimer } from '@/components/game/turn-timer';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { ToastContainer, useToast } from '@/components/ui/toast';
import { useGameState } from '@/hooks/use-game-state';
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

/**
 * The in-game view: top board strip, scrollable player list, and sticky action footer.
 */
export function TableGameView({ table: initialTable, currentPlayerId }: TableGameViewProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const [dismissedHandNumber, setDismissedHandNumber] = useState<number | null>(null);
  const [actionHistoryByHand, setActionHistoryByHand] = useState<PlayerActionHistory>({});
  const { toasts, addToast, dismissToast } = useToast();
  const previousGameStateRef = useRef<FilteredGameState | null>(null);
  const processedActionKeyRef = useRef<string | null>(null);

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
      const nextBadge = buildPlayerActionBadge(action, previousGameStateRef.current, liveGameState);
      setActionHistoryByHand((currentHistory) => pruneActionHistory({
        ...currentHistory,
        [liveGameState.handNumber]: {
          ...(currentHistory[liveGameState.handNumber] ?? {}),
          [action.playerId]: nextBadge,
        },
      }));
      processedActionKeyRef.current = actionKey;
    }

    previousGameStateRef.current = liveGameState;
  }, [liveGameState]);

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
  const displayHandNumber = activeHandEndResult?.handNumber ?? liveGameState?.handNumber ?? null;
  const displayCommunityCards = activeHandEndResult?.communityCards ?? liveGameState?.communityCards ?? [];
  const displayPot = activeHandEndResult?.pot ?? liveGameState?.pot ?? 0;
  const displayRoundLabel = activeHandEndResult ? 'Showdown' : formatRoundLabel(liveGameState?.stage);
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
      addToast({ message: 'Bought back in!', variant: 'success' });
    }
  }

  function handleTimerExpire(): void {
    void handleAction('fold');
    addToast({ message: 'Time out - you were automatically folded.', variant: 'danger' });
  }

  if (!liveGameState && !isGameEnded) {
    return (
      <>
        <Header />
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <p className="text-lg text-[var(--color-text-muted)]">Loading game...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
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
                      Pot
                    </p>
                    <p className="text-2xl font-semibold tabular-nums text-[var(--color-text-primary)] sm:text-3xl">
                      {formatCurrency(displayPot)}
                    </p>
                  </div>

                  {displayBestHand && (
                    <HandResult
                      rank={displayBestHand.rank}
                      description={displayBestHand.rankName}
                      isWinner={Boolean(activeHandEndResult)}
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

            <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(20,38,26,0.94),rgba(13,27,18,0.98))] px-3 py-3 sm:px-5 sm:py-5">
              <div className="flex flex-col gap-3">
                {orderedPlayers.map((player) => {
                  const resultHand = activeHandEndResult?.playerHands[player.id];
                  const liveHand = liveGameState.playerHands[player.id];
                  const showWinnerCards = Boolean(activeHandEndResult && winnerIds.has(player.id));
                  const showOwnCards = !activeHandEndResult && currentPlayerId === player.id;
                  const displayStack = activeHandEndResult?.playerChips[player.id] ?? livePlayers[player.id]?.chips ?? player.chips;
                  const isDimmed = activeHandEndResult
                    ? !winnerIds.has(player.id)
                    : player.status === 'folded' || player.status === 'disconnected' || player.status === 'sitOut';

                  return (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      stack={displayStack}
                      isSelf={player.id === currentPlayerId}
                      isActive={!activeHandEndResult && player.id === activePlayerId}
                      isWinner={winnerIds.has(player.id)}
                      isDimmed={isDimmed}
                      actionBadge={displayActionHistory[player.id] ?? null}
                      holeCards={activeHandEndResult ? resultHand?.holeCards ?? null : liveHand?.holeCards ?? null}
                      showHoleCards={showWinnerCards || showOwnCards}
                    />
                  );
                })}
              </div>
            </div>

            {activeHandEndResult && (
              <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)]/96 px-3 py-3 sm:px-5 sm:py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {formatWinnersText(activeHandEndResult, playerNames)}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]/80">
                      Hand #{activeHandEndResult.handNumber} complete
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {showBuyBack && (
                      <Button variant="gold" size="sm" onClick={() => void handleBuyBack()}>
                        Buy Back In
                      </Button>
                    )}
                    <Button variant="primary" size="sm" onClick={() => void handleNextHand()}>
                      Next Hand
                    </Button>
                  </div>
                </div>
              </div>
            )}

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
): PlayerRowActionBadge {
  const previousBet = previousState?.bettingRound.bets[action.playerId] ?? 0;
  const currentBet = currentState.bettingRound.bets[action.playerId] ?? 0;
  const committed = Math.max(0, currentBet - previousBet);

  switch (action.type) {
    case 'check':
      return { label: 'CHECK', tone: 'neutral' };
    case 'call':
      return { label: `CALL ${formatCurrency(committed || currentBet)}`, tone: 'call' };
    case 'raise': {
      const verb = (previousState?.currentBet ?? 0) === 0 ? 'BET' : 'RAISE';
      const amount = committed || action.amount || currentBet;
      return { label: `${verb} ${formatCurrency(amount)}`, tone: 'raise' };
    }
    case 'allIn':
      return { label: 'ALL-IN', tone: 'all-in' };
    case 'fold':
      return { label: 'FOLD', tone: 'danger' };
  }

  return { label: 'ACTION', tone: 'neutral' };
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

function formatRoundLabel(stage: FilteredGameState['stage'] | undefined): string {
  switch (stage) {
    case 'pre-flop':
      return 'Pre-flop';
    case 'flop':
      return 'The Flop';
    case 'turn':
      return 'The Turn';
    case 'river':
      return 'The River';
    case 'showdown':
      return 'Showdown';
    default:
      return 'Live Hand';
  }
}

function getDisplayHandResult(
  gameState: FilteredGameState | null,
  handEndResult: HandEndResult | null,
  currentPlayerId: string | null,
): PokerHandResult | null {
  if (handEndResult) {
    const currentPlayerWinner = currentPlayerId
      ? handEndResult.winners.find((winner) => winner.playerId === currentPlayerId && winner.hand)
      : undefined;

    return currentPlayerWinner?.hand ?? handEndResult.winners.find((winner) => winner.hand)?.hand ?? null;
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

function formatWinnersText(result: HandEndResult, playerNames: Record<string, string>): string {
  const winners = result.winners.map((winner) => playerNames[winner.playerId] ?? 'Unknown');
  if (winners.length === 0) {
    return 'Hand complete';
  }
  if (winners.length === 1) {
    return `${winners[0]} wins ${formatCurrency(result.winners[0]?.amount ?? result.pot)}.`;
  }

  return `${winners.join(' and ')} split ${formatCurrency(result.pot)}.`;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString()}`;
}
