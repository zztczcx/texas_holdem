// Core card types
export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
}

// Hand evaluation
export type HandRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
// 1=High Card, 2=Pair, 3=Two Pair, 4=Three of a Kind, 5=Straight,
// 6=Flush, 7=Full House, 8=Four of a Kind, 9=Straight Flush, 10=Royal Flush

export interface HandResult {
  rank: HandRank;
  rankName: string;
  cards: readonly Card[];   // best 5 cards
  kickers: readonly Card[];
  // Numeric value for comparison (higher = better)
  value: number;
}

// Player types
export type PlayerStatus = 'active' | 'folded' | 'allIn' | 'sitOut' | 'disconnected';

export interface Player {
  id: string;
  name: string;
  seatIndex: number;    // 0–8
  chips: number;
  status: PlayerStatus;
  sessionId: string;
  joinedAt: number;
}

// Action types
export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allIn';

export interface PlayerAction {
  type: ActionType;
  playerId: string;
  amount?: number;
  timestamp: number;
}

// PlayerHand — hole cards are only sent to the owning player
export interface PlayerHand {
  holeCards: readonly [Card, Card];
  bestHand?: HandResult;    // populated at showdown
}

// Side pot for all-in scenarios
export interface SidePot {
  amount: number;
  eligiblePlayerIds: readonly string[];
}

// Transient betting round tracker
export interface BettingRound {
  bets: Record<string, number>;       // playerId → amount bet this round
  actedPlayers: ReadonlySet<string>;
}

// Game stage
export type GameStage =
  | 'waiting'
  | 'pre-flop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'end';

export interface GameState {
  stage: GameStage;
  dealerSeatIndex: number;
  smallBlindSeatIndex: number;
  bigBlindSeatIndex: number;
  currentSeatIndex: number;
  pot: number;
  sidePots: readonly SidePot[];
  communityCards: readonly Card[];
  deck: readonly Card[];                        // remaining deck (server-only)
  playerHands: Record<string, PlayerHand>;      // playerId → hand
  currentBet: number;
  raiseCount: number;
  minimumRaise: number;
  bettingRound: BettingRound;
  lastAction: PlayerAction | null;
  handNumber: number;
}

// Table / settings
export interface GameSettings {
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  maxRaises: number;        // 0 = unlimited
  ante: number;
  turnTimerSeconds: number; // 0 = disabled
  maxPlayers: number;       // 2–9
  allowBuyBack: boolean;
  buyBackAmount: number;
}

export type TableState = 'waiting' | 'playing' | 'ended';

export interface Table {
  id: string;
  hostPlayerId: string;
  state: TableState;
  settings: GameSettings;
  players: Record<string, Player>;
  gameState: GameState | null;
  createdAt: number;
  updatedAt: number;
}

// Winner result
export interface WinnerResult {
  playerId: string;
  amount: number;
  hand?: HandResult;
  sidePotIndex?: number;
}

// Showdown result (all hands revealed)
export interface ShowdownResult {
  hands: Record<string, PlayerHand>;
  winners: readonly WinnerResult[];
}

// Hand end result
export interface HandEndResult {
  winners: readonly WinnerResult[];
  playerChips: Record<string, number>;
  handNumber: number;
}
