import type {
  ActionType,
  GameState,
  GameSettings,
  Player,
  PlayerAction,
  SidePot,
} from '../../types/game';

export interface ValidAction {
  type: ActionType;
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Return the list of valid actions for a player given the current game state.
 *
 * The player may only act during their turn (state.currentSeatIndex matches
 * the player's seatIndex).
 */
export function getValidActions(
  state: GameState,
  player: Player,
  settings: GameSettings,
): readonly ValidAction[] {
  const stage = state.stage;
  if (
    stage === 'waiting' ||
    stage === 'showdown' ||
    stage === 'end'
  ) {
    return [];
  }

  if (state.currentSeatIndex !== player.seatIndex) {
    return [];
  }

  if (player.status === 'folded' || player.status === 'allIn') {
    return [];
  }

  const actions: ValidAction[] = [];
  const playerBetThisRound = state.bettingRound.bets[player.id] ?? 0;
  const callAmount = state.currentBet - playerBetThisRound;

  // Fold is always available
  actions.push({ type: 'fold' });

  if (callAmount === 0) {
    // No bet to call — player can check
    actions.push({ type: 'check' });
  } else {
    // There is a bet to call
    if (player.chips >= callAmount) {
      actions.push({ type: 'call' });
    }
  }

  // Raise (if not exceeded max raises and player has enough chips)
  const canRaise =
    settings.maxRaises === 0 || state.raiseCount < settings.maxRaises;

  if (canRaise) {
    const minRaise = state.minimumRaise;
    const totalMinCommitment = state.currentBet + minRaise;
    const chipsNeededForMinRaise = totalMinCommitment - playerBetThisRound;

    if (player.chips > callAmount) {
      // Player has chips beyond a call — they can raise
      const maxRaiseChips = player.chips; // max is all-in
      actions.push({
        type: 'raise',
        minAmount: Math.min(chipsNeededForMinRaise, player.chips),
        maxAmount: maxRaiseChips,
      });
    }
  }

  // All-in is always available if player has chips
  if (player.chips > 0) {
    actions.push({ type: 'allIn', maxAmount: player.chips });
  }

  return actions;
}

/**
 * Return how many chips a player needs to call the current bet.
 * Returns 0 if the player is already at or above the current bet.
 */
export function getCallAmount(state: GameState, player: Player): number {
  const playerBetThisRound = state.bettingRound.bets[player.id] ?? 0;
  return Math.max(0, state.currentBet - playerBetThisRound);
}

/**
 * Apply a bet/raise/call/check/fold action to the game state.
 * Returns a new GameState — never mutates the input.
 *
 * Throws if the action is invalid (wrong player, wrong stage, insufficient chips, etc.)
 */
export function applyBet(
  state: GameState,
  player: Player,
  action: PlayerAction,
): GameState {
  const validActions = getValidActions(state, player, {
    startingChips: 0,
    smallBlind: 0,
    bigBlind: 0,
    maxRaises: 0,
    ante: 0,
    turnTimerSeconds: 0,
    maxPlayers: 9,
    allowBuyBack: false,
    buyBackAmount: 0,
  });

  const validTypes = validActions.map((a) => a.type);
  if (!validTypes.includes(action.type)) {
    const playerBetThisRound = state.bettingRound.bets[player.id] ?? 0;
    const diagCallAmount = Math.max(0, state.currentBet - playerBetThisRound);
    throw new Error(
      `Invalid action "${action.type}" for player ${player.id} in stage "${state.stage}". ` +
      `Valid: [${validTypes.join(', ')}]. ` +
      `Player chips: ${player.chips}, player bet: ${playerBetThisRound}, ` +
      `call amount: ${diagCallAmount}, current bet: ${state.currentBet}, ` +
      `turn seat: ${state.currentSeatIndex}, player seat: ${player.seatIndex}`,
    );
  }

  const newBets = { ...state.bettingRound.bets };
  const newActed = new Set(state.bettingRound.actedPlayers);
  newActed.add(player.id);

  const playerBetThisRound = newBets[player.id] ?? 0;
  let newPot = state.pot;
  let newCurrentBet = state.currentBet;
  let newRaiseCount = state.raiseCount;
  let newMinRaise = state.minimumRaise;

  switch (action.type) {
    case 'fold': {
      break;
    }

    case 'check': {
      // No chips change
      break;
    }

    case 'call': {
      const callAmount = Math.min(
        state.currentBet - playerBetThisRound,
        player.chips,
      );
      newBets[player.id] = playerBetThisRound + callAmount;
      newPot += callAmount;
      break;
    }

    case 'raise': {
      const amount = action.amount ?? 0;
      if (amount <= 0) {
        throw new Error('Raise amount must be positive');
      }
      const totalCommitment = playerBetThisRound + amount;
      if (totalCommitment <= state.currentBet) {
        throw new Error(
          `Raise total ${totalCommitment} must exceed current bet ${state.currentBet}`,
        );
      }
      if (amount > player.chips) {
        throw new Error('Raise amount exceeds player chips');
      }
      const raiseBy = totalCommitment - state.currentBet;
      newBets[player.id] = totalCommitment;
      newPot += amount;
      newCurrentBet = totalCommitment;
      newMinRaise = Math.max(raiseBy, newMinRaise);
      newRaiseCount += 1;
      // Re-open action for all players who have already acted
      newActed.clear();
      newActed.add(player.id);
      break;
    }

    case 'allIn': {
      const allInAmount = player.chips;
      const totalCommitment = playerBetThisRound + allInAmount;
      newBets[player.id] = totalCommitment;
      newPot += allInAmount;
      if (totalCommitment > state.currentBet) {
        const raiseBy = totalCommitment - state.currentBet;
        newCurrentBet = totalCommitment;
        newMinRaise = Math.max(raiseBy, newMinRaise);
        newRaiseCount += 1;
        newActed.clear();
        newActed.add(player.id);
      }
      break;
    }
  }

  return {
    ...state,
    pot: newPot,
    currentBet: newCurrentBet,
    raiseCount: newRaiseCount,
    minimumRaise: newMinRaise,
    lastAction: action,
    bettingRound: {
      bets: newBets,
      actedPlayers: newActed,
    },
  };
}

/**
 * Calculate side pots when one or more players are all-in.
 *
 * Returns an array of SidePots sorted from smallest to largest.
 */
export function calculateSidePots(
  allInAmounts: ReadonlyMap<string, number>,
  totalBetsByPlayer: Readonly<Record<string, number>>,
  activePlayers: readonly string[],
): readonly SidePot[] {
  if (allInAmounts.size === 0) {
    return [];
  }

  const sidePots: SidePot[] = [];
  // Unique all-in thresholds sorted ascending
  const thresholds = [...new Set(allInAmounts.values())].sort((a, b) => a - b);

  let previousThreshold = 0;

  for (const threshold of thresholds) {
    const range = threshold - previousThreshold;
    if (range <= 0) continue;

    // Every player who bet at least `threshold` contributes `range` chips
    const eligible = activePlayers.filter(
      (id) => (totalBetsByPlayer[id] ?? 0) >= threshold,
    );
    const amount = eligible.length * range;

    if (amount > 0) {
      sidePots.push({ amount, eligiblePlayerIds: eligible });
    }

    previousThreshold = threshold;
  }

  // Main pot: all players who contributed beyond the last all-in threshold
  const mainEligible = activePlayers.filter(
    (id) => (totalBetsByPlayer[id] ?? 0) > previousThreshold,
  );
  if (mainEligible.length > 0) {
    const mainPot = mainEligible.reduce(
      (sum, id) => sum + (totalBetsByPlayer[id] ?? 0) - previousThreshold,
      0,
    );
    if (mainPot > 0) {
      sidePots.push({ amount: mainPot, eligiblePlayerIds: mainEligible });
    }
  }

  return sidePots;
}
