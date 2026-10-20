# Blueprint: App Structure & Core Flows

*Oct 20, 2026 · Builds on `01-concepts.md` (Blueprint + Plateau) and the "Annotated" design tokens in `design/`*

One web app with three modes. **Plan** (Blueprint: programs, rules, adapting the week), **Train** (running a session at the gym), **Review** (Plateau: asking about your history). Plan and Review are desktop-first; Train is phone-first.

---

## 1. App structure

### Sitemap

```
/                              → redirects: today's session if one is scheduled, else /plan
/welcome                       First run: choose a starting point, units, theme
/demo                          Explore with sample data (no account)

PLAN
/plan                          Program overview: active program, this week, upcoming changes
/plan/week/[n]                 Week view · "Something changed?" opens the Adapt drawer
/plan/program/[id]             Program detail: days, exercises, rules in plain language
/plan/program/[id]/rules/[r]   Edit one rule
/plan/programs                 Library: imported programs, switch active
/plan/import                   Import: paste text · link · upload file
/plan/import/[draft]/review    Source ↔ structure review (the signature screen)
/plan/gyms                     Gym profiles: equipment at home / work / hotel

TRAIN
/train                         Today: session preview, Start
/train/session/[id]            Gym mode (full screen, always dark)
/train/session/[id]/summary    What happened + what the rules do next

REVIEW
/review                        Overview: weekly recap, flagged lifts, suggested questions, pinned answers
/review/ask/[thread]           An answer: chart + narrative + evidence; follow-ups
/review/lifts/[exercise]       Lift detail: e1RM trend, volume, PRs, sessions
/review/compare                Compare two training blocks
/review/history                Every session, filterable
/review/data                   Import history (CSV), exercise-name cleanup

SETTINGS
/settings                      Units, theme, bar & plate weights, rounding, AI preferences, export/delete data
```

### Global navigation
| | Desktop (≥1024px) | Phone |
|---|---|---|
| Modes | Top bar: logo · *Plan / Train / Review* segmented control · Ask · profile | Bottom tab bar: Plan · Train · Review |
| Ask (⌘K) | Search-style bar in the top bar; opens a command palette for questions *and* navigation | Floating Ask button above the tab bar |
| Layout | Plan & Review: two panes (list/detail or source/structure) | Single column; side panes become full-screen steps or bottom sheets |
| Train session | Works, but designed for phone | Full screen, nav hidden, screen kept awake |

**Ask goes everywhere.** One input handles "why did my bench stall?" (→ Review answer), "I'm traveling Thursday" (→ Adapt drawer), and "go to squat history" (→ navigation). The AI chooses where to route the request, and the palette shows where it's going before it goes.

### Key objects (data model sketch)
| Object | Holds | Notes |
|---|---|---|
| `Program` | weeks → days → exercise slots → set schemes | Imported or hand-built |
| `Rule` | type, params, source span, confidence, status (`proposed` / `confirmed`) | The rule engine only runs `confirmed` rules |
| `TrainingMax` | per lift, current value, history | Rules read and write these |
| `Session` / `SetLog` | planned vs actual reps, weight, RPE, notes | Saved offline first (IndexedDB), synced later |
| `Exercise` | canonical name + aliases + equipment + movement pattern | Pattern powers swaps; aliases power CSV cleanup |
| `GymProfile` | available equipment, weight limits | Used by Adapt and Swap |
| `Adjustment` | a diff to the week: changes[], reasons, status per change | Full history, undoable |
| `Thread` / `Answer` | question, tool calls, chart spec, claims[] → evidence refs | Every claim points to the set IDs behind it |

---

## 2. Core flows

The **AI / code split** in each flow applies the project's rule: *AI for the fuzzy parts, code for the exact parts.*

### F1 · Import & verify a program *(Plan, signature flow)*
**Goal:** turn a Reddit post, PDF or spreadsheet into a program that runs itself, and make the user trust it.

