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

## Status

Phase 0 (foundation) is done: tokens, app shell, seed data, placeholder routes. Next is Phase 1, Review: CSV import (F5), then Ask (F4). See [docs/02-structure-and-flows.md](docs/02-structure-and-flows.md).
