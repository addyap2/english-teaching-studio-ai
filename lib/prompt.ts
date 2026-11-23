import {
  FOCUS_BRIEFS,
  MATERIAL_LABELS,
  SPEAKING_LABELS,
  type MaterialType,
  type SpeakingActivity,
} from './options';
import type { Lesson, SectionType, Settings } from './schema';

/**
 * Prompts are shared by the server (API generation) and the browser
 * ("copy prompt for Claude.ai"), so both routes produce identical material.
 */

export const SYSTEM_PROMPT = `You are an expert teacher-trainer and materials writer for adult learners of English in France. You write for Antony Addy, a native British English trainer (CELTA-style methodology). Your materials are used in real classes the same day, so they must be accurate, natural and ready to print.

Standards you always meet:
- Natural, idiomatic British English: British spelling (colour, organise or organize, travelling), British vocabulary (holiday, flat, mobile, queue, CV) and British conventions (dates such as 14 March, £ where currency is needed).
- CEFR accuracy: language load, sentence length, grammar and topics match the stated level. A0–A1: very short, high-frequency, concrete. C1–C2: nuance, idiom, register and complex structures.
- Adults, not children: realistic situations, respectful tone, no childish themes.
- French support is accurate, natural French (not word-for-word). Note false friends where relevant (e.g. actually ≠ actuellement).
- Every exercise item has exactly one defensible correct answer, with plausible distractors drawn from typical French-speaker errors, and a short explanation a learner would understand.
- Items within an exercise are varied (no near-duplicates, no repeated sentence frames), and test the stated target language.
- Never invent statistics, quotations, real people's statements or sources. Reading texts are original.
- Do not write about luxury retail unless the teacher explicitly asks for it.

Output: reply with ONE JSON object only — no Markdown, no commentary before or after.`;

const LESSON_SHAPE = `JSON shape (TypeScript notation; "?" = optional):
{
  "title": string, "subtitle": string, "summary": string (2–3 sentences for the teacher),
  "level": string, "focus": string, "materialType": string, "duration": number (minutes),
  "objectives": string[] (3–5 "By the end of the lesson, learners will be able to…" outcomes, without that prefix),
  "keyLanguage": string[] (target structures / phrases), "materials": string[] (what the teacher needs),
  "sections": Section[]
}
Section is one of (every section has "type" and "title"):
- { "type": "plan", "title", "stages": [{ "title", "minutes": number, "interaction": "T–Ss" | "Ss–Ss" | "Pairs" | "Groups" | "Individual", "aim", "procedure" (numbered steps, concrete teacher actions and instructions to give), "notes" }] }
- { "type": "vocabulary", "title", "instructions", "instructionsFr"?, "items": [{ "term", "pos" (noun / verb / adj / phrase…), "french", "example" (natural sentence using the term), "exampleFr"? }], "expressions": [{ "expression", "french", "example" }] }
- { "type": "grammar", "title", "explanation" (clear, level-appropriate), "explanationFr"?, "form": [{ "label" (e.g. Positive / Negative / Question), "pattern" (e.g. subject + have/has + past participle), "example" }], "usage": string[], "examples": string[], "pitfalls": [{ "wrong", "right", "note" }] (typical French-speaker errors) }
- { "type": "exercise", "title", "kind": "multiple-choice" | "gap-fill" | "true-false" | "matching" | "transformation" | "error-correction" | "word-order" | "open-questions", "instructions", "instructionsFr"?, "exam"? (e.g. "TOEIC Part 5"), "wordBank"? string[], "items": [{ "prompt", "options"? string[], "answer", "explanation" }] }
    kind rules: multiple-choice → "options" holds all choices and "answer" is the exact text of the correct option; gap-fill → "prompt" contains "_____" for each gap, "answer" fills it (several gaps: "a / b"); true-false → "answer" is "True" or "False" (reading-based statements); matching → "prompt" is the left item, "answer" its exact match; transformation → "prompt" gives the sentence and the cue in brackets; error-correction → "prompt" contains one error, "answer" is the corrected sentence; word-order → "prompt" is the jumbled words separated by " / ", "answer" the sentence; open-questions → "answer" is a model answer.
- { "type": "reading", "title", "intro", "text" (original text, paragraphs separated by blank lines), "glossary": [{ "term", "french" }] }
- { "type": "writing", "title", "task", "instructionsFr"?, "wordCount" (e.g. "120–150 words"), "usefulLanguage": string[], "checklist": string[], "modelAnswer" }
- { "type": "speaking", "title", "activity": "discussion" | "role-play" | "debate" | "would-you-rather" | "this-or-that" | "conversation-cards" | "spin-the-wheel", "instructions", "instructionsFr"?, "items": [{ "text", "detail" }], "roles": [{ "name", "brief" }], "usefulLanguage": string[], "teacherTips" }
    activity rules: role-play → 2+ "roles" with full briefs, "items" are situation cards; debate → "items" are motions, "detail" gives points for/against; would-you-rather → "text" is "Would you rather … or …?", "detail" a follow-up question; this-or-that → "text" is "X or Y?", "detail" a follow-up; conversation-cards → 12+ cards, "detail" a follow-up; spin-the-wheel → 8–12 short prompts (max 60 characters each) for a wheel; discussion → questions with follow-ups.
- { "type": "notes", "title", "items": string[] } (teacher notes: anticipated problems, differentiation, timing tips)
- { "type": "homework", "title", "items": string[] }`;