1. **Choose a source** at `/plan/import`: paste text, paste a link, or upload a file (CSV/XLSX/PDF; screenshots later).
2. **Parsing.** Structure streams in week by week, so the user sees progress instead of a spinner. Extracted items *ink in* as AI marks.
3. **Review** (`/plan/import/[draft]/review`). Source on the left, structured program on the right.
   - Hover or focus a rule → its source text highlights (and the reverse).
   - An issues list at the top: "1 rule needs a check · 2 exercises not matched."
   - Each flagged item: Confirm / Edit. Confirming removes the AI marking.
4. **Match exercises.** Unrecognized names → "Did you mean Barbell Back Squat?" or create a custom exercise.
5. **Set starting weights.** The rule engine needs training maxes or starting weights. Ask once, per main lift, with an "I don't know" path (start conservative + calibrate in week 1).
6. **Preview week 1** with the actual weights the engine calculated. This is where trust gets built.
7. **Approve** → program goes live → lands on `/plan` with week 1 ready.

| AI does | Code does |
|---|---|
| Extracts structure, rules and source spans; scores its confidence | Validates against the schema (Zod); rejects incomplete programs |
| Explains each rule in plain language | Calculates every weight in the preview |
| Suggests exercise matches | Blocks **Approve** until every rule that affects weights is confirmed |

**States & edge cases:** source can't be read → show what was extracted plus a "build the rest manually" path · a progression the engine doesn't support → kept as a "manual progression" rule with a note · leaving mid-review → the draft is saved · re-importing a newer version of the program → show a diff against the active one.

---

### F2 · Run a session *(Train, phone)*
**Goal:** log a workout with sweaty hands and no thinking, and see what happens next.

1. **Today** (`/train`): today's session (exercises, target weights, estimated time) → **Start**.
2. **Gym mode.** One exercise at a time: big weight numeral, sets × reps, a progress bar of set dots.
3. **Log a set.** One tap = hit the target. Steppers adjust reps/weight if not. AMRAP sets ask for the rep count.
4. **Rest timer** starts automatically; vibrates near the end; skippable.
5. **Swap** (machine taken, no equipment): AI suggests 2–3 alternatives with the same movement pattern, filtered by the current gym profile. The swap is marked as AI-proposed until tapped.
6. **Finish → Summary:** what you did vs. the plan, PRs, and **what the rules do next** ("All reps hit → squat goes to 235 lb next time" / "Missed → next time 6×2").
7. Saved offline first; syncs when online.

| AI does | Code does |
|---|---|
| Suggests swaps that keep the movement pattern | Every target weight, plate math, rounding |
| (Optional, later) voice logging: "185 for 7, felt heavy" | Applies rules after the session; updates training maxes |

**States & edge cases:** no signal (everything works offline) · leaving mid-session → resume banner on `/train` · partial session → the rule engine decides what counts · plate math for the user's bar and plates · keep the screen awake (Wake Lock API).

---

### F3 · Bend the week *(Plan, Adapt drawer)*
**Goal:** life changed. Get a sensible adjusted week in seconds, and stay in control.

1. From `/plan/week/[n]` (or Ask): **"Something changed?"**
2. Describe it in plain words, or tap a chip: *Traveling · Short on time · Feeling beat up · Equipment unavailable*. Optionally pick a gym profile ("Hotel: dumbbells to 50 lb").
3. **Proposal.** The AI returns changes **as a diff**, grouped by day: struck-through original, highlighted replacement, one-line italic reason each.
4. Code shows the **effect on the week:** "Lower-body sets: 18 → 16 · Squat progression: unchanged."
5. **Accept all / review each** (accept, reject, or edit each change).
6. Applied changes show a small "adjusted" marker on the week; the **Adjustment** is saved with undo.

| AI does | Code does |
|---|---|
| Reads the constraint; proposes swaps, moves, merged or shortened days, with reasons | Validates every change against the program's rules and the gym profile |
| | Calculates volume before vs after; keeps progression state consistent |

