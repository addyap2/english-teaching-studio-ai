import { buildLessonPrompt, buildSectionPrompt, SYSTEM_PROMPT } from '../prompt';
import { extractJson, normaliseLesson, normaliseSection, parseLesson, parseSection, qualityReport, type ParseResult } from '../normalise';
import type { Lesson, Section, SectionType, Settings } from '../schema';
import { ProviderError, type CompleteFn } from './provider';

const LESSON_TOKENS = 24_000;
const SECTION_TOKENS = 10_000;

async function completeAndParse<T>(
  complete: CompleteFn,
  user: string,
  maxTokens: number,
  parse: (input: unknown) => ParseResult<T>,
): Promise<T> {
  let prompt = user;
  let lastErrors: string[] = [];
  // One repair round: if the JSON is malformed or misses required fields,
  // the model gets the precise problems back and fixes them.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, truncated } = await complete({ system: SYSTEM_PROMPT, user: prompt, maxTokens });
    if (truncated) throw new ProviderError('The material was too long for one response. Reduce the question count or duration and try again.', 502);
    let json: unknown;
    try {
      json = extractJson(text);
    } catch (e) {
      lastErrors = [e instanceof Error ? e.message : 'Invalid JSON'];
      prompt = `${user}\n\nYour previous reply was not valid JSON (${lastErrors[0]}). Reply again with the complete JSON object only.`;
      continue;
    }
    const parsed = parse(json);
    if (parsed.ok) return parsed.value;
    lastErrors = parsed.errors;
    prompt = `${user}\n\nYour previous reply failed validation:\n- ${parsed.errors.join('\n- ')}\nReply again with the complete, corrected JSON object only.\nPrevious reply:\n${text.slice(0, 20_000)}`;
  }
  throw new ProviderError(`The AI response did not match the lesson format (${lastErrors.slice(0, 2).join('; ')}). Please try again.`, 502);
}

export async function generateLesson(settings: Settings, complete: CompleteFn): Promise<{ lesson: Lesson; warnings: string[] }> {
  const raw = await completeAndParse(complete, buildLessonPrompt(settings), LESSON_TOKENS, parseLesson);
  const lesson = normaliseLesson({ ...raw, source: 'ai' }, settings);
  return { lesson, warnings: qualityReport(lesson, settings) };
}

export async function regenerateSection(
  settings: Settings,
  lesson: Pick<Lesson, 'title' | 'summary' | 'level' | 'keyLanguage'>,
  type: SectionType,
  request: string,
  current: unknown,
  complete: CompleteFn,
): Promise<Section> {
  const prompt = buildSectionPrompt(settings, lesson, type, request, current);
  const parseTyped = (input: unknown): ParseResult<Section> => {
    const result = parseSection(input);
    if (result.ok && result.value.type !== type) return { ok: false, errors: [`section.type must be "${type}"`] };
    return result;
  };
  const section = await completeAndParse(complete, prompt, SECTION_TOKENS, parseTyped);
  return normaliseSection(section);
}
