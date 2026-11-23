# English Teaching Studio — notes for Claude Code

Private teaching-material studio for Antony Addy (native British English trainer, adult learners in France). General English is the default context; never add luxury retail. CEFR A0–C2 plus mixed groups. Natural British English; French support where useful.

Stack: Next.js 15 (App Router), TypeScript, Zod 4, `@anthropic-ai/sdk`, `docx`, `jszip`. Deployed on Vercel. **No database, no Supabase, no accounts** — lessons/templates live in localStorage (`lib/storage.ts`). Don't add paid infrastructure without asking. **The owner does not want paid AI keys**: the main generation route is copy/paste through claude.ai (Claude Pro). The API route stays as optional code but must never be required.

## Rules that the code enforces (keep them)
- `lib/normalise.ts` runs on every generated/imported lesson: plan timings are refitted to the exact duration, multiple-choice correct positions are balanced (`balancedPositions`), true/false items get `correctIndex`.
- `lib/learner.ts` strips answers, explanations, model answers, teacher tips, plan and notes. Learner view and learner exports must be built from `toLearnerLesson`, never by hiding with CSS.
- Exercises have at least 10 items (`settingsSchema.questionsPerExercise` min 10).
- Kahoot export follows Kahoot's template (headers row 8, data from row 9, columns B–H; question ≤120 chars, answers ≤75).
- Prompts live in `lib/prompt.ts` and are shared by the API and the Claude.ai copy/paste route.
- API keys are server-only. Production refuses generation without `APP_ACCESS_KEY`.

## Commands
`npm run dev` · `npm run typecheck` · `npm test` · `npm run build` · `npm run check` (all). CI (`.github/workflows/quality.yml`) runs `npm ci`, typecheck, tests and build.

Never claim a feature works without running it. No real API key is available in development; the AI route is tested with injected fake completers (`tests/api.test.ts`).
