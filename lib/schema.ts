import { z } from 'zod';
import {
  EXERCISE_KINDS,
  FOCUSES,
  FORMATS,
  INSTRUCTION_LANGUAGES,
  LEVELS,
  MATERIAL_TYPES,
  SPEAKING_ACTIVITIES,
} from './options';

/* ------------------------------------------------------------------ */
/* Lesson settings (what the teacher chooses in the setup step)        */
/* ------------------------------------------------------------------ */

export const settingsSchema = z.object({
  materialType: z.enum(MATERIAL_TYPES),
  focus: z.enum(FOCUSES),
  level: z.enum(LEVELS),
  mixedRange: z.string().trim().max(40).default(''),
  topic: z.string().trim().min(3, 'Give the lesson a topic (at least 3 characters).').max(300),
  grammarFocus: z.string().trim().max(200).default(''),
  vocabularyFocus: z.string().trim().max(200).default(''),
  duration: z.number().int().min(15).max(240),
  learners: z.number().int().min(1).max(60),
  format: z.enum(FORMATS),
  instructionLanguage: z.enum(INSTRUCTION_LANGUAGES),
  questionsPerExercise: z.number().int().min(10, 'Exercises need at least 10 questions.').max(40),
  optionsPerQuestion: z.union([z.literal(3), z.literal(4)]),
  speakingActivities: z.array(z.enum(SPEAKING_ACTIVITIES)).max(SPEAKING_ACTIVITIES.length),
  notes: z.string().trim().max(1500).default(''),
});
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  materialType: 'complete-lesson',
  focus: 'General English',
  level: 'B1',
  mixedRange: '',
  topic: 'Making plans and arrangements',
  grammarFocus: '',
  vocabularyFocus: '',
  duration: 90,
  learners: 8,
  format: 'In person',
  instructionLanguage: 'Bilingual',
  questionsPerExercise: 10,
  optionsPerQuestion: 4,
  speakingActivities: ['role-play', 'would-you-rather'],
  notes: '',
};

/* ------------------------------------------------------------------ */
/* Lesson content                                                      */
/* The schema is forgiving about *shape details* an AI model tends to  */
/* vary (missing optional arrays, numbers sent as strings) and strict   */
/* about what matters (types, required text, answers).                 */
/* ------------------------------------------------------------------ */

const text = z.string().trim().min(1);
const optText = z.string().trim().optional().catch(undefined);
const list = z.array(text).default([]);
const minutes = z.coerce.number().int().min(0).max(240);

const base = {
  id: z.string().optional(),
  title: text,
  teacherOnly: z.boolean().optional(),
};

export const planStageSchema = z.object({
  title: text,
  minutes,
  interaction: z.string().trim().default('T–Ss'),
  aim: z.string().trim().default(''),
  procedure: text,
  notes: z.string().trim().default(''),
});

export const planSectionSchema = z.object({
  ...base,
  type: z.literal('plan'),
  stages: z.array(planStageSchema).min(1),
});

export const vocabularySectionSchema = z.object({
  ...base,
  type: z.literal('vocabulary'),
  instructions: z.string().trim().default(''),
  instructionsFr: optText,
  items: z
    .array(
      z.object({
        term: text,
        pos: z.string().trim().default(''),
        french: text,
        example: text,
        exampleFr: optText,
      }),
    )
    .min(1),
  expressions: z
    .array(z.object({ expression: text, french: text, example: z.string().trim().default('') }))
    .default([]),
});

export const grammarSectionSchema = z.object({
  ...base,
  type: z.literal('grammar'),
  explanation: text,
  explanationFr: optText,
  form: z.array(z.object({ label: text, pattern: text, example: z.string().trim().default('') })).default([]),
  usage: list,
  examples: list,
  pitfalls: z.array(z.object({ wrong: text, right: text, note: z.string().trim().default('') })).default([]),
});

export const exerciseItemSchema = z.object({
  prompt: text,
  options: z.array(text).optional().catch(undefined),
  answer: text,
  correctIndex: z.coerce.number().int().min(0).optional().catch(undefined),
  explanation: z.string().trim().default(''),
});
export type ExerciseItem = z.infer<typeof exerciseItemSchema>;

