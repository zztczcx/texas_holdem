// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ShowdownOverlay } from './showdown-overlay';
import type { HandEndResult } from '@/types/game';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function makeResult(): HandEndResult {
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

describe('ShowdownOverlay', () => {
  it('auto-advances only once when the countdown expires', async () => {
    vi.useFakeTimers();
    const onNextHand = vi.fn();
    const result = makeResult();
    const { rerender } = render(
      <ShowdownOverlay
        result={result}
        playerNames={{ p1: 'Alice', p2: 'Bob' }}
        currentPlayerId="p1"
        onNextHand={onNextHand}
      />,
    );

    for (let second = 0; second < 8; second += 1) {
      await act(async () => {
        vi.runOnlyPendingTimers();
      });
    }

    expect(onNextHand).toHaveBeenCalledTimes(1);

    rerender(
      <ShowdownOverlay
        result={result}
        playerNames={{ p1: 'Alice', p2: 'Bob' }}
        currentPlayerId="p1"
        onNextHand={onNextHand}
      />,
    );

    expect(onNextHand).toHaveBeenCalledTimes(1);
  });
});