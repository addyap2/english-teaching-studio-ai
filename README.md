# English Teaching Studio AI

A Next.js 15 teaching-material generator for adult British English lessons, designed for Antony Addy.

## Features
- General English is the default focus; CEFR A0–C2 and mixed classes.
- 7 generation modes, bilingual English/French vocabulary, 10–30 MCQs, speaking prompts and lesson plans.
- Browser print-to-PDF, editable generated lesson JSON, downloadable vocabulary CSV and Kahoot CSV.
- Teacher/learner view; answers hidden in learner view.
- No Supabase or database. Vercel-ready.

## Local setup
```bash
npm install
cp .env.example .env.local
npm run dev
```
Configure `OPENAI_API_KEY` and a strong `APP_ACCESS_KEY` in `.env.local`.
Visit http://localhost:3000.

## Deploy
Import this repository in Vercel, set `OPENAI_API_KEY` and `APP_ACCESS_KEY` as environment variables, and deploy. OpenAI API usage is billed separately; a Claude Pro subscription does not cover it.

## Security
Never commit `.env.local` or your actual keys. Generation requests require the access key; the in-memory hourly limit is per server instance, not globally distributed.

## Status
Initial GitHub upload of the functional application foundation. Claude Code should run npm install, typecheck, tests, and production build, and expand exports and the lesson editor before production.
