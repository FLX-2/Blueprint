# Blueprint

Paste any strength program and it runs itself. Ask your training history anything.

One web app, three modes:

- **Plan:** import a program, check what the AI read, adapt the week.
- **Train:** run a session at the gym (phone-first, always dark).
- **Review:** ask questions about your history and get exact, visual answers (codename *Plateau*).

The rule throughout: **AI for the fuzzy parts, code for the exact parts.** The model reads messy input and proposes things. Code does every calculation and gets the final say, and the interface always shows which is which.

## Getting started

Requires Node 24+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app runs in demo mode with a fictional athlete and 18 months of generated history.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then `tsc` |
| `npm test` | Vitest: calculations and the seed data's story |
| `npm run seed:csv` | Writes the sample history to `public/demo/strong-export.csv` |

## Project layout

```
design/            Design tokens (DTCG JSON, source of truth) and usage rules
docs/              Concepts, app structure and core flows
src/styles/        tokens.css: CSS variables, themes, Tailwind mapping, AI marking classes
src/app/(app)/     Routes with the app shell: plan, train, review, settings
src/app/(focus)/   Full-screen routes without navigation: gym mode, welcome
src/components/    Shell (nav, Ask bar), UI primitives, charts
src/lib/domain/    Types and plain-language descriptions of programs and rules
src/lib/calc/      Deterministic training math (e1RM, weekly sets, rounding)
src/data/seed/     Sample athlete: exercises, GZCLP program, generated history
```

## Design system

Direction "Annotated": Drafting Table clarity with Field Journal's editorial voice. Dark by default; light and system in Settings.

- **Newsreader** for titles, insights and AI reasoning. **Geist** for every control. **Geist Mono** for every number.
- **Amber means AI and nothing else:** anything the AI produced that you haven't confirmed (`.ai-mark`, `.ai-proposal`).
- Tailwind's default palette is removed, so components can only use semantic tokens (`bg-surface`, `text-muted`, `border-ai`…).

Full rules: [design/README.md](design/README.md).

## Seed data

`src/data/seed/history.ts` generates the same history on every build. It's built to tell one story, which the tests in `seed.test.ts` check: in August 2026 the athlete drops from four training days to three, weekly chest sets fall from about 14 to 8, and bench press stalls at 205 lb × 3–4 while squat keeps climbing.

## History import (F5)

`/review/data` imports a Strong, Hevy or custom-column CSV:

1. **Read:** the file is parsed in the browser (`src/lib/import/`) and never uploaded. Warm-ups and cardio rows are left out and counted.
2. **Clean up names:** code resolves what it can be certain about (`match.ts`: normalized names and aliases), suggests close spellings for review, and sends only the remaining *names* to Claude (`/api/match-exercises`), which returns a library match or a new exercise, each with a confidence and a reason. AI suggestions are marked in amber until confirmed; nothing imports until every name is confirmed.
3. **Store:** sessions are saved to IndexedDB in this browser (`src/lib/dataset/store.ts`), and Review switches to them. Remove the import from `/review/data` to go back to the sample athlete.

AI matching needs `ANTHROPIC_API_KEY` (see `.env.example`). Without it, the import still works with code matches only, and says so.

## Ask your history (F4)

`/review/ask` (or the ⌘K bar) answers questions about the active dataset:

1. **The model plans, the browser computes.** `/api/ask` runs one Claude step at a time. When Claude calls an analysis tool (`src/lib/ask/tools.ts`: plateaus, lift trends, weekly sets, frequency, period comparisons), the browser runs it on local data and sends back only the result. The raw log never leaves the browser.
2. **Answers are checked before they're shown.** Claude finishes with `show_answer`: charts that reference tool results, and short claims that cite the result behind them. `src/lib/ask/verify.ts` rejects any number that isn't in a tool result; Claude gets one chance to fix it, and anything still unsupported is marked *unverified* in the UI.
3. **Every claim has its evidence.** Charts are drawn only from computed points. Tapping a claim outlines its dates on the chart and opens the rows behind it.

Without `ANTHROPIC_API_KEY`, Ask says so and offers a **scripted example** on the sample data: the model's side is scripted, but the tools, number check, charts and evidence all run for real.

## Status

- **Phase 0 (foundation):** tokens, app shell, seed data, placeholder routes.
- **Phase 1 (Review):** history import with exercise-name cleanup (F5) and Ask with tools, charts and evidence (F4) are done. Next: Phase 2, the rule engine, program import (F1) and gym mode (F2).

See [docs/02-structure-and-flows.md](docs/02-structure-and-flows.md).
