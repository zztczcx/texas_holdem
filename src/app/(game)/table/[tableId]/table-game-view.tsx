'use client';

import { useTransition } from 'react';
import type { Table } from '@/types/game';
import { Header } from '@/components/layout/header';
import { PokerTable } from '@/components/game/poker-table';
import { ActionBar } from '@/components/game/action-bar';
import { useGameState } from '@/hooks/use-game-state';
import { performAction } from '@/app/actions';
import type { ActionType } from '@/types/game';

interface TableGameViewProps {
  table: Table;
  currentPlayerId: string | null;
}

/**
 * The in-game view: poker table with live Pusher state + action bar.
 */
export function TableGameView({ table: initialTable, currentPlayerId }: TableGameViewProps): React.ReactElement {
  const [, startTransition] = useTransition();

  const initialGameState = initialTable.gameState
    ? { ...initialTable.gameState, deck: null as null }
    : null;

  const { gameState } = useGameState(
    initialTable.id,
    currentPlayerId,
    initialGameState,
  );

  const liveGameState = gameState;

  const currentPlayer = currentPlayerId ? initialTable.players[currentPlayerId] : null;

  const isMyTurn =
    currentPlayer &&
    liveGameState &&
    currentPlayer.seatIndex === liveGameState.currentSeatIndex &&
    currentPlayer.status === 'active';

  async function handleAction(type: ActionType, amount?: number): Promise<void> {
    if (!currentPlayerId) return;
    startTransition(async () => {
      await performAction(initialTable.id, currentPlayerId, {
        type,
        playerId: currentPlayerId,
        amount,
        timestamp: Date.now(),
      });
    });
  }

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
      <main className="min-h-screen flex flex-col items-stretch bg-[var(--color-canvas)] px-2 py-4 md:px-6">
        <PokerTable
          players={initialTable.players}
          gameState={liveGameState}
          settings={initialTable.settings}
          currentPlayerId={currentPlayerId}
          className="flex-1"
        />

        {/* Action bar — only shown to the active player on their turn */}
        {isMyTurn && currentPlayer && (
          <div className="mt-4 max-w-md mx-auto w-full px-2">
            <ActionBar
              player={currentPlayer}
              gameState={liveGameState}
              settings={initialTable.settings}
              onAction={handleAction}
            />
          </div>
        )}
      </main>
    </>
  );
}
