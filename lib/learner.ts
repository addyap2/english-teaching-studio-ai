import { seededRng, shuffle } from './normalise';
import type { ExerciseSection, Lesson, Section } from './schema';

export type Audience = 'teacher' | 'learner';

function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The right-hand column learners match against: answers in a stable shuffled order. */
export function matchingColumn(section: ExerciseSection): string[] {
  if (section.wordBank?.length && section.kind === 'matching') return section.wordBank;
  return shuffle(
    section.items.map((i) => i.answer),
    seededRng(seedFrom(section.id ?? section.title)),
  );
}

function stripSection(section: Section): Section | null {
  if (section.teacherOnly) return null;
  switch (section.type) {
    case 'plan':
    case 'notes':
      return null;
    case 'exercise': {
      const wordBank = section.kind === 'matching' ? matchingColumn(section) : section.wordBank;
      return {
        ...section,
        wordBank,
        items: section.items.map((item) => ({
          prompt: item.prompt,
          options: item.options,
          answer: '',
          explanation: '',
        })),
      };
    }
    case 'writing':
      return { ...section, modelAnswer: '' };
    case 'speaking':
      return { ...section, teacherTips: '' };
    default:
      return section;
  }
}

/**
 * The learner version contains no answers, explanations, model answers,
 * teacher tips, lesson plan or teacher notes. The learner view and the learner
 * exports are built from this, so answers are never in the page or the file.
 */
export function toLearnerLesson(lesson: Lesson): Lesson {
  return {
    ...lesson,
    sections: lesson.sections.map(stripSection).filter((s): s is Section => s !== null),
  };
}

export function forAudience(lesson: Lesson, audience: Audience): Lesson {
  return audience === 'learner' ? toLearnerLesson(lesson) : lesson;
}
