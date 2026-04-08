// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PlayerSeat } from './player-seat';
import type { Player, GameState } from '@/types/game';

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

function makeGameState(overrides: Partial<Omit<GameState, 'deck'>> = {}): Omit<GameState, 'deck'> & { deck: null } {
  return {
    stage: 'pre-flop',
    dealerSeatIndex: 0,
    smallBlindSeatIndex: 1,
    bigBlindSeatIndex: 2,
    currentSeatIndex: 0,
    pot: 30,
    sidePots: [],
    communityCards: [],
    deck: null,
    playerHands: {},
    currentBet: 20,
    raiseCount: 0,
    minimumRaise: 20,
    bettingRound: { bets: {}, actedPlayers: new Set() },
    lastAction: null,
    handNumber: 1,
    ...overrides,
  } as Omit<GameState, 'deck'> & { deck: null };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('PlayerSeat', () => {
  it('renders player name', () => {
    render(<PlayerSeat player={makePlayer()} gameState={makeGameState()} />);
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('labels the article with name and chip count', () => {
    const { container } = render(<PlayerSeat player={makePlayer({ chips: 500 })} gameState={makeGameState()} />);
    const article = container.querySelector('article');
    expect(article?.getAttribute('aria-label')).toContain('Alice');
    expect(article?.getAttribute('aria-label')).toContain('500 chips');
  });

  it('adds "their turn" to aria-label when active', () => {
    const { container } = render(<PlayerSeat player={makePlayer()} gameState={makeGameState()} isActive />);
    const article = container.querySelector('article');
    expect(article?.getAttribute('aria-label')).toContain('their turn');
  });

  it('adds "folded" to aria-label when player is folded', () => {
    const { container } = render(
      <PlayerSeat
        player={makePlayer({ status: 'folded' })}
        gameState={makeGameState()}
      />,
    );
    const article = container.querySelector('article');
    expect(article?.getAttribute('aria-label')).toContain('folded');
  });

  it('shows "(you)" suffix for self seat', () => {
    render(<PlayerSeat player={makePlayer()} gameState={makeGameState()} isSelf />);
    expect(screen.getByText('(you)', { exact: false })).toBeDefined();
  });

  it('shows dealer badge when role is dealer', () => {
    render(<PlayerSeat player={makePlayer()} gameState={makeGameState()} role="dealer" />);
    expect(screen.getByLabelText('dealer')).toBeDefined();
  });

  it('shows SB badge when role is sb', () => {
    render(<PlayerSeat player={makePlayer()} gameState={makeGameState()} role="sb" />);
    expect(screen.getByLabelText('sb')).toBeDefined();
  });

  it('shows BB badge when role is bb', () => {
    render(<PlayerSeat player={makePlayer()} gameState={makeGameState()} role="bb" />);
    expect(screen.getByLabelText('bb')).toBeDefined();
  });

  it('shows "All-in" label when player is all-in', () => {
    render(
      <PlayerSeat
        player={makePlayer({ status: 'allIn' })}
        gameState={makeGameState()}
      />,
    );
    expect(screen.getByText('All-in')).toBeDefined();
  });

  it('shows hole cards when hand is available and isSelf', () => {
    const hand = {
      holeCards: [
        { rank: 'A' as const, suit: 'spades' as const },
        { rank: 'K' as const, suit: 'hearts' as const },
      ] as [{ rank: 'A'; suit: 'spades' }, { rank: 'K'; suit: 'hearts' }],
    };
    render(
      <PlayerSeat
        player={makePlayer()}
        gameState={makeGameState({ playerHands: { p1: { holeCards: hand.holeCards } } })}
        isSelf
      />,
    );
    expect(screen.getByRole('article', { name: 'A of spades' })).toBeDefined();
    expect(screen.getByRole('article', { name: 'K of hearts' })).toBeDefined();
  });

  it('shows current bet in round', () => {
    render(
      <PlayerSeat
        player={makePlayer()}
        gameState={makeGameState({ bettingRound: { bets: { p1: 50 }, actedPlayers: new Set() } })}
      />,
    );
    expect(screen.getByText('bet 50')).toBeDefined();
  });
});
