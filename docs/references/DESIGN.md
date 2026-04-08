# Design System Inspiration — Pinterest (Adapted for Texas Hold'em)

> Source: https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/pinterest/DESIGN.md
> Adapted for a dark poker/card game aesthetic while preserving Pinterest's design language philosophy.

---

## 1. Visual Theme & Atmosphere

This project adapts Pinterest's warm, craft-like design language to a **dark poker table aesthetic**. The design operates on a deep felt-green canvas with gold as the singular bold accent (replacing Pinterest Red). The neutral scale has warm undertones — dark greens lean toward forest/felt (`#1a3d2b`, `#2d6a4f`) rather than cool steel.

The typography uses the system font stack for broad compatibility, with a compact scale from 12px to 48px. The three-tier token architecture (`--comp-*`, `--sema-*`, `--color-*`) is preserved.

**Key Characteristics:**
- Deep felt-green canvas — immersive, focused gambling atmosphere
- Gold (`#d4af37`) as singular bold accent — chips, wins, highlights
- Warm white text (`#f0ede8`) — warm, not clinical white
- Generous border radius: 16px for buttons/inputs, 20px for cards
- Card imagery as primary visual element (like Photography in Pinterest)
- Dark near-brown text on light surfaces (`#2c1810`) — warm, with hint of mahogany
- Masonry-inspired grid for card/chip layouts

---

## 2. Color Palette & Roles

### Primary Brand
- **Felt Green** (`#2d6a4f`): Primary CTA, dealer button, active states — bold, confident
- **Deep Felt** (`#1a3d2b`): Background, table surface
- **Dark Canvas** (`#0d1b12`): Deepest background sections

### Text
- **Warm White** (`#f0ede8`): Primary text on dark surfaces
- **Warm Silver** (`#a89f96`): Secondary descriptions, muted text, labels
- **Mahogany** (`#2c1810`): Text on light card faces

### Accent / Game-Specific
- **Gold** (`#d4af37`): Chips, wins, pot highlight, dealer button — bold and singular
- **Gold Hover** (`#c49b28`): Pressed/hover gold state
- **Royal Red** (`#c0392b`): Heart/Diamond suit indicator, danger/fold
- **Dark Suit** (`#1a1a2e`): Spade/Club suit indicator on card faces
- **Win Green** (`#2d9e6b`): Win notification, positive outcome

### Interactive
- **Focus Blue** (`#4361ee`): Focus rings (accessibility)
- **Pressed Blue** (`#6b7ff0`): Pressed interactive state
- **Link** (`#5e9cd3`): Informational links

### Surface & Border
- **Card Face** (`#ffffff`): Playing card backgrounds
- **Card Back** (`#1e3a5f`): Card back pattern base
- **Warm Dark** (`#14261a`): Panel/container backgrounds
- **Border Default** (`#3d5e4a`): Container borders — warm felt tone
- **Border Muted** (`#2a4035`): Subtle dividers

### Semantic
- **Danger** (`#e63946`): Fold, error states
- **Success** (`#2d9e6b`): Win, positive feedback
- **Warning** (`#f4a261`): Timer warning, caution states

---

## 3. Typography Rules

### Font Family
```css
font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans,
  'Apple Color Emoji', 'Segoe UI Emoji', Helvetica Neue, Arial, sans-serif;
```

### Hierarchy

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Display Hero | 48px (3rem) | 700 | normal | Game over, big win screens |
| Section Heading | 28px (1.75rem) | 700 | normal | Table name, section titles |
| Card Value | 24px (1.5rem) | 700 | 1 | Playing card numbers |
| Body | 16px (1rem) | 400 | 1.5 | Player names, descriptions |
| Caption Bold | 14px (0.875rem) | 600 | normal | Pot amounts, chip counts |
| Caption | 12px (0.75rem) | 400–500 | 1.5 | Labels, status text, bet amounts |
| Button | 14px (0.875rem) | 600 | normal | Action buttons |

### Principles
- Compact scale: 12px–48px with most UI at 12–16px
- Bold weights (600–700) for game values (chips, cards) — always readable
- Single font family for consistency
- All dollar/chip amounts: `font-variant-numeric: tabular-nums` for alignment

---

## 4. Component Stylings

### Buttons

**Primary Action (Call/Raise)**
- Background: Felt Green (`#2d6a4f`)
- Text: Warm White (`#f0ede8`)
- Padding: 10px 20px
- Radius: 16px
- Hover: `#245a40`
- Focus: 2px solid Focus Blue ring

**Danger Action (Fold)**
- Background: `#c0392b`
- Text: White
- Padding: 10px 20px
- Radius: 16px

**Gold Action (All-In)**
- Background: Gold (`#d4af37`)
- Text: Mahogany (`#2c1810`)
- Padding: 10px 20px
- Radius: 16px

**Secondary (Check)**
- Background: `#2a4035` (warm dark border)
- Text: Warm White
- Radius: 16px
- Border: 1px solid `#3d5e4a`

**Circular (Dealer Button, Avatar)**
- Background: Gold (`#d4af37`)
- Radius: 50%
- Size: 32px × 32px (dealer button), 48px (avatar)

### Cards

**Playing Card**
- Background: White (`#ffffff`)
- Radius: 8px
- Border: 1px solid `#e0d5c8`
- Shadow: `0 2px 8px rgba(0,0,0,0.3)`
- Back: Deep Blue (`#1e3a5f`) with pattern
- Width: 60px (standard), 80px (hero view)

**Community Card Container**
- Background: Deep Felt (`#1a3d2b`)
- Radius: 12px
- Padding: 12px 16px
- Gap between cards: 8px

