# Blueprint design tokens · "Annotated"

Direction 04: the clarity of *Drafting Table* with the editorial voice of *Field Journal*. Dark is the default theme; light and system are options.

| File | What it is |
|---|---|
| `tokens.json` | Source of truth, W3C DTCG format: primitives → semantic roles for dark and light, plus type, space, radius, motion |
| `tokens.css` | CSS custom properties (`--bp-*`), theme switching via `data-theme`, Tailwind v4 `@theme` mapping, AI-marking classes |

## Setup (Next.js + Tailwind v4)
In this repo the CSS lives at `src/styles/tokens.css` and is already wired up:
1. `src/app/globals.css`: `@import "tailwindcss";` then `@import "../styles/tokens.css";`
2. `src/app/layout.tsx` loads `Newsreader`, `Geist` and `Geist_Mono` with `next/font/google` as `--font-newsreader`, `--font-geist` and `--font-geist-mono`.
3. `<html data-theme="dark">` is the default. `src/lib/theme.ts` holds an inline script that applies the saved choice (`dark` / `light` / `system`) before first paint, and `ThemeSwitcher` changes it.

`tokens.json` is the source of truth; keep `tokens.css` in sync when it changes.

## Rules

### Type: three faces, three jobs
- **Newsreader (serif):** page titles, Plateau insight sentences, AI reasoning (italic), and the big gym-mode numerals. *Never* on buttons, inputs or labels.
- **Geist (sans):** every control, label and piece of UI copy.
- **Geist Mono:** every number, weight, rep scheme, rule and timestamp. Use `.num` (tabular numbers) wherever numbers update or line up.

### Color
- **Amber is reserved for AI.** `ai`, `ai-mark`, `ai-wash` mean "the AI produced this and you haven't confirmed it." Never use amber for warnings, badges or decoration. Warnings and errors use `danger`.
- **Forest green is for actions and progress:** primary buttons, completed sets, positive change.
- **Ink buttons** (`text` background, `text-inverse` label) are for confirming the AI: Confirm, Accept.
- Components use **semantic tokens only**, never primitives or raw hex.

### The AI marking system
| State | Treatment | Class |
|---|---|---|
| AI-generated inline text | Highlighter mark + dashed underline | `.ai-mark` |
| AI-proposed block (rule, change, swap) | Wash + 1.5px dashed amber border | `.ai-proposal` |
| Why the AI suggested it | Italic serif | `.ai-reasoning` |
| Confidence | Mono label, `ai-text` color ("72% sure") | — |
| Confirmed by user | Marking removed; becomes normal ink | — |

When a proposal is accepted, the marking fades out (`duration-base`). New AI text "inks in" left to right (`duration-slow`, `data-entering`), and this is turned off when the user prefers reduced motion.

### Gym mode
Train sessions always use the `gym-*` surface (`.gym` or `data-mode="train"`), whatever the theme. Use `control-lg` (60px) for primary actions and `gym-numeral` for the working weight.

### Shape and density
- Cards `radius-lg` (10px), buttons `radius-md` (8px), inputs `radius-sm` (6px). No pill buttons outside gym mode.
- Elevation comes from surface color + hairline border, not shadows. Shadows only on popovers and menus.
- Minimum touch target: 44px (`control-md`).
- Faint background grid (`bg-grid`, 24px) only on Plan and Review canvases, never inside cards.
