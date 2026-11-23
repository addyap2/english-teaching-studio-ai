# Deployment checklist

The studio is deployed on Vercel (Hobby, free) at https://english-teaching-studio-ai.vercel.app and redeploys on every push to `main`. No environment variables are required.

- [ ] `npm run check` passes locally; CI is green on `main`.
- [ ] On the live site: Setup → Generate → copy the prompt into claude.ai → paste the reply → Import lesson.
- [ ] Check timings, answers and the learner version.
- [ ] Export a learner PDF, a Word file and a Kahoot .xlsx; import the .xlsx into Kahoot once to confirm.
- [ ] Back up the library (Library → Back up library) from time to time.

Optional and paid (not set up): one-click generation needs `ANTHROPIC_API_KEY` and `APP_ACCESS_KEY` in Vercel — see `.env.example`.