### Inputs (Buy-In, Raise Amount)
- Background: `#14261a` (warm dark)
- Border: 1px solid `#3d5e4a`
- Radius: 16px
- Padding: 10px 16px
- Text: Warm White
- Focus: border-color Focus Blue + blue ring

### Table Layout
- Table felt: Radial gradient from `#2d6a4f` to `#1a3d2b`
- Border: 8px solid `#5c3d1e` (wooden rim — warm brown)
- Radius: 40% / 50% (oval/elliptical)
- Pot display: Gold badge, centered above community cards
- Player seats: 9 or fewer, positioned around ellipse

### Chip Display
- Stack visual: Gold gradient circles
- Count badge: Caption Bold (12px, weight 600), warm white
- 4 denominations shown visually: 1, 5, 25, 100 (color-coded)

---

## 5. Layout Principles

### Spacing System
- Base unit: 8px
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80px
- Tight: 4–8px (within components)
- Standard: 12–16px (between related elements)
- Loose: 24–32px (between sections)
- Section: 48–64px (major section breaks)

### Grid & Container
- Game table: Full-viewport canvas (no max-width container)
- Lobby: Centered, max-width 1200px, 16px horizontal padding
- Card grids: CSS Grid with auto-fill, min 200px cards
- Player seats: Absolute positioning around oval table SVG

### Whitespace Philosophy
- Game table: Dense layout — every pixel is game state
- Lobby: Generous breathing room — Pinterest's "breathing above, density below" principle
- Modals/drawers: 24px internal padding

### Border Radius Scale
| Scale | Radius | Usage |
|-------|--------|-------|
| Small | 8px | Playing cards |
| Standard | 12px | Small containers, badges |
| Button | 16px | Buttons, inputs |
| Card | 20px | Panel containers |
| Large | 28px | Modal dialogs |
| Section | 32px | Major feature blocks |
| Circle | 50% | Chips, avatars, dealer button |

---

## 6. Depth & Elevation

| Level | Shadow | Usage |
|-------|--------|-------|
| Flat | none | Table felt, backgrounds |
| Card | `0 2px 8px rgba(0,0,0,0.3)` | Playing cards |
| Raised | `0 4px 16px rgba(0,0,0,0.4)` | Panels, player seats |
| Modal | `0 8px 32px rgba(0,0,0,0.6)` | Dialogs, overlays |

**Philosophy**: Depth communicates game importance. Cards have more shadow than the table (they're "on top"). Modals are most elevated. The felt background has no shadow.

---

## 7. Do's and Don'ts

### Do
- Use warm neutrals (`#2a4035`, `#3d5e4a`, `#a89f96`) — olive/forest undertones
- Apply Gold (`#d4af37`) only for primary positive values (pots, wins, all-in)
- Use generous border-radius: 16px buttons, 20px+ panels
- Keep the game table dense — every element represents game state
- Use `#f0ede8` (warm white) for primary text — warmer than pure white
- Card faces are always white with high contrast for accessibility

### Don't
- Don't use cool blue-gray neutrals — always warm/forest-toned
- Don't use pure white (`#ffffff`) as background — use warm white or felt green
- Don't add pill-shaped buttons — 16px radius is right
- Don't add card shadows on the table itself — only on physical "objects"
- Don't use thin font weights (<400) for any game values
- Don't introduce new brand colors — gold + felt-green + danger-red is complete

---

## 8. Responsive Behavior

### Breakpoints

| Name | Width | Layout |
|------|-------|--------|
| Mobile | < 576px | Single column, simplified table view |
| Mobile Large | 576–768px | Compact table with bottom action bar |
| Tablet | 768–1024px | Full table, condensed player seats |
| Desktop | 1024–1440px | Full table with side panels |
| Wide | > 1440px | Expanded with chat panel |

### Collapsing Strategy
- Game table: Oval → compressed oval → stacked (mobile)
- Player seats: 9 around table → 6 visible + scroll → 4 visible (mobile)
- Action bar: Side panel → fixed bottom bar (mobile)
- Chat: Side panel → hidden with toggle (mobile)

---

## 9. Agent Prompt Guide

### Quick Color Reference
```
Brand felt:    #2d6a4f  (primary action, active)
Canvas:        #1a3d2b  (table background)
Gold:          #d4af37  (chips, wins, pots)
Warm white:    #f0ede8  (primary text on dark)
Muted:         #a89f96  (secondary text, labels)
Danger:        #e63946  (fold, error)
Success:       #2d9e6b  (win, positive)
Focus:         #4361ee  (accessibility ring)
Card face:     #ffffff  (playing cards)
```

### Example Component Prompts
- "Create a player seat: oval shape, felt-green background (#2d6a4f). Avatar circle (50% radius, 48px, gold border). Name 14px warm white. Chip count caption-bold gold (#d4af37)."
- "Design a playing card: white background, 8px radius, 2px border #e0d5c8. Red suit color #c0392b, dark suit #1a1a2e. Card value 24px weight 700."
- "Build an action button row: Fold (danger red #c0392b), Check (secondary dark #2a4035), Call (felt green #2d6a4f), Raise (gold #d4af37 text on dark). All 16px radius, 14px weight 600."
- "Create the pot display: gold badge (#d4af37 bg, #2c1810 text), 12px radius, centered. Amount in caption-bold 14px tabular-nums."

### Iteration Guide
1. Warm forest-greens everywhere — felt tones, never cool steel
2. Gold for the single most important value — pot, win, primary action
3. 16px radius on buttons/inputs, 20px+ on panels — generous but not pill
4. System font at 12px for labels, 24px+ for card values
5. Physical objects (cards, chips) have shadows — felt has none
6. Warm white (`#f0ede8`) for text — warmer than pure white
