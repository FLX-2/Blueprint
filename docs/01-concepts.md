# AI × Fitness: Portfolio Concepts

*Concept proposals · Oct 20, 2026 · For the Works section of eli-dev.vercel.app*

---

## The lens

You want projects that show **AI-assisted development and AI as a product feature**, in a space you actually live in. Every concept below follows one shared idea, which can become the theme across all your case studies:

> **AI for the fuzzy parts, code for the exact parts.**
> The model reads messy input (PDFs, voice, video, vague questions) and proposes something. Deterministic code does the math, enforces the rules, and gets the final say. The user always sees what the AI did and can correct it.

That idea answers the question reviewers will have about any AI project: "is this just a ChatGPT wrapper?"

Platform: **mobile-first web (installable PWA)**. People use these on a phone at the gym, and the web is your strength.

---

## Problems I looked at

| # | Problem | Who feels it | Verdict |
|---|---|---|---|
| 1 | Great programs live in Reddit posts, PDFs and spreadsheets that are miserable to follow on a phone mid-workout | Intermediate lifters | ✅ **Concept A** |
| 2 | Programs are rigid; travel, a busy gym or a bad night's sleep breaks the plan, and people improvise badly or skip | Anyone on a plan | ✅ Folded into **A** |
| 3 | Years of logged data, zero insight. "Why did my bench stall?" goes unanswered | Anyone who logs | ✅ **Concept B** |
| 4 | No coach to check form; filming yourself shows *something*, but you don't know what to look for | Self-coached lifters | ✅ **Concept C** |
| 5 | Gym anxiety: beginners don't know what a machine does or how to set it up | Beginners | ✅ **Concept D** (small) |
| 6 | Logging sets is tedious between sets | Everyone | ❌ **Crowded.** Many voice-logging apps already shipped in 2026 (Copper, RepTalk, GymMatrix, Superset…). Use it as a feature, not a product |
| 7 | Calorie tracking is tedious | Everyone | ❌ Crowded (photo-calorie apps are everywhere) |
| 8 | "What should I do today?" from wearable data | Wearable owners | ❌ Whoop, Oura and Garmin already own this |
| 9 | Online coaches drown in weekly client check-ins | Coaches | ⚠️ Real, but B2B triage, and it overlaps **Tally** in your portfolio |

---

## Concept A: **Blueprint**
### *Paste any program. Get a coach that runs it.*

**The problem.** Most good strength programs (5/3/1, GZCLP, nSuns, a coach's PDF) are written as spreadsheets, Reddit posts or PDFs, with progression rules buried in prose: *"add 5 lb when you hit all reps; if you fail twice, deload 10%."* Lifters either rebuild them by hand in a tracker (tedious, error-prone, and progression is still manual) or squint at a spreadsheet on their phone between sets. Then life happens (hotel gym, machine taken, 40 minutes instead of 75) and the program falls apart.

**Today's workaround.** Google Sheets on a phone. Screenshots. Rebuilding templates in Hevy/Strong and calculating the next weights in your head.

**Existing apps.** A few early iOS apps (PDF Fit, Repstack) turn PDFs or pasted text into a plan. They stop at *structure*: they don't capture **progression logic** and don't adapt the plan. That's the gap.

**The insight.** A program isn't a list of workouts. It's **a set of rules**. If the AI turns prose into explicit, readable rules, code can run them forever, exactly.

**How it works**
1. **Import.** Paste text, a link, a spreadsheet or a screenshot. The AI extracts it into a strict schema: weeks → days → exercises → set schemes → **progression rules**.
2. **Verify.** A side-by-side review: source on the left, structured program on the right. Every rule is shown in plain language (*"Squat: +5 lb after a successful week 3"*), with **low-confidence parts highlighted** for you to confirm. Nothing runs until you approve it.
3. **Run.** A focused gym-mode UI: today's workout, target weights calculated by the rule engine (not the LLM), rest timer, one-tap logging (voice optional). Works offline.
4. **Bend.** Tell it what changed: *"Traveling Thu–Sun, hotel gym has dumbbells up to 50 lb."* The AI proposes changes **as a diff** (swaps, merged days, adjusted volume), each with a one-line reason tied to what the program is trying to do. Accept, reject or tweak each change.

**What the AI does / doesn't do**
| AI does | Code does |
|---|---|
| Extracts structure and rules from messy sources | Calculates every weight, rep target and deload |
| Explains rules in plain language | Validates the schema; refuses programs that don't add up |
| Proposes swaps and reschedules, with reasons | Applies accepted diffs; keeps full history and undo |

**Signature interactions**
- The **source ↔ structure review**: hover a rule, the matching source text highlights.
- The **plan diff**: a GitHub-style diff for your training week.
- **Gym mode**: huge tap targets, works one-handed with sweaty hands, screen stays awake.

**MVP (≈3 weeks):** text/link import → verify → run with auto-progression → "bend this week." Defer: screenshot import, voice logging, sharing.

**Stack:** Next.js + TypeScript, Vercel AI SDK with Claude (structured outputs / tool use), a progression rule engine written as a small, well-tested TypeScript module, Postgres (Neon or Supabase) + Drizzle, IndexedDB for offline gym mode, installable PWA.

**What it shows:** structured extraction, human-in-the-loop verification UX, AI proposals presented as diffs, offline-first PWA, a real domain model.

**Risks:** extraction accuracy on gnarly spreadsheets (mitigation: the verify step is the product, not a bolt-on); rule expressiveness (start with the 5–6 most common progression patterns).

**Case study hook:** *"Most 'AI fitness' apps generate a program. I wanted to respect the programs lifters already trust, and make them run themselves."*

**Effort:** ●●●○ · **Wow factor:** ●●●○ · **Originality:** ●●●●

---

## Concept B: **Plateau**
### *Ask your training history anything.*

**The problem.** Lifters log for years in Strong or Hevy and get back a few charts. The questions they actually care about go unanswered: *Why did my bench stall in March? What was different about my best squat block? Am I doing enough back volume?* Trackers record; they don't explain.

**Today's workaround.** Export a CSV and fight with a spreadsheet, or paste it into a chatbot and hope the math is right (it often isn't).

