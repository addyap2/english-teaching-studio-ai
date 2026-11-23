import { DEFAULT_SETTINGS, type Settings } from './schema';

export interface Template {
  id: string;
  name: string;
  description: string;
  settings: Settings;
  builtIn?: boolean;
}

const t = (id: string, name: string, description: string, patch: Partial<Settings>): Template => ({
  id,
  name,
  description,
  builtIn: true,
  settings: { ...DEFAULT_SETTINGS, ...patch },
});

/** Starting points for common class types. Teachers can save their own alongside these. */
export const BUILT_IN_TEMPLATES: Template[] = [
  t('general-90', 'General English · 90 min', 'Full lesson for an adult group', {}),
  t('conversation-club', 'Conversation club', 'Would You Rather, This or That, cards and the wheel', {
    materialType: 'speaking-pack',
    topic: 'Lifestyle, habits and choices',
    duration: 60,
    speakingActivities: ['would-you-rather', 'this-or-that', 'conversation-cards', 'spin-the-wheel'],
  }),
  t('grammar-a2', 'Grammar workshop · A2', 'Explanation and three graded exercises', {
    materialType: 'grammar-workshop',
    level: 'A2',
    topic: 'Talking about past experiences',
    grammarFocus: 'Past simple vs present perfect',
    duration: 60,
  }),
  t('toeic-part5', 'TOEIC practice', 'Parts 2, 5, 6 and 7 with strategies', {
    materialType: 'exam-practice',
    focus: 'TOEIC Preparation',
    level: 'B1',
    topic: 'Office life and business travel',
    questionsPerExercise: 12,
    instructionLanguage: 'English',
  }),
  t('cloe', 'CLOE preparation', 'Grammar, comprehension, writing and the oral interview', {
    materialType: 'exam-practice',
    focus: 'CLOE Preparation',
    level: 'B1',
    topic: 'Customer service and workplace communication',
  }),
  t('hospitality', 'Hospitality role-plays', 'Front desk, restaurant and complaints', {
    focus: 'Hospitality & Tourism',
    materialType: 'speaking-pack',
    topic: 'Dealing with guests: check-in, requests and complaints',
    level: 'A2',
    speakingActivities: ['role-play', 'conversation-cards'],
  }),
  t('logistics', 'Logistics vocabulary bank', 'Shipping, warehousing and delivery issues', {
    focus: 'Transport & Logistics',
    materialType: 'vocabulary-bank',
    topic: 'Shipping, delays and delivery problems',
    level: 'B1',
  }),
  t('journalism', 'Journalism · reading & writing', 'Original article, comprehension, news writing', {
    focus: 'Journalism & Media',
    materialType: 'reading-writing',
    topic: 'Writing a news story: facts, sources and headlines',
    level: 'B2',
  }),
  t('kahoot-review', 'Kahoot review quiz', '15 quick questions to revise a topic', {
    materialType: 'kahoot-quiz',
    questionsPerExercise: 15,
    duration: 15,
    topic: 'Review of everyday phrasal verbs',
  }),
];
