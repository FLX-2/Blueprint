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

## Program import (F1)

`/plan/import` turns a pasted program (a forum post, a PDF's text, a spreadsheet) into one the rule engine runs:

1. **Read.** `/api/extract-program` asks Claude for the days, slots and progression rules, each with a confidence, a reason and an exact quote from the text. Nothing runs yet.
2. **Check.** `src/lib/program/convert.ts` finds every quote in the source, validates each rule's parameters (a rule that doesn't add up is left out, never guessed), matches exercise names to the library, and flags what needs a human look: uncertain rules, either/or exercises, anything under 90% confidence.
3. **Review.** Source on the left, structure on the right. Selecting an item outlines its quote; rules can be confirmed or edited. Approval stays blocked until every flag is resolved.
4. **Start.** Code suggests starting weights from the lifter's log (about 90% of what it says they can do), and previews week 1 exactly as the engine will prescribe it.
5. **Approve.** The program and its starting state are saved in this browser (IndexedDB); Plan and Train switch to it. "Use the sample program" switches back.

Without an API key, import offers a scripted example of the GZCLP text: the AI's reading is scripted, and every step after it runs for real.

## Gym mode (F2)

`/train/session` is the phone screen for training: always dark, one exercise at a time, and fully on-device.

- **Log fast.** One tap logs a set at its target; steppers adjust weight or reps first (a weight change carries to that exercise's remaining sets). AMRAP sets ask for the reps. Undo, jump between exercises, and a rest timer by tier (3:00 / 2:00 / 1:15) that buzzes when it's over.
- **Never lose a set.** The session is saved to IndexedDB after every change, so a reload, a dead battery or no signal loses nothing. The screen stays awake (Wake Lock).
- **Finish feeds the engine.** `finishSession()` logs the workout, runs `applySession()`, and the summary shows time, sets, volume, new bests (estimated 1RM), what the rules decided for each lift, and the next day's targets.
- **Logs flow everywhere.** Train shows the next day with each target's reason; Review, lift pages and Ask analyze logged sessions along with the imported or sample history. Settings can clear the log.
- **Offline.** A service worker (`public/sw.js`, production builds only) caches the app, so it opens with no connection; unknown pages fall back to gym mode. `experimental.useOffline` drives an offline banner. The manifest makes it installable, opening straight to Train.

## Rule engine

`src/lib/engine/` runs a program's progression rules. It's pure code with no AI: the AI only reads rules out of a pasted program (F1), and this is what runs them.

- **Five rule kinds:** linear, stage-on-failure (with a reset to a share of the last weight or of an estimated 5RM), AMRAP threshold, double progression, and percentage cycles (5/3/1-style training maxes).
- **State per slot** (tier + exercise), so a lift trained as T1 and T2 progresses separately in each.
- `prescribe()` gives a day's sets; `applySession()` applies what was logged and returns plain-language events ("Missed reps: switch to 6×2+ at 225 lb."); `stateFromHistory()` works out where a lifter is from their log.
- Only **confirmed** rules run. Weights round down to what the lifter can load; `platesFor()` gives plates per side.

## Status

- **Phase 0 (foundation):** tokens, app shell, seed data, placeholder routes.
- **Phase 1 (Review):** history import with exercise-name cleanup (F5) and Ask with tools, charts and evidence (F4) are done. 
- **Phase 2 (Plan + Train):** the rule engine, program import & review (F1) and gym mode logging (F2) are done. Sessions logged offline feed the engine, Review and Ask.
- **Next (Phase 3):** Bend the week (F3), Ask routing for plan changes, and a polish and accessibility pass.

See [docs/02-structure-and-flows.md](docs/02-structure-and-flows.md).
