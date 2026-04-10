// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableGameView } from './table-game-view';
import type { HandEndResult, Table } from '@/types/game';

const mockRefresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockApplySnapshot = vi.fn();
const mockApplyHandEndResult = vi.fn();
const mockUseGameState = vi.fn();
const mockAddToast = vi.fn();
const mockDismissToast = vi.fn();
const mockPerformAction = vi.fn();
const mockBuyBack = vi.fn();
const mockEndHand = vi.fn();

vi.mock('@/hooks/use-game-state', () => ({
  useGameState: (...args: unknown[]) => mockUseGameState(...args),
}));

vi.mock('@/app/actions', () => ({
  performAction: (...args: unknown[]) => mockPerformAction(...args),
  buyBack: (...args: unknown[]) => mockBuyBack(...args),
  endHand: (...args: unknown[]) => mockEndHand(...args),
}));

vi.mock('@/components/layout/header', () => ({
  Header: () => <div>Header</div>,
}));

vi.mock('@/components/game/poker-table', () => ({
  PokerTable: () => <div>Poker Table</div>,
}));

vi.mock('@/components/game/action-bar', () => ({
  ActionBar: () => <div>Action Bar</div>,
}));

vi.mock('@/components/game/game-end-screen', () => ({
  GameEndScreen: () => <div>Game End</div>,
}));

vi.mock('@/components/game/turn-timer', () => ({
  TurnTimer: () => <div>Turn Timer</div>,
}));

vi.mock('@/components/ui/toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({
    toasts: [],
    addToast: mockAddToast,
    dismissToast: mockDismissToast,
  }),
}));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockRefresh.mockResolvedValue(undefined);
});

function makeTable(): Table {
  return {
    id: 'abc123',
    hostPlayerId: 'p1',
    state: 'playing',
    revision: 9,
    settings: {
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
      maxRaises: 4,
      ante: 0,
      turnTimerSeconds: 0,
      maxPlayers: 6,
      allowBuyBack: false,
      buyBackAmount: 0,
    },
    players: {
      p1: {
        id: 'p1',
        name: 'Alice',
        seatIndex: 0,
        chips: 1120,
        status: 'active',
        sessionId: 'session-p1',
        joinedAt: 1,
      },
      p2: {
        id: 'p2',
        name: 'Bob',
        seatIndex: 1,
        chips: 880,
        status: 'active',
        sessionId: 'session-p2',
        joinedAt: 2,
      },
    },
    gameState: {
      stage: 'pre-flop',
      dealerSeatIndex: 0,
      smallBlindSeatIndex: 0,
      bigBlindSeatIndex: 1,
      currentSeatIndex: 0,
      pot: 30,
      sidePots: [],
      communityCards: [],
      deck: [],
      playerHands: {
        p1: {
          holeCards: [
            { rank: 'A', suit: 'spades' },
            { rank: 'K', suit: 'hearts' },
          ],
        },
        p2: {
          holeCards: [
            { rank: 'Q', suit: 'clubs' },
            { rank: 'J', suit: 'diamonds' },
          ],
        },
      },
      currentBet: 20,
      raiseCount: 0,
      minimumRaise: 20,
      bettingRound: {
        bets: {
          p1: 10,
          p2: 20,
        },
        actedPlayers: new Set<string>(),
      },
      lastAction: null,
      handNumber: 8,
    },
    createdAt: 1,
    updatedAt: 2,
  };
}

function makeHandEndResult(): HandEndResult {
  return {
    winners: [
      {
        playerId: 'p1',
        amount: 120,
      },
    ],
    playerChips: {
      p1: 1120,
      p2: 880,
    },
    handNumber: 7,
    pot: 120,
    communityCards: [],
    playerHands: {
      p1: undefined,
      p2: undefined,
    },
  };
}

describe('TableGameView', () => {
  it('dismisses the showdown overlay without calling endHand again', async () => {
    const user = userEvent.setup();
    mockUseGameState.mockReturnValue({
      tableState: 'playing',
      revision: 9,
      gameState: makeTable().gameState,
      livePlayers: makeTable().players,
      myHoleCards: null,
      lastAction: null,
      handEndResult: makeHandEndResult(),
      isConnected: true,
      refresh: mockRefresh,
      applySnapshot: mockApplySnapshot,
      applyHandEndResult: mockApplyHandEndResult,
    });

    render(<TableGameView table={makeTable()} currentPlayerId="p1" />);

    await user.click(screen.getByRole('button', { name: /next hand/i }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    expect(mockEndHand).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /hand result/i })).toBeNull();
    });
  });
});