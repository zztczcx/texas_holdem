'use client';

import { useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Table } from '@/types/game';
import { Header } from '@/components/layout/header';
import { PokerTable } from '@/components/game/poker-table';
import { ActionBar } from '@/components/game/action-bar';
import { ShowdownOverlay } from '@/components/game/showdown-overlay';
import { GameEndScreen } from '@/components/game/game-end-screen';
import { TurnTimer } from '@/components/game/turn-timer';
import { ToastContainer, useToast } from '@/components/ui/toast';
import { useGameState } from '@/hooks/use-game-state';
import { performAction, endHand, buyBack } from '@/app/actions';
import type { ActionType } from '@/types/game';

interface TableGameViewProps {
  table: Table;
  currentPlayerId: string | null;
}

/**
 * The in-game view: poker table with live Pusher state + action bar.
 */
export function TableGameView({ table: initialTable, currentPlayerId }: TableGameViewProps): React.ReactElement {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { toasts, addToast, dismissToast } = useToast();

  const initialGameState = initialTable.gameState
    ? { ...initialTable.gameState, deck: null as null }
    : null;

  const { gameState, handEndResult } = useGameState(
    initialTable.id,
    currentPlayerId,
    initialGameState,
  );

  const liveGameState = gameState;

  // Use live player data from game state where possible, fall back to initial snapshot.
  // The live players record is embedded in initialTable and refreshed on router.refresh().
  const livePlayers = initialTable.players;
  const currentPlayer = currentPlayerId ? livePlayers[currentPlayerId] ?? null : null;

  // A player's turn: their seat matches the current seat in the live game state,
  // and they are active (not folded/allIn/sitOut/disconnected).
  const isMyTurn =
    !!currentPlayer &&
    !!liveGameState &&
    currentPlayer.seatIndex === liveGameState.currentSeatIndex &&
    currentPlayer.status === 'active';

  const isGameEnded = initialTable.state === 'ended';
  const isShowdown = liveGameState?.stage === 'showdown';

  // When the hand ends (performAction auto-finalizes hands now), refresh server data
  // so the table re-renders with the latest player chip counts and next hand state.
  useEffect(() => {
    if (handEndResult) {
      router.refresh();
    }
  }, [handEndResult, router]);

  async function handleAction(type: ActionType, amount?: number): Promise<void> {
    if (!currentPlayerId) return;
    startTransition(async () => {
      const result = await performAction(initialTable.id, currentPlayerId, {
        type,
        playerId: currentPlayerId,
        amount,
        timestamp: Date.now(),
      });
      if (result.error) {
        addToast({ message: result.error, variant: 'danger' });
      }
    });
  }

  async function handleNextHand(): Promise<void> {
    startTransition(async () => {
      // endHand is now a no-op when performAction already finalized the hand.
      const result = await endHand(initialTable.id);
      if (result.error) {
        addToast({ message: result.error, variant: 'danger' });
      } else {
        router.refresh();
      }
    });
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
    // Auto-fold on turn expiry
    void handleAction('fold');
    addToast({ message: 'Time out — you were automatically folded.', variant: 'danger' });
  }

  const playerNames = Object.fromEntries(
    Object.values(initialTable.players).map((p) => [p.id, p.name]),
  );

  if (!liveGameState) {
    return (
      <>
        <Header />
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-[var(--color-text-muted)] text-lg">Loading game...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen flex flex-col items-stretch bg-[var(--color-canvas)] px-2 py-2 sm:py-4 sm:px-4 md:px-6">
        {/* Turn timer (top of page when it's your turn) */}
        {isMyTurn && initialTable.settings.turnTimerSeconds > 0 && (
          <div className="flex justify-center mb-2">
            <TurnTimer
              totalSeconds={initialTable.settings.turnTimerSeconds}
              isActive={!!isMyTurn}
              onExpire={handleTimerExpire}
            />
          </div>
        )}

        <PokerTable
          players={livePlayers}
          gameState={liveGameState}
          settings={initialTable.settings}
          currentPlayerId={currentPlayerId}
          className="flex-1"
        />

        {/* Action bar — only shown to the active player on their turn */}
        {isMyTurn && currentPlayer && (
          <div className="mt-3 sm:mt-4 max-w-md mx-auto w-full px-1 sm:px-2">
            <ActionBar
              player={currentPlayer}
              gameState={liveGameState}
              settings={initialTable.settings}
              onAction={handleAction}
            />
          </div>
        )}
      </main>

      {/* Showdown overlay */}
      {(isShowdown || handEndResult) && handEndResult && (
        <ShowdownOverlay
          result={handEndResult}
          playerNames={playerNames}
          allowBuyBack={initialTable.settings.allowBuyBack}
          currentPlayerId={currentPlayerId}
          currentPlayerChips={currentPlayer?.chips ?? 0}
          onNextHand={() => void handleNextHand()}
          onBuyBack={handleBuyBack}
        />
      )}

      {/* Game end screen */}
      {isGameEnded && (
        <GameEndScreen
          players={initialTable.players}
          winnerPlayerId={
            Object.values(initialTable.players).find((p) => p.chips > 0)?.id ?? null
          }
          tableId={initialTable.id}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
