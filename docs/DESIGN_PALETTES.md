# Design palette log

Liquid glass styling is shared across versions; only brand colors and gradients change.

**Active:** [Green option 2](#green-option-2) — see `ACTIVE_PALETTE_ID` in `src/react-app/lib/design-palettes.ts`.

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

## Green option 2 *(active)*

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

---

## Not used

**Cool tone (Arctic Pulse)** — frost cyan + bolt pink (`#22D3EE` / `#F43F5E`). Explored and rejected; not kept in the registry.

---

## UI color rules (green option 2 active)

Use these Tailwind tokens for **brand** UI (not semantic states):

| Token | Class | Hex |
|-------|--------|-----|
| Lime | `momentum-ember` | `#84CC16` |
| Forest | `momentum-flare` | `#16A34A` |
| Teal | `momentum-rose` | `#0F766E` |
| Light accent | `momentum-glacier` | `#2DD4BF` |

- **CTAs / gradient text:** `momentum-grad-interactive`, `momentum-grad-text`, or `bg-momentum-flow`
- **Glass borders:** `border-momentum-ember/20`–`/40` or `brand-border`
- **Keep semantic colors:** red (live/errors), pink (likes), green (success/copy) where meaning matters

## Switching palettes

1. Set `ACTIVE_PALETTE_ID` in `src/react-app/lib/design-palettes.ts`.
2. Copy token hex values and `momentumGrad` into `tailwind.config.js` and `:root` in `src/react-app/index.css`.
3. Update glass RGBA tints in `index.css` to match (lime `132,204,22` / teal `15,118,110` for green 2).
4. Run a grep for `amber-`, `orange-`, `purple-`, `cyan-`, `yellow-4` and map stragglers to `momentum-*` tokens.
