# English Teaching Studio

A private studio for creating ready-to-teach **British English** materials for adult learners in France — lesson plans with exact timings, bilingual EN/FR vocabulary, grammar, exercises, speaking activities, reading and writing, and TOEIC / CLOE practice — with **teacher and learner versions**, in-place editing, and **PDF, Word (.docx) and Kahoot** exports.

Built with Next.js 15, TypeScript and Zod. No database, no accounts: lessons and templates are saved in your browser.

## How it works

1. **Set up** — choose the material type, topic, context (General English by default), CEFR level (A0–C2 or a mixed group), duration, questions per exercise (10–40), multiple-choice options (3 or 4) and speaking activities. Start from a template or save your own.
2. **Generate** — two ways:
   - **One click with the AI API** (needs an API key on the server — see costs below).
   - **Free with Claude.ai**: copy the prompt, paste it into claude.ai (covered by your Claude Pro subscription), paste the reply back. The studio validates and imports it.
3. **Edit** — switch between teacher and learner versions; click **Edit** to change any text, answer, option, timing or item; move, duplicate, delete or add sections; **Rewrite with AI** regenerates one section only; **Undo** restores the previous version. Quality checks flag short exercises, duplicates, timing errors and American spellings.
4. **Export** — learner/teacher PDF (print → Save as PDF), learner/teacher Word, Kahoot `.xlsx` (import directly in Kahoot) and `.csv`, and a `.json` backup.

What the studio guarantees after every generation or import (enforced in code, not just requested in the prompt):

- Lesson-plan stages add up **exactly** to the lesson length (rescaled proportionally).
- Multiple-choice answers are re-ordered so correct positions are **balanced and unpredictable** (each position used evenly, never three in a row).
- The **learner version** never contains answers, explanations, model answers, teacher tips, the lesson plan or teacher notes — they are removed from the data, not hidden with CSS.
- Kahoot exports follow Kahoot's template layout and limits (question ≤ 120 characters, answers ≤ 75, allowed time limits).

## Material types

Complete lesson · Vocabulary bank · Grammar workshop · Exercise pack · Speaking pack (role-play, debate, discussion, Would You Rather, This or That, conversation cards, Spin the Wheel) · Reading & writing · TOEIC / CLOE practice · Kahoot quiz.

Contexts: General English, Business English, Hospitality & Tourism, Journalism & Media, Commercial Administration, Transport & Logistics, TOEIC, CLOE, or a custom context. (No luxury retail.)

## Run locally

Requires Node.js 20.9 or later.

```bash
npm install
cp .env.example .env.local   # optional: add keys
npm run dev                  # http://localhost:3000
```

Without any key you can use "Generate with Claude.ai" and the sample lesson. In development the access key is optional.

```bash
npm run typecheck   # TypeScript
npm test            # unit + API tests (node:test)
npm run build       # production build
npm run check       # all three
```

## Deploy to Vercel

1. In Vercel: **Add New → Project → Import** `addyap2/english-teaching-studio-ai`. Framework preset: Next.js (detected). No build settings to change.
2. Add environment variables (Project → Settings → Environment Variables):
   - `APP_ACCESS_KEY` — a long private passphrase (**required** in production for one-click generation).
   - `ANTHROPIC_API_KEY` — optional; enables one-click generation.
   - Optional: `ANTHROPIC_MODEL`, or `OPENAI_API_KEY` / `OPENAI_MODEL` / `AI_PROVIDER=openai`.
3. Deploy. Every push to `main` redeploys.

The generate route allows up to 300 seconds (Vercel Hobby with Fluid compute, the default for new projects). A complete lesson usually takes one to three minutes.

## Costs — read this

- **Claude Pro ≠ API access.** Your Claude Pro subscription covers the free "Generate with Claude.ai" route. One-click generation uses the **Anthropic API**, a separate pay-as-you-go account at <https://console.anthropic.com> (add a payment method and credit).
- Default model `claude-opus-5-5` ($4 / $20 per million input / output tokens). A complete lesson is roughly 4k input + 10–15k output tokens: **about $0.20–0.35 per lesson**; a section rewrite costs a few cents. `ANTHROPIC_MODEL=claude-sonnet-5-5` roughly halves that.
- OpenAI is supported as an alternative, also billed separately. You do not need it.
- Vercel Hobby is free for personal use. Nothing else is required: no database, no storage service.
- Built-in protection: the access key, and a limit of 30 generations per hour per IP (per server instance).

## Data and privacy

- Lessons, templates and settings live in your browser's local storage. Clearing site data deletes them — use **Library → Back up library** to keep a copy or move to another device.
- Generation requests send only the lesson settings (topic, level, notes) to the AI provider. API keys stay on the server.

## Project structure

```
app/                 Next.js app (page, layout, styles, API routes)
  api/generate       POST: whole lesson or one section (access key, rate limit, validation)
  api/status         GET: which features the server has configured (never the keys)
components/          Studio shell, setup, generate, worksheet editor, export, library, wheel
lib/
  schema.ts          Zod schemas for settings and lesson content
  prompt.ts          Shared prompts (server and Claude.ai copy/paste)
  normalise.ts       JSON extraction, timings, balanced answers, quality checks
  learner.ts         Learner version (answers removed)
  ai/                Provider (Anthropic SDK / OpenAI), generation with one repair pass, request handler
  exports/           DOCX builder, Kahoot XLSX/CSV
  samples.ts         Hand-written B1 sample lesson (also the test fixture)
tests/               node:test suites
```