**Existing tools.** Third-party "AI coach" add-ons send plateau alerts and summaries, mostly as text over chat apps. None treat **visual, verifiable answers** as the core.

**The insight.** LLMs are bad at arithmetic over thousands of rows, but good at **deciding which analysis to run**. So the model plans the analysis and calls typed tools (query, aggregate, estimate 1RM, compare periods); code computes; the answer renders as **interactive charts with the evidence attached**.

**How it works**
1. **Import** a Strong/Hevy CSV (or connect later). The data is normalized: exercise names merged (*"Bench Press (Barbell)"* = *"BB Bench"*), with AI suggestions that you confirm.
2. **Ask** in plain language, or tap suggested questions generated from your data (*"Your deadlift hasn't PR'd in 11 weeks. Want to see why?"*).
3. **Answer** as **generative UI**: the model picks a chart type (trend, comparison, volume heatmap), code fills it with exact numbers, and a short narrative explains it. Every claim links to the sets behind it.
4. **Weekly recap:** a short story of your week, with what's trending up, what's slipping, and one thing to try.

**What the AI does / doesn't do**
| AI does | Code does |
|---|---|
| Interprets the question, plans the analysis | Every number: volume, e1RM, trends, comparisons |
| Picks the chart, writes the narrative | Renders charts from computed data only |
| Suggests exercise-name merges | Applies merges only after you confirm |

**Signature interactions**
- **"Show your work"**: tap any sentence and the chart highlights the data behind it.
- **Charts that build themselves** as the answer streams in (skeleton → data → narrative).
- **Compare two training blocks** side by side, chosen by dragging across a timeline.

**MVP (≈2 weeks):** CSV import + name cleanup → 6–8 analysis tools → chat with generative chart answers → suggested questions. Defer: live sync, weekly recaps.

**Stack:** Next.js, Vercel AI SDK tool calling with Claude, DuckDB-WASM or SQLite in the browser (data can stay local, which is a privacy story), visx/D3 or Recharts, streaming UI.

**What it shows:** tool-calling architecture, generative UI, data viz craft, streaming states, honest AI (every answer comes with its evidence). You can **dogfood it with your own training data**.

**Risks:** Generic "chat with your data" has been done before. The difference has to be the visual, evidence-linked answers and lifting-specific analysis.

**Case study hook:** *"The model never touches a number. It decides what to calculate, and the code calculates it."*

**Effort:** ●●○○ · **Wow factor:** ●●●○ · **Originality:** ●●●○

---

## Concept C: **Depth**
### *Form check in your browser. Nothing leaves your phone.*

**The problem.** Self-coached lifters film their sets but don't know what to look for. Was that squat below parallel? Did the bar drift forward? Did reps slow down near the end? Coaches cost $100+/month; posting to Reddit for form checks is slow and hit-or-miss.

**The insight.** Pose estimation now runs **entirely in the browser** (MediaPipe Pose Landmarker, WASM/WebGPU). Measurable things like depth, rep count, rep speed, bar path and left/right symmetry can be calculated on the device with no upload. The LLM's job is narrow: **turn measurements into 1–2 coaching cues**, worded like a coach.