export const exerciseSectionSchema = z.object({
  ...base,
  type: z.literal('exercise'),
  kind: z.enum(EXERCISE_KINDS),
  instructions: text,
  instructionsFr: optText,
  exam: optText,
  wordBank: z.array(text).optional().catch(undefined),
  items: z.array(exerciseItemSchema).min(1),
});

export const readingSectionSchema = z.object({
  ...base,
  type: z.literal('reading'),
  intro: z.string().trim().default(''),
  text,
  glossary: z.array(z.object({ term: text, french: text })).default([]),
});

export const writingSectionSchema = z.object({
  ...base,
  type: z.literal('writing'),
  task: text,
  instructionsFr: optText,
  wordCount: z.string().trim().default(''),
  usefulLanguage: list,
  checklist: list,
  modelAnswer: z.string().trim().default(''),
});

export const speakingSectionSchema = z.object({
  ...base,
  type: z.literal('speaking'),
  activity: z.enum(SPEAKING_ACTIVITIES),
  instructions: text,
  instructionsFr: optText,
  items: z.array(z.object({ text, detail: z.string().trim().default('') })).min(1),
  roles: z.array(z.object({ name: text, brief: text })).default([]),
  usefulLanguage: list,
  teacherTips: z.string().trim().default(''),
});

export const notesSectionSchema = z.object({
  ...base,
  type: z.literal('notes'),
  items: z.array(text).min(1),
});

export const homeworkSectionSchema = z.object({
  ...base,
  type: z.literal('homework'),
  items: z.array(text).min(1),
});

export const sectionSchema = z.discriminatedUnion('type', [
  planSectionSchema,
  vocabularySectionSchema,
  grammarSectionSchema,
  exerciseSectionSchema,
  readingSectionSchema,
  writingSectionSchema,
  speakingSectionSchema,
  notesSectionSchema,
  homeworkSectionSchema,
]);

export const lessonSchema = z.object({
  id: z.string().optional(),
  title: text,
  subtitle: z.string().trim().default(''),
  summary: text,
  level: z.string().trim().min(1),
  focus: z.string().trim().min(1),
  materialType: z.enum(MATERIAL_TYPES).catch('complete-lesson'),
  duration: z.coerce.number().int().min(0).max(240),
  objectives: list,
  keyLanguage: list,
  materials: list,
  sections: z.array(sectionSchema).min(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  source: z.string().optional(),
});

export type Lesson = z.infer<typeof lessonSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type SectionType = Section['type'];
export type PlanSection = z.infer<typeof planSectionSchema>;
export type VocabularySection = z.infer<typeof vocabularySectionSchema>;
export type GrammarSection = z.infer<typeof grammarSectionSchema>;
export type ExerciseSection = z.infer<typeof exerciseSectionSchema>;
export type ReadingSection = z.infer<typeof readingSectionSchema>;
export type WritingSection = z.infer<typeof writingSectionSchema>;
export type SpeakingSection = z.infer<typeof speakingSectionSchema>;
export type NotesSection = z.infer<typeof notesSectionSchema>;
export type HomeworkSection = z.infer<typeof homeworkSectionSchema>;

export const SECTION_TYPES = [
  'plan',
  'vocabulary',
  'grammar',
  'exercise',
  'reading',
  'writing',
  'speaking',
  'notes',
  'homework',
] as const satisfies readonly SectionType[];

export const SECTION_LABELS: Record<SectionType, string> = {
  plan: 'Lesson plan',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  exercise: 'Exercise',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
  notes: 'Teacher notes',
  homework: 'Homework',
};

/** Sections that never appear in the learner version. */
export const TEACHER_ONLY_TYPES: readonly SectionType[] = ['plan', 'notes'];

export function formatZodIssues(error: z.ZodError, max = 8): string[] {
  return error.issues.slice(0, max).map((issue) => {
    const where = issue.path.length ? issue.path.join('.') : 'root';
    return `${where}: ${issue.message}`;
  });
}
