# Texas Hold'em Rules Reference

> Source: Wikipedia — https://en.wikipedia.org/wiki/Texas_hold_%27em
> Source: CardzMania — https://www.cardzmania.com/TexasHoldem

---

## Overview

Texas Hold'em is a poker variant where players combine 2 private **hole cards** with 5 shared **community cards** to make the best 5-card hand. 2–10 players per table (CardzMania supports up to 12).

---

## The Deck

Standard 52-card deck. No jokers (unless variant enabled). Aces are high (and can be low in A-2-3-4-5 straights).

---

## Table Positions

| Position | Role |
|----------|------|
| **Dealer (Button)** | Identified by the "D" button; acts last post-flop |
| **Small Blind** | Player to dealer's left; posts forced bet = ½ big blind |
| **Big Blind** | Player to small blind's left; posts forced bet = minimum bet |
| **UTG (Under the Gun)** | First to act pre-flop (left of big blind) |

Positions rotate **clockwise** after each hand.

---

## Betting Options

| Action | Description |
|--------|-------------|
| **Check** | Pass — only if no bet has been made this round |
| **Call** | Match the current bet |
| **Raise** | Increase the current bet (min raise = size of previous raise) |
| **Fold** | Discard hand, forfeit all bets made |
| **All-In** | Bet all remaining chips |

---

## Hand Flow (5 Rounds)

### 1. Pre-Flop
1. Dealer shuffles 52-card deck
2. Small blind and big blind post forced bets
3. Each player receives **2 hole cards** (face down)
4. Betting round begins with player left of big blind (clockwise)
5. Big blind may check or raise if no one re-raised

### 2. Flop
1. Dealer burns 1 card (discarded face-down)
2. Dealer reveals **3 community cards** face-up
3. Betting round begins with player left of dealer

### 3. Turn
1. Dealer burns 1 card
2. Dealer reveals **1 community card** (4th card total)
3. Betting round

### 4. River
1. Dealer burns 1 card  
2. Dealer reveals **1 final community card** (5th card total)
3. Final betting round

### 5. Showdown
- If 2+ players remain after the river betting, all reveal hole cards
- Best 5-card hand from any combination of 2 hole cards + 5 community cards wins
- If only 1 player remains (all others folded), that player wins without showing cards
- Split pot if hands are equal value

---

## Hand Rankings (Low → High)

| Rank | Name | Example |
|------|------|---------|
| 1 | **High Card** | K-J-9-7-3 (no pairs) |
| 2 | **One Pair** | K-K-J-9-3 |
| 3 | **Two Pair** | K-K-J-J-3 |
| 4 | **Three of a Kind** | K-K-K-J-3 |
| 5 | **Straight** | 5-6-7-8-9 (different suits) |
| 6 | **Flush** | K-J-9-7-3 (all same suit) |
| 7 | **Full House** | K-K-K-J-J |
| 8 | **Four of a Kind** | K-K-K-K-J |
| 9 | **Straight Flush** | 5-6-7-8-9 (same suit) |
| 10 | **Royal Flush** | 10-J-Q-K-A (same suit) |

**Tiebreaker**: Kicker (next highest card) used when hands of equal rank.  
**Suite**: Suits are NOT ranked in standard Texas Hold'em (unlike some variants).

---

## Betting Structures

### No-Limit (Most Common)
- Players may bet any amount up to their total chip stack
- Minimum raise = size of previous bet or raise
- Used in main WSOP event, most popular online

### Limit
- Pre-flop and flop: bets/raises must equal the big blind ("small bet")
- Turn and river: bets/raises must equal 2× big blind ("big bet")

### Pot-Limit
- Maximum bet = current pot size

---

## Blinds

- **Small Blind**: ½ of big blind (rounded down)
- **Big Blind**: Minimum bet for the hand
- In heads-up (2 players): Dealer posts small blind, other player posts big blind
- **Antes** (optional): All players post a forced bet before dealing (in addition to blinds)

---

## Pre-Game Settings (for our implementation)

| Setting | Options | Default |
|---------|---------|---------|
| Starting chips | 500 / 1,000 / 2,000 / 5,000 / Custom | 1,000 |
| Small blind | 5 / 10 / 25 / 50 / Custom | 10 |
| Big blind | Auto (2× small blind) | 20 |
| Max raise count | 1 / 2 / 3 / Unlimited | Unlimited |
| Ante | None / 1 / 2 / 5 | None |
| Timer | Off / 7s / 15s / 30s / 60s | 30s |
| Max players | 2–9 | 9 |
| Buy-back | Yes / No | Yes |

---

## Game End Conditions

- **Points mode**: Play until one player has all chips OR a time/round limit is reached
- **Rounds mode**: Play a set number of hands; player with most chips wins
- **Elimination**: Players eliminated when chips reach 0 (unless buy-back enabled)

---

## Special Rules

### All-In and Side Pots
When a player goes all-in with fewer chips than the current bet:
1. A **side pot** is created for the excess chips
2. The all-in player can only win the **main pot**
3. Other players compete for the side pot separately

### Misdeal
- If the first or second dealt card is exposed → reshuffle and redeal
- If another hole card is exposed due to dealer error → replace with top of deck; exposed card becomes burn card

---

## CardzMania-Specific Variations Supported

| Variation | Description |
|-----------|-------------|
| **Reraise** | Players can raise multiple times per round |
| **Limited Betting** | Cap on maximum bet per round |
| **Sit Out** | Skip a round without leaving the table |
| **Buy-Back** | Replenish chips if almost out |
| **Jokers** | Wildcard jokers in deck (best hand auto-selected) |
| **Ante** | All players post ante before dealing |
| **Timer** | Turn timer: 7s / 15s / 30s / 60s / none |
