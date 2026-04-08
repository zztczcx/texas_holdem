// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionBar } from './action-bar';
import type { Player, GameState, GameSettings } from '@/types/game';

afterEach(() => cleanup());

// ── helpers ──────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Alice',
    seatIndex: 0,
    chips: 1000,
    status: 'active',
    sessionId: 'session-1',
    joinedAt: 0,
    ...overrides,
  };
}

function makeSettings(overrides: Partial<GameSettings> = {}): GameSettings {
  return {
    startingChips: 1000,
    smallBlind: 10,
    bigBlind: 20,
    maxRaises: 4,
    ante: 0,
    turnTimerSeconds: 0,
    maxPlayers: 6,
    allowBuyBack: false,
    buyBackAmount: 0,
    ...overrides,
  };
}

/** Build a GameState where p1 is the active pre-flop player with no prior bets */
function makePreFlopState(
  currentBet = 0,
  bets: Record<string, number> = {},
): Omit<GameState, 'deck'> & { deck: null } {
  return {
    stage: 'pre-flop',
    dealerSeatIndex: 1,
    smallBlindSeatIndex: 1,
    bigBlindSeatIndex: 0,
    currentSeatIndex: 0,
    pot: 30,
    sidePots: [],
    communityCards: [],
    deck: null,
    playerHands: {},
    currentBet,
    raiseCount: 0,
    minimumRaise: 20,
    bettingRound: { bets, actedPlayers: new Set() },
    lastAction: null,
    handNumber: 1,
  } as unknown as Omit<GameState, 'deck'> & { deck: null };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('ActionBar', () => {
  it('renders Fold button when there are valid actions', () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    render(
      <ActionBar
        player={makePlayer()}
        gameState={makePreFlopState(20, { p2: 10 })}
        settings={makeSettings()}
        onAction={onAction}
      />,
    );
    expect(screen.getByRole('button', { name: /fold/i })).toBeDefined();
  });

  it('renders Check button when current bet is zero and player has not bet', () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    render(
      <ActionBar
        player={makePlayer()}
        gameState={makePreFlopState(0, {})}
        settings={makeSettings()}
        onAction={onAction}
      />,
    );
    expect(screen.getByRole('button', { name: /check/i })).toBeDefined();
  });

  it('renders Call button with amount when there is a bet to call', () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    render(
      <ActionBar
        player={makePlayer()}
        gameState={makePreFlopState(20, { p2: 20 })}
        settings={makeSettings()}
        onAction={onAction}
      />,
    );
    expect(screen.getByRole('button', { name: /call/i })).toBeDefined();
  });

  it('calls onAction with "fold" when Fold is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn().mockResolvedValue(undefined);
    render(
      <ActionBar
        player={makePlayer()}
        gameState={makePreFlopState(20, { p2: 20 })}
        settings={makeSettings()}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByRole('button', { name: /fold/i }));
    expect(onAction).toHaveBeenCalledWith('fold', undefined);
  });

  it('calls onAction with "check" when Check is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn().mockResolvedValue(undefined);
    render(
      <ActionBar
        player={makePlayer()}
        gameState={makePreFlopState(0, {})}
        settings={makeSettings()}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(onAction).toHaveBeenCalledWith('check', undefined);
  });

  it('shows RaiseSlider when Raise button is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn().mockResolvedValue(undefined);
    render(
      <ActionBar
        player={makePlayer()}
        gameState={makePreFlopState(20, { p2: 20 })}
        settings={makeSettings()}
        onAction={onAction}
      />,
    );
    const raiseBtn = screen.getByRole('button', { name: /raise/i });
    await user.click(raiseBtn);
    // After clicking Raise, a Cancel button should appear (from RaiseSlider view)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined();
  });

  it('hides RaiseSlider and shows action buttons when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn().mockResolvedValue(undefined);
    render(
      <ActionBar
        player={makePlayer()}
        gameState={makePreFlopState(20, { p2: 20 })}
        settings={makeSettings()}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByRole('button', { name: /raise/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByRole('button', { name: /fold/i })).toBeDefined();
  });
});
