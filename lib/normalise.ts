import {
  lessonSchema,
  sectionSchema,
  formatZodIssues,
  TEACHER_ONLY_TYPES,
  type ExerciseItem,
  type ExerciseSection,
  type Lesson,
  type Section,
  type Settings,
} from './schema';

/* ------------------------------------------------------------------ */
/* Randomness                                                          */
/* ------------------------------------------------------------------ */

export type Rng = () => number;

/** Small seeded PRNG (mulberry32) so tests are reproducible. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function makeId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

/**
 * Correct-answer positions for `count` questions with `choices` options each.
 * Every position is used as evenly as possible (counts differ by at most one),
 * the order is shuffled, and no position appears more than twice in a row, so
 * learners cannot spot a pattern such as "it's always B".
 */
export function balancedPositions(count: number, choices: number, rng: Rng = Math.random): number[] {
  if (count <= 0) return [];
  if (choices <= 1) return Array(count).fill(0);
  const pool: number[] = [];
  const start = Math.floor(rng() * choices); // which positions get the "extra" use
  for (let i = 0; i < count; i++) pool.push((start + i) % choices);
  let seq = shuffle(pool, rng);
  for (let attempt = 0; attempt < 50 && hasLongRun(seq); attempt++) seq = breakRuns(shuffle(pool, rng));
  return seq;
}

function hasLongRun(seq: number[], max = 2): boolean {
  let run = 1;
  for (let i = 1; i < seq.length; i++) {
    run = seq[i] === seq[i - 1] ? run + 1 : 1;
    if (run > max) return true;
  }
  return false;
}

function breakRuns(seq: number[]): number[] {
  const out = [...seq];
  for (let i = 2; i < out.length; i++) {
    if (out[i] === out[i - 1] && out[i] === out[i - 2]) {
      const j = out.findIndex((v, k) => k > i && v !== out[i]);
      if (j > -1) [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Timings                                                             */
/* ------------------------------------------------------------------ */

/**
 * Rescales stage minutes so they add up exactly to `total`, keeping their
 * proportions (largest-remainder rounding) and giving every stage at least
 * two minutes when the total allows it.
 */
export function fitTimings(minutes: number[], total: number): number[] {
  const n = minutes.length;
  if (n === 0) return [];
  const floor = total >= n * 2 ? 2 : total >= n ? 1 : 0;
  const weights = minutes.map((m) => (Number.isFinite(m) && m > 0 ? m : 1));
  const fixed = new Array<boolean>(n).fill(false);
  let raw = new Array<number>(n).fill(floor);
  // Give the floor to stages that would fall below it, share the rest proportionally.
  for (let guard = 0; guard <= n; guard++) {
    const free = weights.map((_, i) => i).filter((i) => !fixed[i]);
    const budget = total - floor * (n - free.length);
    const weightSum = free.reduce((a, i) => a + weights[i], 0);
    raw = raw.map((r, i) => (fixed[i] ? floor : (weights[i] / weightSum) * budget));
    const under = free.filter((i) => raw[i] < floor);
    if (!under.length) break;
    under.forEach((i) => (fixed[i] = true));
  }
  const out = raw.map((r) => Math.floor(r));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) out[order[k].i]++;
  return out;
}

/** "0:00–0:10" style clock labels for each stage. */
export function stageClock(minutes: number[]): string[] {
  let t = 0;
  const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  return minutes.map((m) => {
    const label = `${fmt(t)}–${fmt(t + m)}`;
    t += m;
    return label;
  });
}

/* ------------------------------------------------------------------ */
/* Parsing model output                                                */
/* ------------------------------------------------------------------ */

/** Pulls the first JSON object out of a model reply (handles ```json fences and chatter). */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object found in the response.');
  const body = candidate.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch {
    // Common model slip: trailing commas.
    return JSON.parse(body.replace(/,\s*([}\]])/g, '$1'));
  }
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function parseLesson(input: unknown): ParseResult<Lesson> {
  const parsed = lessonSchema.safeParse(input);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, errors: formatZodIssues(parsed.error) };
}

export function parseSection(input: unknown): ParseResult<Section> {
  const candidate =
    input && typeof input === 'object' && 'section' in input ? (input as { section: unknown }).section : input;
  const parsed = sectionSchema.safeParse(candidate);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, errors: formatZodIssues(parsed.error) };
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

const norm = (s: string) => s.trim().toLowerCase().replace(/[.!?]+$/, '');

/** Finds the index of the correct option, trusting `answer` over `correctIndex`. */
export function resolveCorrectIndex(item: ExerciseItem): number {
  const options = item.options ?? [];
  const byText = options.findIndex((o) => norm(o) === norm(item.answer));
  if (byText > -1) return byText;
  const letter = item.answer.trim().match(/^([A-Da-d])[).:]?$/);
  if (letter) return letter[1].toUpperCase().charCodeAt(0) - 65;
  if (item.correctIndex !== undefined && item.correctIndex < options.length) return item.correctIndex;
  return -1;
}

/** Re-orders multiple-choice options so correct answers follow a balanced, unpredictable pattern. */
export function randomiseExercise(section: ExerciseSection, rng: Rng = Math.random): ExerciseSection {
  if (section.kind !== 'multiple-choice') return section;
  const usable = section.items.map((item) => ({ item, idx: resolveCorrectIndex(item) }));
  const choices = Math.max(2, ...usable.map((u) => u.item.options?.length ?? 0));
  const targets = balancedPositions(usable.length, choices, rng);
  const items = usable.map(({ item, idx }, n) => {
    const options = item.options ?? [];
    if (idx < 0 || options.length < 2) return item;
    const correct = options[idx];
    const distractors = shuffle(
      options.filter((_, i) => i !== idx),
      rng,
    );
    const target = targets[n] % options.length;
    const reordered = [...distractors.slice(0, target), correct, ...distractors.slice(target)];
    return { ...item, options: reordered, correctIndex: target, answer: correct };
  });
  return { ...section, items };
}

