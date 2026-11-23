import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import config from '../next.config';

test('security headers are sent on every route', async () => {
  const rules = await config.headers!();
  const headers = Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));
  assert.equal(rules[0].source, '/:path*');
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.match(headers['Content-Security-Policy'], /connect-src 'self'/);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
});

test('no database or Supabase dependency, and secrets are git-ignored', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  assert.ok(!deps.some((d) => /supabase|prisma|mongoose|firebase|pg$/.test(d)));
  const ignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.match(ignore, /^\.env\.local$/m);
});

test('API keys are only read on the server', () => {
  for (const file of ['components/Studio.tsx', 'components/GenerateStep.tsx', 'lib/storage.ts']) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /process\.env/, file);
  }
});
