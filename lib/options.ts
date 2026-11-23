/**
 * Every choice the studio offers lives here, so the form, the prompts, the
 * validation and the tests all agree on one list.
 */

export const LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Mixed'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  A0: 'A0 · Absolute beginner',
  A1: 'A1 · Beginner',
  A2: 'A2 · Elementary',
  B1: 'B1 · Intermediate',
  B2: 'B2 · Upper intermediate',
  C1: 'C1 · Advanced',
  C2: 'C2 · Proficient',
  Mixed: 'Mixed-level group',
};

/** Contexts. General English is the default; there is deliberately no luxury retail option. */
export const FOCUSES = [
  'General English',
  'Business English',
  'Hospitality & Tourism',
  'Journalism & Media',
  'Commercial Administration',
  'Transport & Logistics',
  'TOEIC Preparation',
  'CLOE Preparation',
  'Custom context',
] as const;
export type Focus = (typeof FOCUSES)[number];

export const FOCUS_BRIEFS: Record<Focus, string> = {
  'General English': 'Everyday adult life: social situations, travel, work-life balance, culture, opinions and current topics. Not tied to one profession.',
  'Business English': 'General office and professional communication: meetings, emails, phone calls, presentations, small talk with colleagues.',
  'Hospitality & Tourism': 'Hotels, restaurants, reception, reservations, complaints, recommendations, guest care and tourism services.',
  'Journalism & Media': 'News writing and reporting, interviews, headlines, fact-checking, media ethics, broadcast and online media.',
  'Commercial Administration': 'Assistant commercial / sales administration: quotes, orders, invoices, customer follow-up, CRM, trade fairs, supplier contact.',
  'Transport & Logistics': 'Supply chain, warehousing, shipping, freight, customs, delivery schedules, Incoterms, tracking and problem-solving with carriers.',
  'TOEIC Preparation': 'TOEIC Listening & Reading format (Parts 1–7) in workplace contexts, with exam strategies and timing.',
  'CLOE Preparation': 'CLOE (CCI France certification, results reported as CEFR levels): workplace grammar and vocabulary, listening and reading comprehension, written expression and the oral interview.',
  'Custom context': 'Use the context described by the teacher in the topic and notes.',
};

export const MATERIAL_TYPES = [
  'complete-lesson',
  'vocabulary-bank',
  'grammar-workshop',
  'exercise-pack',
  'speaking-pack',
  'reading-writing',
  'exam-practice',
  'kahoot-quiz',
] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const MATERIAL_LABELS: Record<MaterialType, { label: string; blurb: string }> = {
  'complete-lesson': { label: 'Complete lesson', blurb: 'Timed plan, vocabulary, grammar, exercises, speaking and homework.' },
  'vocabulary-bank': { label: 'Vocabulary bank', blurb: 'EN/FR word bank, expressions, examples and practice.' },
  'grammar-workshop': { label: 'Grammar workshop', blurb: 'Clear explanation, form, pitfalls and graded exercises.' },
  'exercise-pack': { label: 'Exercise pack', blurb: 'Several varied exercises with answer keys.' },
  'speaking-pack': { label: 'Speaking pack', blurb: 'Role-plays, debates, cards, Would You Rather and more.' },
  'reading-writing': { label: 'Reading & writing', blurb: 'Original text, comprehension and a writing task with a model answer.' },
  'exam-practice': { label: 'TOEIC / CLOE practice', blurb: 'Exam-format tasks, strategies and timing.' },
  'kahoot-quiz': { label: 'Kahoot quiz', blurb: 'Quick-fire multiple choice that exports to Kahoot.' },
};

export const SPEAKING_ACTIVITIES = [
  'discussion',
  'role-play',
  'debate',
  'would-you-rather',
  'this-or-that',
  'conversation-cards',
  'spin-the-wheel',
] as const;
export type SpeakingActivity = (typeof SPEAKING_ACTIVITIES)[number];

export const SPEAKING_LABELS: Record<SpeakingActivity, string> = {
  discussion: 'Discussion questions',
  'role-play': 'Role-play',
  debate: 'Debate',
  'would-you-rather': 'Would You Rather',
  'this-or-that': 'This or That',
  'conversation-cards': 'Conversation cards',
  'spin-the-wheel': 'Spin the Wheel',
};

export const EXERCISE_KINDS = [
  'multiple-choice',
  'gap-fill',
  'true-false',
  'matching',
  'transformation',
  'error-correction',
  'word-order',
  'open-questions',
] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

export const EXERCISE_LABELS: Record<ExerciseKind, string> = {
  'multiple-choice': 'Multiple choice',
  'gap-fill': 'Gap fill',
  'true-false': 'True / False',
  matching: 'Matching',
  transformation: 'Sentence transformation',
  'error-correction': 'Error correction',
  'word-order': 'Word order',
  'open-questions': 'Open questions',
};

export const FORMATS = ['In person', 'Online', 'One-to-one'] as const;
export const INSTRUCTION_LANGUAGES = ['English', 'Bilingual'] as const;
export const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240] as const;

export const KAHOOT_TIME_LIMITS = [5, 10, 20, 30, 60, 90, 120, 240] as const;