export function normaliseSection(section: Section, rng: Rng = Math.random): Section {
  const withId = { ...section, id: section.id ?? makeId(section.type) } as Section;
  if (TEACHER_ONLY_TYPES.includes(withId.type)) withId.teacherOnly = true;
  if (withId.type === 'exercise') {
    let ex = withId;
    if (ex.kind === 'true-false') {
      ex = {
        ...ex,
        items: ex.items.map((it) => {
          const isTrue = /^(t|true|vrai|yes)\b/i.test(it.answer.trim());
          return { ...it, options: ['True', 'False'], answer: isTrue ? 'True' : 'False', correctIndex: isTrue ? 0 : 1 };
        }),
      };
    }
    return randomiseExercise(ex, rng);
  }
  return withId;
}

/**
 * Makes an AI (or imported) lesson safe to display: ids, teacher-only flags,
 * exact timings, balanced answer positions, and the requested metadata.
 */
export function normaliseLesson(lesson: Lesson, settings?: Partial<Settings>, rng: Rng = Math.random): Lesson {
  const duration = settings?.duration ?? lesson.duration;
  const sections = lesson.sections.map((s) => {
    const out = normaliseSection(s, rng);
    if (out.type === 'plan' && duration > 0) {
      const fitted = fitTimings(
        out.stages.map((st) => st.minutes),
        duration,
      );
      return { ...out, stages: out.stages.map((st, i) => ({ ...st, minutes: fitted[i] })) };
    }
    return out;
  });
  const now = new Date().toISOString();
  return {
    ...lesson,
    id: lesson.id ?? makeId('lesson'),
    duration,
    level: settings?.level === 'Mixed' && settings.mixedRange ? `Mixed (${settings.mixedRange})` : settings?.level ?? lesson.level,
    focus: settings?.focus ?? lesson.focus,
    materialType: settings?.materialType ?? lesson.materialType,
    sections,
    createdAt: lesson.createdAt ?? now,
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/* Quality checks — warnings shown to the teacher, never silent         */
/* ------------------------------------------------------------------ */

const AMERICANISMS: Record<string, string> = {
  color: 'colour',
  colors: 'colours',
  favorite: 'favourite',
  center: 'centre',
  theater: 'theatre',
  neighbor: 'neighbour',
  flavor: 'flavour',
  humor: 'humour',
  behavior: 'behaviour',
  labor: 'labour',
  traveling: 'travelling',
  traveled: 'travelled',
  canceled: 'cancelled',
  jewelry: 'jewellery',
  catalog: 'catalogue',
  gray: 'grey',
  apartment: 'flat',
  vacation: 'holiday',
  cellphone: 'mobile phone',
  'parking lot': 'car park',
  sidewalk: 'pavement',
  analyze: 'analyse',
  fulfill: 'fulfil',
  enrollment: 'enrolment',
  aluminum: 'aluminium',
};

function allText(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allText(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => allText(v, out));
  return out;
}

export function qualityReport(lesson: Lesson, settings?: Partial<Settings>): string[] {
  const warnings: string[] = [];
  const wanted = settings?.questionsPerExercise ?? 10;
  const exercises = lesson.sections.filter((s): s is ExerciseSection => s.type === 'exercise');

  for (const ex of exercises) {
    if (ex.kind !== 'open-questions' && ex.items.length < wanted)
      warnings.push(`“${ex.title}” has ${ex.items.length} questions (you asked for ${wanted}).`);
    const seen = new Set<string>();
    ex.items.forEach((item, i) => {
      const key = norm(item.prompt);
      if (seen.has(key)) warnings.push(`“${ex.title}”: question ${i + 1} repeats an earlier question.`);
      seen.add(key);
      if (ex.kind === 'multiple-choice') {
        const opts = item.options ?? [];
        if (opts.length < 2) warnings.push(`“${ex.title}”: question ${i + 1} has no answer options.`);
        else if (new Set(opts.map(norm)).size !== opts.length)
          warnings.push(`“${ex.title}”: question ${i + 1} has duplicate options.`);
        else if (resolveCorrectIndex(item) < 0)
          warnings.push(`“${ex.title}”: question ${i + 1} — the answer is not one of the options.`);
      }
    });
  }

  for (const s of lesson.sections) {
    if (s.type === 'plan' && lesson.duration > 0) {
      const sum = s.stages.reduce((a, st) => a + st.minutes, 0);
      if (sum !== lesson.duration) warnings.push(`Lesson plan stages add up to ${sum} min, not ${lesson.duration}.`);
    }
    if (s.type === 'vocabulary') {
      const terms = s.items.map((v) => norm(v.term));
      const dupes = terms.filter((t, i) => terms.indexOf(t) !== i);
      if (dupes.length) warnings.push(`Vocabulary repeats: ${[...new Set(dupes)].join(', ')}.`);
    }
  }

  const body = allText(lesson.sections).join(' \n ');
  if (/\bluxury\b/i.test(body)) warnings.push('The material mentions luxury retail, which is outside your usual scope — check it.');
  const found = Object.entries(AMERICANISMS)
    .filter(([us]) => new RegExp(`\\b${us}\\b`, 'i').test(body))
    .map(([us, uk]) => `${us} → ${uk}`);
  if (found.length) warnings.push(`Possible American English: ${found.slice(0, 6).join(', ')}.`);

  return warnings;
}
