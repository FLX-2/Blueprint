<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project conventions

- Read `README.md`, `design/README.md` and `docs/02-structure-and-flows.md` before building a feature.
- AI for the fuzzy parts, code for the exact parts: the model may propose, but every number shown comes from `src/lib/calc` (or a typed tool), never from model output.
- Use semantic tokens only (`bg-surface`, `text-muted`, `border-ai`…). Tailwind's default palette is intentionally removed.
- Amber (`ai`, `ai-mark`, `ai-wash`) is reserved for unconfirmed AI output. Warnings and errors use `danger`.
- Newsreader never goes on controls. Numbers use Geist Mono with tabular figures (`.num`).
- Keep seed data deterministic; if you change `src/data/seed/history.ts`, keep `npm test` passing.
