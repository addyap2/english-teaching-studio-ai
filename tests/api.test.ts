import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGenerateHandler } from '../lib/ai/handler';
import { getProviderConfig, type CompleteFn } from '../lib/ai/provider';
import { buildLessonPrompt, buildManualPrompt } from '../lib/prompt';
import { checkAccess, RateLimiter } from '../lib/security';
import { SAMPLE_LESSON } from '../lib/samples';
import { DEFAULT_SETTINGS, type Lesson } from '../lib/schema';

const env = (extra: Record<string, string> = {}) => ({ NODE_ENV: 'production', APP_ACCESS_KEY: 'secret-pass', ANTHROPIC_API_KEY: 'sk-test', ...extra }) as NodeJS.ProcessEnv;

const req = (body: unknown, headers: Record<string, string> = { 'x-access-key': 'secret-pass' }) =>
  new Request('http://localhost/api/generate', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

const replying = (...replies: string[]) => {
  const calls: string[] = [];
  const fn: CompleteFn = async ({ user }) => {
    calls.push(user);
    return { text: replies[Math.min(calls.length - 1, replies.length - 1)], truncated: false };
  };
  return { fn, calls };
};

test('production refuses to run without an access key configured', async () => {
  const handler = createGenerateHandler({ env: env({ APP_ACCESS_KEY: '' }) });
  const res = await handler(req({ action: 'lesson', settings: DEFAULT_SETTINGS }));
  assert.equal(res.status, 503);
});

test('wrong access key is rejected', async () => {
  const handler = createGenerateHandler({ env: env() });
  const res = await handler(req({ action: 'lesson', settings: DEFAULT_SETTINGS }, { 'x-access-key': 'nope' }));
  assert.equal(res.status, 401);
});

test('no provider gives a clear 503 that the UI can act on', async () => {
  const handler = createGenerateHandler({ env: env({ ANTHROPIC_API_KEY: '' }) });
  const res = await handler(req({ action: 'lesson', settings: DEFAULT_SETTINGS }));
  assert.equal(res.status, 503);
  assert.equal((await res.json()).code, 'no-provider');
});

test('invalid body and invalid settings are rejected', async () => {
  const handler = createGenerateHandler({ env: env(), completer: () => replying('{}').fn });
  assert.equal((await handler(req('not json'))).status, 400);
  const res = await handler(req({ action: 'lesson', settings: { ...DEFAULT_SETTINGS, questionsPerExercise: 3 } }));
  assert.equal(res.status, 400);
  assert.match(JSON.stringify(await res.json()), /at least 10/);
});

test('successful generation returns a normalised lesson', async () => {
  const fake = replying('```json\n' + JSON.stringify(SAMPLE_LESSON) + '\n```');
  const handler = createGenerateHandler({ env: env(), completer: () => fake.fn });
  const res = await handler(req({ action: 'lesson', settings: { ...DEFAULT_SETTINGS, duration: 60 } }));
  assert.equal(res.status, 200);
  const body = (await res.json()) as { lesson: Lesson; warnings: string[] };
  const plan = body.lesson.sections.find((s) => s.type === 'plan');
  assert.ok(plan && plan.type === 'plan');
  assert.equal(plan.stages.reduce((a, s) => a + s.minutes, 0), 60);
  assert.equal(body.lesson.focus, 'General English');
  assert.ok(Array.isArray(body.warnings));
  assert.equal(fake.calls.length, 1);
});

test('an invalid AI reply triggers exactly one repair attempt with the errors', async () => {
  const fake = replying('{"title": "Half a lesson"}', JSON.stringify(SAMPLE_LESSON));
  const handler = createGenerateHandler({ env: env(), completer: () => fake.fn });
  const res = await handler(req({ action: 'lesson', settings: DEFAULT_SETTINGS }));
  assert.equal(res.status, 200);
  assert.equal(fake.calls.length, 2);
  assert.match(fake.calls[1], /failed validation/);
});

test('a reply that stays invalid gives a 502, not a crash', async () => {
  const fake = replying('nonsense');
  const handler = createGenerateHandler({ env: env(), completer: () => fake.fn });
  const res = await handler(req({ action: 'lesson', settings: DEFAULT_SETTINGS }));
  assert.equal(res.status, 502);
  assert.equal(fake.calls.length, 2);
});

test('single-section regeneration returns only that section type', async () => {
  const vocab = SAMPLE_LESSON.sections.find((s) => s.type === 'vocabulary');
  const fake = replying(JSON.stringify({ section: vocab }));
  const handler = createGenerateHandler({ env: env(), completer: () => fake.fn });
  const res = await handler(
    req({ action: 'section', settings: DEFAULT_SETTINGS, sectionType: 'vocabulary', request: 'More phrasal verbs', lesson: { title: 'T', summary: 'S', level: 'B1', keyLanguage: [] } }),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.section.type, 'vocabulary');
  assert.match(fake.calls[0], /More phrasal verbs/);
});

test('rate limiter blocks after the limit and resets', () => {
  const rl = new RateLimiter(2, 1000);
  assert.ok(rl.take('a', 0).ok);
  assert.ok(rl.take('a', 1).ok);
  assert.equal(rl.take('a', 2).ok, false);
  assert.ok(rl.take('b', 2).ok);
  assert.ok(rl.take('a', 1001).ok);
});

test('access is open in development without a key, closed in production', () => {
  assert.deepEqual(checkAccess(null, { NODE_ENV: 'development' } as unknown as NodeJS.ProcessEnv), { ok: true });
  assert.equal(checkAccess(null, { NODE_ENV: 'production' } as unknown as NodeJS.ProcessEnv).ok, false);
});

test('provider selection prefers Anthropic and honours AI_PROVIDER', () => {
  assert.equal(getProviderConfig({ ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o' } as unknown as NodeJS.ProcessEnv)?.name, 'anthropic');
  assert.equal(getProviderConfig({ ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o', AI_PROVIDER: 'openai' } as unknown as NodeJS.ProcessEnv)?.name, 'openai');
  assert.equal(getProviderConfig({ OPENAI_API_KEY: 'o' } as unknown as NodeJS.ProcessEnv)?.model, 'gpt-4.1-mini');
  assert.equal(getProviderConfig({} as NodeJS.ProcessEnv), null);
});

test('prompts carry the settings and the pedagogical rules', () => {
  const prompt = buildLessonPrompt({ ...DEFAULT_SETTINGS, level: 'Mixed', mixedRange: 'A2–B1', questionsPerExercise: 15, focus: 'Transport & Logistics' });
  assert.match(prompt, /Mixed-level group \(A2–B1\)/);
  assert.match(prompt, /15 items/);
  assert.match(prompt, /Incoterms/);
  assert.match(prompt, /exactly 90/);
  const manual = buildManualPrompt(DEFAULT_SETTINGS);
  assert.match(manual, /British spelling/);
  assert.match(manual, /luxury retail/);
  assert.match(manual, /ONE JSON object/);
});
