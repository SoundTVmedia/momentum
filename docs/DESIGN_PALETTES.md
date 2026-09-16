# Design palette log

Liquid glass styling is shared across versions; only brand colors and gradients change.

**Active:** [Nightstage / Magenta](#nightstage--magenta) — see `ACTIVE_PALETTE_ID` in `src/react-app/lib/design-palettes.ts`.

---

## Orange version

First iteration after the original teal/mint rebrand. Warm coral + gold (not the old app teal).

| Token | Hex |
|-------|-----|
| Ember | `#FF5349` |
| Flare | `#FFB020` |
| Rose | `#C73E6D` |

```css
/* Brand gradient */
linear-gradient(to right, #FF5349 0%, #FFB020 51%, #FF5349 100%);
```

```html
<!-- Tailwind reference -->
bg-gradient-to-r from-[#FF5349] via-[#FFB020] to-[#FF5349]
```

---

## Green option 1

Citron → lime → forest (horizontal). Replaces orange; no cool blue–red tone.

| Token | Hex |
|-------|-----|
| Citron (ember) | `#FEF08A` |
| Lime (flare) | `#84CC16` |
| Grove (rose) | `#16A34A` |

```css
linear-gradient(to right, #fef08a 0%, #84cc16 50%, #16a34a 100%);
```

```html
bg-gradient-to-r from-[#fef08a] via-[#84cc16] to-[#16a34a]
```

---

## Green option 2

Lime → forest → teal, flowing toward bottom-left.

Lime → forest → teal, flowing toward bottom-left.

| Token | Hex |
|-------|-----|
| Lime (ember) | `#84CC16` |
| Forest (flare) | `#16A34A` |
| Teal (rose) | `#0F766E` |

```css
linear-gradient(to bottom left, #84cc16 0%, #16a34a 50%, #0f766e 100%);
```

```html
bg-gradient-to-bl from-[#84cc16] via-[#16a34a] to-[#0f766e]
```

## Nightstage / Magenta *(active)*

Concert-house palette. Nightstage fills the shell; Headliner Magenta is the only CTA/brand accent; Electric Violet is secondary/archive; House Light is type; Stage Gold is verified/premium only.

| Token | Role | Hex | Screen |
|-------|------|-----|--------|
| Nightstage (`ink`) | Foundation | `#0B0711` | ~72% |
| Headliner Magenta (`ember` / `flare`) | Primary + CTA | `#FF2E88` | ~9% |
| Electric Violet (`rose`) | Secondary / archive | `#7566E8` | ~4% |
| House Light (`glacier`) | Text + light surface | `#F6F2FA` | ~13% |
| Stage Gold (`gold`) | Premium / verified | `#D6A84B` | ~2% max |

```css
linear-gradient(to bottom left, #FF2E88 0%, #FF2E88 50%, #7566E8 100%);
```

```html
bg-gradient-to-bl from-[#FF2E88] via-[#FF2E88] to-[#7566E8]
```

---

## Not used

**Cool tone (Arctic Pulse)** — frost cyan + bolt pink (`#22D3EE` / `#F43F5E`). Explored and rejected; not kept in the registry.

---

## UI color rules (Nightstage / Magenta active)

Use these Tailwind tokens for **brand** UI (not semantic states):

| Token | Class | Hex |
|-------|--------|-----|
| Headliner Magenta | `momentum-ember` / `momentum-flare` | `#FF2E88` |
| Electric Violet | `momentum-rose` | `#7566E8` |
| House Light | `momentum-glacier` | `#F6F2FA` |
| Stage Gold | `momentum-gold` | `#D6A84B` |
| Nightstage | `momentum-ink` | `#0B0711` |

- **CTAs / gradient text:** `momentum-grad-interactive`, `momentum-grad-text`, or `bg-momentum-flow`
- **Glass borders:** `border-momentum-ember/20`–`/40` or `brand-border`
- **Verified / premium only:** `momentum-gold` — do not use on CTAs, nav, or chrome
- **Keep semantic colors:** red (live/errors), pink (likes), green (success/copy) where meaning matters

## Switching palettes

1. Set `ACTIVE_PALETTE_ID` in `src/react-app/lib/design-palettes.ts`.
2. Copy token hex values and `momentumGrad` into `tailwind.config.js` and `:root` in `src/react-app/index.css`.
3. Update glass RGBA tints in `index.css` to match (magenta `255,46,136` / violet `117,102,232` for Nightstage).
4. Run a grep for leftover brand hex and map stragglers to `momentum-*` tokens.
