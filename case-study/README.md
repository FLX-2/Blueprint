# Case-study mockups

Device-framed screenshots of Blueprint for the portfolio case study. Every screen is the real app, captured from a production build with the sample athlete. AI steps use the app's labeled scripted examples, which is also what visitors see on the public demo. The only edit is that the demo-only "Sample data" bar and the Getting started checklist are hidden; someone running their own program never sees them.

All images are PNGs at 2× (phones from 3× captures). Single devices have transparent backgrounds; boards have the app's dark drafting-grid background.

## Boards (ready to drop into the case study)

| File | What it shows |
|---|---|
| `mockups/board-hero.png` | Cover: welcome, Train and gym mode on three phones, with the one-line pitch |
| `mockups/board-train.png` | The Train flow: today's targets → gym mode → session summary, with captions |
| `mockups/board-ai.png` | "The AI proposes. You check. Code decides." Import check, Ask answer, Bend the week |
| `mockups/board-pair-import.png` | Program import on desktop (source ↔ structure) and phone |
| `mockups/board-pair-ask.png` | Ask on desktop with the evidence panel open, and on phone |

## Single phones (transparent)

| File | Screen |
|---|---|
| `mockups/phone-01-welcome.png` | First run: three ways to start |
| `mockups/phone-02-plan.png` | Plan: workouts with plain tier names |
| `mockups/phone-03-train.png` | Train: today's targets and their reasons |
| `mockups/phone-04-adapt.png` | Bend the week: the AI's proposal for a hotel-gym trip |
| `mockups/phone-05-import-check.png` | Import: the numbered "needs your check" list |
| `mockups/phone-06-ask.png` | Ask: charts and an answer with linked evidence |
| `mockups/phone-07-gym-log.png` | Gym mode: logging a set |
| `mockups/phone-08-gym-rest.png` | Gym mode: resting between sets |
| `mockups/phone-09-summary.png` | Session summary: what the rules decided |

## Single desktops (transparent, browser frame)

| File | Screen |
|---|---|
| `mockups/desktop-01-plan.png` | Plan |
| `mockups/desktop-02-import-check.png` | Import check: source text beside the structure |
| `mockups/desktop-03-ask-evidence.png` | Ask with a claim selected and its sets in the evidence panel |
| `mockups/desktop-04-review.png` | Review overview |
| `mockups/desktop-05-adapt.png` | Bend the week proposal |

## Regenerating

The frames are plain HTML/CSS (a phone with a dynamic island and status bar, a browser window), rendered with headless Chrome. To refresh after UI changes, re-capture the same screens at 390×797 (phone, 3×) and 1440×900 (desktop, 2×) from a build without an API key, and re-render the frames.