function speakingList(activities: SpeakingActivity[]): string {
  const chosen = activities.length ? activities : (['discussion', 'role-play'] as SpeakingActivity[]);
  return chosen.map((a) => SPEAKING_LABELS[a]).join(', ');
}

function blueprint(s: Settings): string {
  const q = s.questionsPerExercise;
  const sp = speakingList(s.speakingActivities);
  const exam = s.focus === 'CLOE Preparation' ? 'CLOE' : 'TOEIC';
  const blueprints: Record<MaterialType, string> = {
    'complete-lesson': `Sections, in this order:
1. "plan": 6–9 stages covering lead-in/warm-up, presentation of vocabulary and grammar, controlled practice, freer practice / speaking, feedback and error correction, wrap-up. Stage minutes must add up to exactly ${s.duration}.
2. "vocabulary": 16–24 items and 6–10 expressions.
3. "grammar": the target structure${s.grammarFocus ? ` (${s.grammarFocus})` : ''}.
4. Two "exercise" sections of ${q} items each: one "multiple-choice" (${s.optionsPerQuestion} options per item) and one of gap-fill / transformation / error-correction.
5. "speaking" sections — one for each of: ${sp}.
6. "notes" with 4–6 teacher notes, including differentiation.
7. "homework" with 2–3 tasks.`,
    'vocabulary-bank': `Sections, in this order:
1. "vocabulary": 30–40 items grouped logically (order items by theme) and 10–15 expressions/collocations.
2. Three "exercise" sections of ${q} items each: "matching" (term → definition or French), "gap-fill" (with a "wordBank"), and "multiple-choice" (${s.optionsPerQuestion} options) on meaning in context.
3. One "speaking" section (${sp.split(', ')[0]}) that recycles the vocabulary.
4. "notes" (pronunciation, false friends, word stress) and "homework".
Include a short "plan" (stages adding up to ${s.duration} minutes) showing how to use the bank in class.`,
    'grammar-workshop': `Sections, in this order:
1. "plan": stages adding up to exactly ${s.duration} minutes (guided discovery → clarification → controlled → freer practice).
2. "grammar": thorough explanation of ${s.grammarFocus || 'the structure that best fits the topic and level'}, with form table, usage, 6+ examples and 4–6 French-speaker pitfalls.
3. Three "exercise" sections of ${q} items each, graded easy → harder: "multiple-choice" (${s.optionsPerQuestion} options), "gap-fill" or "transformation", and "error-correction".
4. One "speaking" section (${sp.split(', ')[0]}) that makes learners use the structure naturally.
5. "notes" and "homework".`,
    'exercise-pack': `Sections: 4–5 "exercise" sections of ${q} items each, of different kinds (must include "multiple-choice" with ${s.optionsPerQuestion} options, "gap-fill" and one of transformation / error-correction / word-order / matching), graded from easier to harder. Then "notes" (how to use the pack, common errors) and "homework". Include a brief "plan" whose stages add up to ${s.duration} minutes.`,
    'speaking-pack': `Sections: a short "vocabulary" section (10–14 useful items) for the activities; then one "speaking" section for each of: ${sp}. Each activity must have enough material for a full class (role-plays: 4+ situation cards; Would You Rather / This or That: 15+ items; conversation cards: 16+; debates: 4+ motions; spin the wheel: 10–12 prompts). Then "notes" (grouping, timing, error-correction techniques) and a "plan" whose stages add up to exactly ${s.duration} minutes.`,
    'reading-writing': `Sections, in this order:
1. "plan": stages adding up to exactly ${s.duration} minutes (pre-reading, gist, detail, language focus, writing, feedback).
2. "reading": an original text of a length suited to the level (A1 ~150 words, B1 ~350, C1 ~600), with a glossary.
3. "exercise" "true-false" (${q} items) and "exercise" "multiple-choice" (${q} items, ${s.optionsPerQuestion} options) on the text, plus "exercise" "open-questions" (5–6 items with model answers).
4. "vocabulary" from the text (12–16 items).
5. "writing": a realistic task linked to the text with useful language, checklist and a model answer at the target level.
6. "notes" and "homework".`,
    'exam-practice':
      exam === 'TOEIC'
        ? `TOEIC Listening & Reading practice. Sections:
1. "plan": stages adding up to exactly ${s.duration} minutes, including timed practice and strategy work.
2. "exercise" (exam "TOEIC Part 5 – Incomplete sentences"): ${q} multiple-choice items with exactly 4 options, testing grammar and business vocabulary as the real test does.
3. TOEIC Part 6 – Text completion: a "reading" section whose text is a short business email or notice containing numbered gaps "(1) _____", "(2) _____"…, followed by an "exercise" (exam "TOEIC Part 6 – Text completion") of kind multiple-choice with one item per gap ("prompt": "Gap 1"), 4 options each — at least 8 gaps across one or two texts.
4. "reading" (a workplace email / notice / article) + "exercise" (exam "TOEIC Part 7 – Reading comprehension"): ${q} multiple-choice items, 4 options.
5. "exercise" (exam "TOEIC Part 2 – Question-response"): ${q} multiple-choice items with 3 options where "prompt" is the question the teacher reads aloud.
6. "notes": test strategies and timing advice; "homework".`
        : `CLOE practice (CCI France; adaptive, results reported as CEFR levels; workplace contexts). Sections:
1. "plan": stages adding up to exactly ${s.duration} minutes.
2. "exercise" (exam "CLOE – Grammar & vocabulary"): ${q} multiple-choice items (${s.optionsPerQuestion} options) in professional contexts, mixed difficulty around the target level.
3. "reading" (workplace document) + "exercise" (exam "CLOE – Reading comprehension"): ${q} multiple-choice items.
4. "exercise" (exam "CLOE – Listening (teacher reads the script aloud)"): ${q} multiple-choice items whose "prompt" begins with a short script in quotation marks followed by the question.
5. "writing" (exam-style professional email or message, with model answer).
6. "speaking" activity "conversation-cards" (exam "CLOE – Oral interview"): 12+ interview questions with follow-ups, plus a "role-play" section for a workplace situation.
7. "notes": strategies and what examiners look for; "homework".`,
    'kahoot-quiz': `Sections: one "exercise" of kind "multiple-choice" with ${q} items and exactly ${s.optionsPerQuestion} options each. Kahoot limits: every "prompt" at most 110 characters and every option at most 70 characters — keep them short. Mix vocabulary, grammar and functional language on the topic. Then a "notes" section with 3 tips for running the quiz.`,
  };
  return blueprints[s.materialType];
}

