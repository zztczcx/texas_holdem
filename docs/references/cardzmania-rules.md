# Texas Hold'em — CardzMania UX Reference

> Source: https://www.cardzmania.com/TexasHoldem
> Captured for UX and feature reference.

---

## Game Overview (CardzMania)

- 2–12 players
- ~30 minutes per game
- No real money — fun-only coins/points
- Chat, avatars, emojis built-in
- No sign-up, no ads, no downloads

---

## Core UX Flow

### Lobby
1. Player visits site
2. Creates a private table OR joins via code/link
3. Table host configures game settings
4. Players wait in lobby until host starts
5. Player names shown with avatar in waiting area

### In-Game Layout
- Oval green felt table in center
- Player seats positioned around table (up to 9)
- Community cards in center
- Pot amount displayed prominently
- Each player shows: name, chip count, current bet, avatar
- Action buttons at bottom/right: Check, Call, Raise, Fold
- Dealer button rotates visually each hand
- Small blind and big blind positions labeled

### Betting UI
- Raise: Slider or typed input for raise amount
- Min raise / Max raise / All-in quick buttons
- Timer countdown visible when turn timer enabled
- Sound/animation for card dealing, chip movement, win

### End of Hand
- Cards revealed at showdown with reveal animation
- Winner highlighted with chip animation
- Hand ranking displayed (e.g., "Full House: Kings full of Jacks")
- Pot award animation (chips fly to winner)

### Chat & Social
- Chat panel on side
- Emoji reactions (haha, cool, etc.)
- Cute animated avatars

---

## Pre-Game Settings (CardzMania model)

### Points Mode
- Set starting chip amount (all players start equal)
- Play until 1 player has all chips OR round/time limit

### Rounds Mode
- Set number of hands to play
- Most chips after N hands wins

### Timer Options
- Fast: 7s per turn
- Standard: 15s
- Slow: 30s
- Very Slow: 60s
- Disabled: Only in private tables

### Betting Options
1. **Blinds** (standard): Small blind + big blind forced bets
2. **Ante**: All players post ante before dealing
3. **Limited Betting**: Cap on max bet per round
4. **Reraise**: Allow multiple raises per round
5. **Buy-Back**: Allow players to replenish chips

### Special Variations
- **Sit Out**: Skip a round
- **Jokers**: Wild cards (auto-picks best hand)

---

## Table/Game Codes

- Tables have unique codes (share link or 6-character code)
- Host can kick players
- Observer mode (watch without playing)

---

## Visual Design Observations (CardzMania)

- Clean, flat design — no heavy shadows
- Green felt table clearly visible
- Cards are large and legible
- Chip amounts always visible
- Current player highlighted (timer ring or glow)
- Blind positions labeled (SB, BB)
- Folded players show folded card back
- All-in players highlighted differently
- Side pot clearly labeled when applicable

---

## Key UX Patterns to Implement

1. **Table code sharing**: Large, copyable code + shareable link
2. **Waiting lobby**: Show connected players, host controls
3. **Turn indicator**: Ring/timer around active player
4. **Quick action shortcuts**: Check/Call/Fold as large tap targets
5. **Raise slider**: Tap slider or type amount
6. **Hand history**: Last hand result visible
7. **Win animation**: Chips animate to winner
8. **Player status**: Away / Sit-out clearly indicated
9. **Reconnection**: Rejoin mid-game via table code
