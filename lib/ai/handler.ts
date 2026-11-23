import { z } from 'zod';
import { settingsSchema, formatZodIssues, SECTION_TYPES } from '../schema';
import { checkAccess, clientIp, RateLimiter } from '../security';
import { generateLesson, regenerateSection } from './generate';
import { getCompleter, getProviderConfig, ProviderError, type CompleteFn, type ProviderConfig } from './provider';

const MAX_BODY_BYTES = 64_000;

const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('lesson'), settings: settingsSchema }),
  z.object({
    action: z.literal('section'),
    settings: settingsSchema,
    sectionType: z.enum(SECTION_TYPES),
    request: z.string().trim().max(600).default(''),
    lesson: z.object({
      title: z.string().max(300),
      summary: z.string().max(2000),
      level: z.string().max(60),
      keyLanguage: z.array(z.string().max(300)).max(40).default([]),
    }),
    current: z.unknown().optional(),
  }),
]);

export interface HandlerDeps {
  env?: NodeJS.ProcessEnv;
  limiter?: RateLimiter;
  /** Injected in tests; otherwise the configured provider is used. */
  completer?: (config: ProviderConfig) => CompleteFn;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });

export function createGenerateHandler(deps: HandlerDeps = {}) {
  const limiter = deps.limiter ?? new RateLimiter(30, 60 * 60 * 1000);
  return async function POST(request: Request): Promise<Response> {
    const env = deps.env ?? process.env;
    try {
      const access = checkAccess(request.headers.get('x-access-key'), env);
      if (!access.ok) return json({ error: access.error }, access.status);

      const provider = getProviderConfig(env);
      if (!provider)
        return json(
          { error: 'No AI provider is configured on the server. Add ANTHROPIC_API_KEY (or OPENAI_API_KEY), or use “Generate with Claude.ai” instead.', code: 'no-provider' },
          503,
        );

      const raw = await request.text();
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return json({ error: 'Request too large.' }, 413);
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        return json({ error: 'Invalid JSON.' }, 400);
      }
      const parsed = requestSchema.safeParse(payload);
      if (!parsed.success) return json({ error: 'Please check the form.', details: formatZodIssues(parsed.error) }, 400);

      const rate = limiter.take(clientIp(request.headers));
      if (!rate.ok) return json({ error: `Hourly generation limit reached. Try again in ${Math.ceil(rate.retryAfter / 60)} min.` }, 429, { 'retry-after': String(rate.retryAfter) });

      const complete = (deps.completer ?? getCompleter)(provider);
      const body = parsed.data;
      if (body.action === 'lesson') {
        const { lesson, warnings } = await generateLesson(body.settings, complete);
        return json({ lesson, warnings, provider: provider.name, model: provider.model });
      }
      const section = await regenerateSection(body.settings, body.lesson, body.sectionType, body.request, body.current, complete);
      return json({ section });
    } catch (error) {
      if (error instanceof ProviderError) return json({ error: error.message }, error.status);
      console.error('Generation failed:', error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error');
      return json({ error: 'Generation failed unexpectedly. Please try again.' }, 500);
    }
  };
}
