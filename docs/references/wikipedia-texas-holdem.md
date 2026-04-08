# Wikipedia: Texas Hold'em Reference

> Source: https://en.wikipedia.org/wiki/Texas_hold_%27em
> Extracted for offline reference.

## Summary

Texas Hold'em is a poker variant where:
- 2–10 players (up to 22 theoretically)
- 52-card standard deck
- 2 private hole cards + 5 shared community cards
- 4 betting rounds: Pre-flop, Flop, Turn, River
- Best 5-card hand from 7 available cards wins

## Hand Rankings (Low to High)

| Hand | Description |
|------|-------------|
| High Card | Highest single card |
| One Pair | Two matching ranks |
| Two Pair | Two sets of pairs |
| Three of a Kind | Three matching ranks |
| Straight | 5 sequential cards (different suits) |
| Flush | 5 same-suit cards (not sequential) |
| Full House | Three of a kind + pair |
| Four of a Kind | Four matching ranks |
| Straight Flush | 5 sequential same-suit |
| Royal Flush | 10-J-Q-K-A same suit |

## Betting Structures

- **No-Limit**: Bet any amount up to chip stack (most common)
- **Pot-Limit**: Max bet = current pot
- **Limit**: Fixed bet sizes per street

## Blinds

- Small blind = player left of dealer, posts ½ big blind
- Big blind = player left of small blind, posts minimum bet
- Blinds rotate clockwise after each hand

## Game Flow

1. Blinds posted
2. 2 hole cards dealt to each player
3. Pre-flop betting (UTG acts first)
4. Flop: 3 community cards
5. Turn: 1 community card
6. River: 1 final community card
7. Showdown (if 2+ players remain)

## Showdown Rules

- Each player makes best 5-card hand from 2 hole cards + 5 community cards
- Can use both hole cards, one, or none ("playing the board")
- Playing the board can only tie (all players share 5-card board)
- Ties: split pot equally; odd chip to first player left of dealer

## Special Cases

### All-In & Side Pots
- Player all-in with fewer chips than current bet → creates side pot
- All-in player eligible for main pot only
- Side pot split among remaining active players

### Heads-Up (2 players)
- Dealer posts small blind
- Other player posts big blind
- Dealer acts first pre-flop, then big blind acts first post-flop

### Kickers
- Used to break ties when hand rank is equal
- Example: K-K-J-9-3 beats K-K-J-8-3 (9 kicker beats 8)
- 5-card rule: best hand uses exactly 5 cards

## Probability Notes (for hand evaluator reference)

- Total 2-card combos from 52-card deck: 1,326
- Distinct starting hands: 169 (accounting for suit equivalence)
- 13 pocket pairs + 78 suited non-pairs + 78 offsuit non-pairs
- Suited hands are stronger but only marginally so in most situations