export function buildLessonPrompt(s: Settings): string {
  const level = s.level === 'Mixed' ? `Mixed-level group${s.mixedRange ? ` (${s.mixedRange})` : ''}` : s.level;
  const lines = [
    `Create: ${MATERIAL_LABELS[s.materialType].label} — ${MATERIAL_LABELS[s.materialType].blurb}`,
    `Topic: ${s.topic}`,
    `Context: ${s.focus} — ${FOCUS_BRIEFS[s.focus]}`,
    `CEFR level: ${level}`,
    `Duration: ${s.duration} minutes`,
    `Group: ${s.learners} adult learner${s.learners === 1 ? '' : 's'}, ${s.format.toLowerCase()}`,
    s.grammarFocus && `Grammar focus: ${s.grammarFocus}`,
    s.vocabularyFocus && `Vocabulary focus: ${s.vocabularyFocus}`,
    `Questions per exercise: at least ${s.questionsPerExercise}`,
    `Options per multiple-choice question: ${s.optionsPerQuestion}`,
    s.instructionLanguage === 'Bilingual'
      ? 'Language of instructions: English, with French translations of learner instructions in the "…Fr" fields and French for all vocabulary.'
      : 'Language of instructions: English only (still give French translations for vocabulary items).',
    s.level === 'Mixed' &&
      'Mixed level: give core tasks everyone can do plus stretch variations, and explain grouping in the teacher notes.',
    s.format === 'Online' && 'Online class: activities must work on video calls (breakout rooms, chat, shared screen).',
    s.format === 'One-to-one' && 'One-to-one: the teacher is the partner in pair-work; adapt interaction patterns.',
    s.notes && `Teacher's notes: ${s.notes}`,
    '',
    blueprint(s),
    '',
    LESSON_SHAPE,
  ];
  return lines.filter((l) => l !== false && l !== '' && l !== undefined).join('\n').replace(/\n(?=Sections|JSON shape)/g, '\n\n');
}

export function buildSectionPrompt(s: Settings, lesson: Pick<Lesson, 'title' | 'summary' | 'level' | 'keyLanguage'>, type: SectionType, request: string, current?: unknown): string {
  return [
    `Rewrite ONE section of an existing lesson. Return a JSON object: { "section": Section }.`,
    `Lesson: ${lesson.title} — ${lesson.summary}`,
    `Level: ${lesson.level}. Context: ${s.focus}. Topic: ${s.topic}. Duration: ${s.duration} minutes.`,
    lesson.keyLanguage.length ? `Key language: ${lesson.keyLanguage.join('; ')}` : '',
    `Section type: "${type}". For exercises use at least ${s.questionsPerExercise} items (${s.optionsPerQuestion} options for multiple choice).`,
    s.instructionLanguage === 'Bilingual' ? 'Include French translations of learner instructions.' : '',
    request ? `Teacher's request: ${request}` : 'Make a fresh, improved version.',
    current ? `Current version (for reference, improve on it):\n${JSON.stringify(current).slice(0, 6000)}` : '',
    '',
    LESSON_SHAPE,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Full text to paste into Claude.ai (or any chat assistant) when no API key is configured. */
export function buildManualPrompt(s: Settings): string {
  return `${SYSTEM_PROMPT}\n\n---\n\n${buildLessonPrompt(s)}`;
}
