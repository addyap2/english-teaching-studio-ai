import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  balancedPositions,
  extractJson,
  fitTimings,
  normaliseLesson,
  parseLesson,
  qualityReport,
  randomiseExercise,
  resolveCorrectIndex,
  seededRng,
  stageClock,
} from '../lib/normalise';
import { toLearnerLesson } from '../lib/learner';
import { SAMPLE_LESSON } from '../lib/samples';
import { DEFAULT_SETTINGS, settingsSchema, type ExerciseSection } from '../lib/schema';
import { FOCUSES } from '../lib/options';

test('timings always add up exactly to the lesson length', () => {
  const rng = seededRng(7);
  for (const total of [15, 30, 45, 60, 75, 90, 120, 150, 180, 240]) {
    for (let run = 0; run < 50; run++) {
      const stages = Array.from({ length: 2 + Math.floor(rng() * 8) }, () => Math.floor(rng() * 40));
      const fitted = fitTimings(stages, total);
      assert.equal(fitted.reduce((a, b) => a + b, 0), total, `total ${total} for ${stages}`);
      assert.ok(fitted.every((m) => m >= (total >= 2 * stages.length ? 2 : 1)), 'every stage gets a minimum slot');
    }
  }
});

test('timings keep proportions', () => {
  assert.deepEqual(fitTimings([10, 20, 30], 60), [10, 20, 30]);
  assert.deepEqual(fitTimings([10, 20, 30], 120), [20, 40, 60]);
});

test('stage clock labels run continuously', () => {
  assert.deepEqual(stageClock([10, 20, 75]), ['0:00–0:10', '0:10–0:30', '0:30–1:45']);
});

test('correct-answer positions are balanced and never form long runs', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const count = 10 + (seed % 25);
    const seq = balancedPositions(count, 4, seededRng(seed));
    const counts = [0, 1, 2, 3].map((k) => seq.filter((v) => v === k).length);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `balanced: ${counts}`);
    for (let i = 2; i < seq.length; i++) assert.ok(!(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]), 'no three in a row');
  }
});

test('positions are not the same pattern every time', () => {
  const patterns = new Set(Array.from({ length: 20 }, (_, s) => balancedPositions(10, 4, seededRng(s + 1)).join('')));
  assert.ok(patterns.size > 15);
});

test('randomising multiple choice keeps each correct answer and spreads positions', () => {
  const mcq = SAMPLE_LESSON.sections.find((s): s is ExerciseSection => s.type === 'exercise' && s.kind === 'multiple-choice')!;
  // In the raw sample every correct answer is option A.
  assert.ok(mcq.items.every((it) => resolveCorrectIndex(it) === 0));
  const out = randomiseExercise(mcq, seededRng(42));
  out.items.forEach((item, i) => {
    assert.equal(item.options![item.correctIndex!], mcq.items[i].answer);
    assert.deepEqual([...item.options!].sort(), [...mcq.items[i].options!].sort());
  });
  const positions = new Set(out.items.map((i) => i.correctIndex));
  assert.equal(positions.size, 4);
});

test('answers can be given as text, letter or index', () => {
  const options = ['red', 'green', 'blue'];
  assert.equal(resolveCorrectIndex({ prompt: 'q', options, answer: 'Blue.', explanation: '' }), 2);
  assert.equal(resolveCorrectIndex({ prompt: 'q', options, answer: 'B', explanation: '' }), 1);
  assert.equal(resolveCorrectIndex({ prompt: 'q', options, answer: 'purple', correctIndex: 0, explanation: '' }), 0);
  assert.equal(resolveCorrectIndex({ prompt: 'q', options, answer: 'purple', explanation: '' }), -1);
});