**States & edge cases:** the request can't be satisfied ("no equipment, 10 minutes") → offer the closest option and say what's lost · **pain or injury mentioned** → no programming advice: offer to skip or deload the affected lift, and suggest seeing a professional · conflicting changes → resolve before Apply.

---

### F4 · Ask your history *(Review, Plateau signature flow)*
**Goal:** a plain-language question gets an exact, visual answer, with proof.

1. Ask from ⌘K or `/review`, or tap a **suggested question** generated from the data ("Your deadlift hasn't hit a PR in 11 weeks. Want to see why?").
2. **Plan of attack** streams in as short steps: "Finding bench sessions Jun–Oct · Estimating 1RM per session · Comparing chest volume."
3. **Chart skeleton → real chart.** The AI picks the chart type; code fills it with computed values.
4. **Narrative** in serif, with claims highlighted. **Tap a claim → evidence drawer** with the exact sets behind it.
5. **Follow-ups** suggested; **Pin** the answer to `/review`.

| AI does | Code does |
|---|---|
| Interprets the question; picks which analysis tools to call | Every number (queries, e1RM, volume, trends) via typed tools |
| Chooses the chart; writes the narrative | Renders charts from tool output only |
| | Rejects any number in the narrative that didn't come from a tool result |

**States & edge cases:** not enough data ("only 3 bench sessions so far") · ambiguous exercise ("Which bench?" chips) · a question outside the data ("Should I take creatine?" → out of scope, said plainly) · tool error → show which step failed and offer a retry.

---

### F5 · Bring in your history *(Review, data)*
**Goal:** years of Strong/Hevy logs become usable in under two minutes.

1. `/review/data` → upload CSV → the format is detected (Strong, Hevy, or generic with column mapping).
2. **Preview:** date range, sessions, sets, exercises found.
3. **Clean up names.** The AI groups likely duplicates ("BB Bench", "Bench Press (Barbell)", "bench") with confidence scores → confirm, split, or rename each group.
4. **Import** → `/review` fills in: top lifts, first flagged plateau, suggested questions.

| AI does | Code does |
|---|---|
| Suggests exercise merges and canonical names | Parses, de-duplicates and imports rows; merges only after confirmation |

---

### F0 · First run & demo mode
- `/welcome` offers three doors: **"I have a program"** → F1 · **"I have training history"** → F5 · **"Show me with sample data"** → `/demo`.
- **Demo mode matters for the portfolio:** recruiters can open the live app and use every flow on a realistic seeded athlete (a GZCLP program + 18 months of history) without signing up.
- Units (lb/kg) and theme are asked once, with sensible defaults.

---

## 3. Build order (proposal)

| Phase | Scope | Why this order |
|---|---|---|
| **0 · Foundation** (~3 days) | Next.js + TS + Tailwind v4 + tokens, app shell & navigation, core components (button, card, AI marks, diff row, chart frame), seed data | Everything else sits on this |
| **1 · Review** (~1.5 wks) | F5 CSV import → F4 Ask with 6–8 analysis tools, evidence drawer, `/review` overview | Fastest path to real AI on *your own* data; tests the tool-calling setup early |
| **2 · Plan + Train** (~2 wks) | Rule engine (5–6 progression types, unit-tested) → F1 import & review → F2 gym mode (offline) | The rule engine is the riskiest code; Train's logs then feed Review |
| **3 · Adapt + polish** (~1 wk) | F3 Bend the week, ⌘K routing, demo mode, empty/error states, accessibility pass | Builds on everything; the best-looking demo moment |
| **Later** | Concept C (Depth: form check), voice logging, screenshot import | Planned, not in scope now |

**Next design step:** wireframes for the two signature screens, **F1 Review** (source ↔ structure) and **F4 Answer** (chart + narrative + evidence), on the canvas, desktop and phone.