**How it works**
1. Pick a lift (squat, deadlift, bench to start), set the phone on the floor, and record, or upload an existing video.
2. Pose tracking runs on-device and draws a **skeleton overlay**; code counts reps and calculates metrics for each rep.
3. A **rep-by-rep timeline**: depth per rep, speed per rep, flags on the rep where form broke down.
4. **Coach notes**: the AI reads the *metrics only* (never the video) and gives 1–2 prioritized cues, with the reasoning shown.

**What the AI does / doesn't do**
| AI does | Code / ML does |
|---|---|
| Translates metrics into plain cues | Pose tracking, rep detection, every measurement |
| Prioritizes what matters most | Confidence scoring; refuses to judge bad camera angles |
| | Keeps video on the device |

**Signature interactions**
- **Scrubbable rep timeline** synced with the video and skeleton overlay.
- **Camera-setup coach**: live guidance (*"move back, I can't see your feet"*) before recording.
- **"Not sure" states**: when tracking confidence is low, it says so instead of guessing.

**MVP (≈3–4 weeks):** squat only, uploaded video → overlay → per-rep depth & speed → cues. Defer: live camera, other lifts.

**Stack:** Next.js, MediaPipe Tasks Vision (web), Canvas/WebGL overlay, Web Workers, Claude for cues from structured metrics.

**What it shows:** on-device ML in the browser, video and canvas craft, performance work, privacy-first design, careful uncertainty UX. **The best demo video of the four.**

**Risks:** The hardest build here. Tracking accuracy varies with camera angle and lighting, and mobile performance is a challenge. Frame it as *measurement plus cues*, not injury prevention or medical advice.

**Case study hook:** *"Your form video never leaves your phone. The AI only ever sees the numbers."*

**Effort:** ●●●● · **Wow factor:** ●●●● · **Originality:** ●●●○

---

## Concept D: **First Rep** *(small, polished)*
### *Point your phone at any gym machine.*

**The problem.** Gym anxiety is real. Beginners skip machines they don't understand rather than look lost. YouTube is slow, and the instruction placards are worn or confusing.

**How it works.** Snap a photo of a machine, and the AI identifies it (with confidence shown and a "did you mean…?" choice) and returns a **structured card**: what it works, a 3-step setup (seat height, grip, range), a common mistake, a starter weight range, and "if it's taken, try…" alternatives. Save cards to build *your gym*.

**AI's role:** image → identification → a strict card schema. Content comes from a curated exercise library that the AI maps to, so instructions aren't made up.

**MVP (≈1 week).** A small, crafted, highly shareable project, like the allergy card idea earlier: a 10-second moment where every detail matters.

**What it shows:** multimodal input, confidence and disambiguation UX, designing for anxious beginners, polish.

**Effort:** ●○○○ · **Wow factor:** ●●○○ · **Originality:** ●●○○

---

## How they compare

| | Blueprint | Plateau | Depth | First Rep |
|---|---|---|---|---|
| AI type | Documents → rules, plans as diffs | Tool calling, generative UI | On-device vision + LLM | Image → structured card |
| Frontend showcase | Review UI, diffs, offline gym mode | Data viz, streaming | Video, canvas, performance | Micro-interactions, polish |
| Build time | ~3 wks | ~2 wks | ~3–4 wks | ~1 wk |
| Demo-ability | High | High | Very high | Medium |
| Dogfood it yourself | ✅ | ✅ (your real logs) | ✅ | Partially |
| Overlap with Tally | Low | Low | None | None |

---

## Recommendation

**Build Blueprint + Plateau.**
- Together they cover two clearly different AI patterns (*extraction + verification + diffs* and *tool calling + generative UI*) and two frontend strengths (*workflow product* and *data viz*).
- Both use the same "AI for fuzzy, code for exact" idea, so your portfolio reads as having a point of view, not just projects.
- They connect: Blueprint's workout logs can feed Plateau later, but each works on its own (Plateau imports CSVs).
- You can use both yourself starting week one, which means real data, real screenshots and real opinions in the case studies.

**Add Depth** as a third, standout project if you want a jaw-dropping demo and are up for the hardest build.

---

## Next steps (once you pick)
1. Lock the concept: problem statement, target user, success criteria.
2. Quick validation: 4–5 conversations with lifters from your gym or community, plus a teardown of competitor apps.
3. Core flow + wireframes for the signature interaction.
4. Set up the repo and design tokens; build the AI pipeline first (it carries the most risk).
5. Prototype → test with 3–5 lifters → ship → write the case study.

*Earlier concept: the caregiving hub brief (`caregiving-hub/01-problem-and-research.md`) is parked, not deleted.*
