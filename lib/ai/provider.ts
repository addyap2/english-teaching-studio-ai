import Anthropic from '@anthropic-ai/sdk';

/**
 * Server-only. Keys are read from environment variables and never sent to the browser.
 *
 * Provider choice:
 *   AI_PROVIDER=anthropic | openai   (optional; otherwise the first configured key wins, Anthropic first)
 *   ANTHROPIC_API_KEY, ANTHROPIC_MODEL (default claude-opus-5-5)
 *   OPENAI_API_KEY,    OPENAI_MODEL    (default gpt-4.1-mini)
 */

export type ProviderName = 'anthropic' | 'openai';

export interface ProviderConfig {
  name: ProviderName;
  model: string;
}

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';
export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';

export function getProviderConfig(env: NodeJS.ProcessEnv = process.env): ProviderConfig | null {
  const wanted = env.AI_PROVIDER?.trim().toLowerCase();
  const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY?.trim());
  const hasOpenAI = Boolean(env.OPENAI_API_KEY?.trim());
  const anthropic = { name: 'anthropic' as const, model: env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL };
  const openai = { name: 'openai' as const, model: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL };
  if (wanted === 'anthropic') return hasAnthropic ? anthropic : null;
  if (wanted === 'openai') return hasOpenAI ? openai : null;
  if (hasAnthropic) return anthropic;
  if (hasOpenAI) return openai;
  return null;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface Completion {
  text: string;
  truncated: boolean;
}

export type CompleteFn = (args: { system: string; user: string; maxTokens: number }) => Promise<Completion>;

async function completeAnthropic(model: string, { system, user, maxTokens }: Parameters<CompleteFn>[0]): Promise<Completion> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 280_000 });
  try {
    // Streaming keeps long generations (10k+ tokens) clear of HTTP timeouts.
    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      system,
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: user }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') throw new ProviderError('The AI model declined this request. Try rephrasing the topic.', 422);
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return { text, truncated: message.stop_reason === 'max_tokens' };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new ProviderError('The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.', 502);
    if (error instanceof Anthropic.PermissionDeniedError) throw new ProviderError('The Anthropic account cannot use this model. Check ANTHROPIC_MODEL or billing.', 502);
    if (error instanceof Anthropic.NotFoundError) throw new ProviderError(`Model “${model}” was not found. Check ANTHROPIC_MODEL.`, 502);
    if (error instanceof Anthropic.RateLimitError) throw new ProviderError('The AI provider is rate-limiting requests. Wait a minute and try again.', 429);
    if (error instanceof Anthropic.BadRequestError) throw new ProviderError('The AI provider rejected the request (often billing or credit). Check your Anthropic console.', 502);
    if (error instanceof Anthropic.APIError) throw new ProviderError(`The AI provider returned an error (${error.status ?? 'network'}). Try again.`, 502);
    throw error;
  }
}

async function completeOpenAI(model: string, { system, user, maxTokens }: Parameters<CompleteFn>[0]): Promise<Completion> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      max_completion_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(280_000),
  });
  if (res.status === 401) throw new ProviderError('The OpenAI API key was rejected. Check OPENAI_API_KEY.', 502);
  if (res.status === 429) throw new ProviderError('OpenAI is rate-limiting requests or the account has no credit.', 429);
  if (!res.ok) throw new ProviderError(`OpenAI returned an error (${res.status}).`, 502);
  const data = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  const choice = data.choices?.[0];
  return { text: choice?.message?.content ?? '', truncated: choice?.finish_reason === 'length' };
}

export function getCompleter(config: ProviderConfig): CompleteFn {
  return (args) => (config.name === 'anthropic' ? completeAnthropic(config.model, args) : completeOpenAI(config.model, args));
}
