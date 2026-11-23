# Deployment checklist

- [ ] `npm run check` passes locally (typecheck, tests, build); CI is green on `main`.
- [ ] Vercel project imported from `addyap2/english-teaching-studio-ai` (Next.js preset).
- [ ] `APP_ACCESS_KEY` set in Vercel (long passphrase) — required for one-click generation in production.
- [ ] Optional: `ANTHROPIC_API_KEY` set, with credit on the Anthropic console account.
- [ ] Optional: `ANTHROPIC_MODEL` if you want a cheaper model than the default `claude-opus-5-5`.
- [ ] Redeploy after changing environment variables.
- [ ] On the live site: Generate step shows "Generate with the AI API" as available; generate one lesson; check timings, answers and learner view.
- [ ] Export a learner PDF, a Word file and a Kahoot .xlsx; import the .xlsx into Kahoot once to confirm.
- [ ] Back up the library (Library → Back up library) from time to time.
