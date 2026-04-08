import { cn } from '@/lib/utils/cn';
import type { Player, GameState, GameSettings, Table } from '@/types/game';
import { PlayerSeat } from './player-seat';
import { CommunityCards } from './community-cards';
import { PotDisplay } from './pot-display';

export interface PokerTableProps {
  players: Record<string, Player>;
  gameState: Omit<GameState, 'deck'> & { deck: null };
  settings: GameSettings;
  currentPlayerId: string | null;
  className?: string;
}

/**
 * The oval poker table layout with player seats positioned around it.
 *
 * Seats are arranged in a semicircular order:
 * - Bottom: current player (seat 0 from their POV)
 * - Left + top + right: opponents
 */
export function PokerTable({
  players,
  gameState,
  currentPlayerId,
  className,
}: PokerTableProps): React.ReactElement {
  const playerList = Object.values(players).sort((a, b) => a.seatIndex - b.seatIndex);

  // Determine roles per player
  function getRole(player: Player): 'dealer' | 'sb' | 'bb' | null {
    if (player.seatIndex === gameState.dealerSeatIndex) return 'dealer';
    if (player.seatIndex === gameState.smallBlindSeatIndex) return 'sb';
    if (player.seatIndex === gameState.bigBlindSeatIndex) return 'bb';
    return null;
  }

  // Position seats around an oval: positions are percentage-based (top/left)
  // For up to 9 seats, we compute evenly-spaced positions around an ellipse.
  const n = playerList.length;
  function seatPosition(i: number): { top: string; left: string } {
    // Rotate so current player is at the bottom-center (angle = 90° = π/2)
    const currentPlayerIndex = playerList.findIndex((p) => p.id === currentPlayerId);
    const offset = currentPlayerIndex >= 0 ? currentPlayerIndex : 0;
    const angle = ((i - offset) / n) * 2 * Math.PI + Math.PI / 2;
    // Ellipse radii (in % of container)
    const rx = 42; // horizontal
    const ry = 36; // vertical
    const cx = 50; // center x
    const cy = 50; // center y
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    return { top: `${y}%`, left: `${x}%` };
  }

  return (
    <div
      aria-label="Poker table"
      className={cn('relative w-full aspect-[3/2] max-h-[70vh]', className)}
    >
      {/* Table felt */}
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-6 rounded-[50%]',
          'bg-[radial-gradient(ellipse_at_center,_var(--color-felt)_0%,_var(--color-felt-dark)_100%)]',
          'border-[8px] border-[#5c3d1e]',
          'shadow-[0_8px_32px_rgba(0,0,0,0.6)]',
        )}
      />

      {/* Center: community cards + pot */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10"
        aria-label={`Stage: ${gameState.stage}`}
      >
        <PotDisplay pot={gameState.pot} sidePots={gameState.sidePots} />
        <CommunityCards cards={gameState.communityCards} />
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {gameState.stage}
        </p>
      </div>

      {/* Player seats positioned around the ellipse */}
      {playerList.map((player, i) => {
        const pos = seatPosition(i);
        const isActive = player.seatIndex === gameState.currentSeatIndex;
        const isSelf = player.id === currentPlayerId;
        const role = getRole(player);
        return (
          <div
            key={player.id}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ top: pos.top, left: pos.left }}
          >
            <PlayerSeat
              player={player}
              gameState={gameState}
              role={role}
              isActive={isActive}
              isSelf={isSelf}
            />
          </div>
        );
      })}
    </div>
  );
}

export type { Table };
