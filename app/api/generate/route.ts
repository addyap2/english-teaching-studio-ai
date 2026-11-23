import { createGenerateHandler } from '../../../lib/ai/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A full lesson can take 1–3 minutes to write. 300 s is the Vercel maximum on the Hobby plan (Fluid compute).
export const maxDuration = 300;

export const POST = createGenerateHandler();