test('JSON is extracted from fenced or chatty replies, including trailing commas', () => {
  assert.deepEqual(extractJson('Here you go:\n```json\n{"a": [1, 2,],}\n```\nEnjoy!'), { a: [1, 2] });
  assert.deepEqual(extractJson('{"b": "x"}'), { b: 'x' });
  assert.throws(() => extractJson('no json here'));
  // A long reply continued in a second Claude message, pasted together.
  assert.deepEqual(extractJson('```json\n{"a": [1,\n```\n\n```json\n 2]}\n```'), { a: [1, 2] });
});

test('lesson parsing reports precise problems', () => {
  const bad = parseLesson({ title: 'x', sections: [{ type: 'exercise', title: 'E' }] });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.errors.some((e) => e.includes('summary')));
});

test('normalised sample lesson passes every quality check', () => {
  const lesson = normaliseLesson(SAMPLE_LESSON, { duration: 90 }, seededRng(1));
  assert.deepEqual(qualityReport(lesson, { questionsPerExercise: 10 }), []);
  const plan = lesson.sections.find((s) => s.type === 'plan')!;
  assert.equal(plan.type === 'plan' && plan.stages.reduce((a, s) => a + s.minutes, 0), 90);
  assert.ok(lesson.sections.every((s) => s.id));
});

test('true/false items get a correct index the views can highlight', () => {
  const lesson = normaliseLesson(SAMPLE_LESSON);
  const tf = lesson.sections.find((s): s is ExerciseSection => s.type === 'exercise' && s.kind === 'true-false')!;
  assert.ok(tf.items.every((i) => i.options![i.correctIndex!] === i.answer));
  assert.equal(tf.items[1].correctIndex, 1);
});

test('changing the duration rescales the plan', () => {
  const lesson = normaliseLesson(SAMPLE_LESSON, { duration: 60 }, seededRng(1));
  const plan = lesson.sections.find((s) => s.type === 'plan');
  assert.ok(plan && plan.type === 'plan');
  assert.equal(plan.stages.reduce((a, s) => a + s.minutes, 0), 60);
});

test('quality report catches short exercises, Americanisms and luxury retail', () => {
  const lesson = structuredClone(SAMPLE_LESSON);
  const ex = lesson.sections.find((s): s is ExerciseSection => s.type === 'exercise')!;
  ex.items = ex.items.slice(0, 4);
  ex.items[0].prompt = 'What is your favorite color at the luxury boutique?';
  const warnings = qualityReport(lesson, { questionsPerExercise: 10 }).join('\n');
  assert.match(warnings, /has 4 questions/);
  assert.match(warnings, /favorite → favourite/);
  assert.match(warnings, /luxury/);
});

test('learner version contains no answers, explanations, model answers or teacher sections', () => {
  const learner = toLearnerLesson(normaliseLesson(SAMPLE_LESSON));
  assert.ok(!learner.sections.some((s) => s.type === 'plan' || s.type === 'notes'));
  for (const s of learner.sections) {
    if (s.type === 'exercise') assert.ok(s.items.every((i) => i.answer === '' && i.explanation === '' && i.correctIndex === undefined));
    if (s.type === 'writing') assert.equal(s.modelAnswer, '');
    if (s.type === 'speaking') assert.equal(s.teacherTips, '');
  }
  const text = JSON.stringify(learner);
  assert.ok(!text.includes('Use the present continuous, not the present simple, for arrangements') || text.includes('pitfalls'));
  assert.ok(!text.includes('Thanks for your message! Sunday sounds lovely'));
  // Matching keeps a shuffled right-hand column so learners can still do the task.
  const matching = learner.sections.find((s): s is ExerciseSection => s.type === 'exercise' && s.kind === 'matching')!;
  assert.equal(matching.wordBank?.length, 10);
});

test('settings: General English is the default, at least 10 questions, no luxury retail option', () => {
  assert.equal(DEFAULT_SETTINGS.focus, 'General English');
  assert.ok(settingsSchema.safeParse(DEFAULT_SETTINGS).success);
  assert.equal(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, questionsPerExercise: 9 }).success, false);
  assert.ok(!FOCUSES.some((f) => /luxury/i.test(f)));
});
