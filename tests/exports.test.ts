import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { docxBuffer } from '../lib/exports/docx';
import { kahootCsv, kahootRows, kahootTimeLimit, kahootXlsx, KAHOOT_ANSWER_MAX, KAHOOT_QUESTION_MAX } from '../lib/exports/kahoot';
import { normaliseLesson, seededRng } from '../lib/normalise';
import { SAMPLE_LESSON } from '../lib/samples';
import type { ExerciseSection, Lesson } from '../lib/schema';

const lesson = normaliseLesson(SAMPLE_LESSON, {}, seededRng(3));

async function docxText(l: Lesson, audience: 'teacher' | 'learner') {
  const zip = await JSZip.loadAsync(await docxBuffer(l, audience));
  const xml = await zip.file('word/document.xml')!.async('string');
  return xml.replace(/<[^>]+>/g, ' ').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

test('Kahoot rows use 1-based correct answers that point at the right option', () => {
  const { rows, warnings } = kahootRows(lesson);
  const mcqAndTf = lesson.sections.filter((s): s is ExerciseSection => s.type === 'exercise' && (s.kind === 'multiple-choice' || s.kind === 'true-false'));
  const items = mcqAndTf.flatMap((s) => s.items);
  assert.equal(rows.length, items.length);
  assert.deepEqual(warnings, []);
  rows.forEach((row, i) => {
    const n = Number(row.correct);
    assert.ok(n >= 1 && n <= 4);
    assert.equal(row.answers[n - 1], items[i].answer);
    assert.ok(row.question.length <= KAHOOT_QUESTION_MAX);
    assert.ok(row.answers.every((a) => a.length <= KAHOOT_ANSWER_MAX));
    assert.equal(row.timeLimit, 20);
  });
});

test('Kahoot limits are enforced with a warning', () => {
  const long = structuredClone(lesson);
  const ex = long.sections.find((s): s is ExerciseSection => s.type === 'exercise' && s.kind === 'multiple-choice')!;
  ex.items[0].prompt = 'x'.repeat(200);
  ex.items[0].options = ex.items[0].options!.map((o, i) => (i === ex.items[0].correctIndex ? o : `${o} ${'y'.repeat(100)}`));
  const { rows, warnings } = kahootRows(long);
  const row = rows.find((r) => r.question.startsWith('xxx'))!;
  assert.equal(row.question.length, KAHOOT_QUESTION_MAX);
  assert.ok(warnings.length >= 2);
});

test('Kahoot time limits snap to allowed values', () => {
  assert.equal(kahootTimeLimit(25), 20);
  assert.equal(kahootTimeLimit(45), 30);
  assert.equal(kahootTimeLimit(1000), 240);
});

test('Kahoot CSV has the template headers, quoting and formula protection', () => {
  const csv = kahootCsv([{ question: '=SUM(A1) "quoted", ok', answers: ['a', 'b', '', ''], timeLimit: 20, correct: '2' }]);
  const lines = csv.replace('\uFEFF', '').trim().split('\r\n');
  assert.match(lines[0], /^"Question - max 120 characters","Answer 1 - max 75 characters"/);
  assert.equal(lines[1], `"'=SUM(A1) ""quoted"", ok","a","b","","","20","2"`);
});

test('Kahoot XLSX follows the official template layout (headers row 8, data from row 9, columns B–H)', async () => {
  const { rows } = kahootRows(lesson);
  const zip = await JSZip.loadAsync(await kahootXlsx(rows, lesson.title));
  const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  assert.match(sheet, /<c r="B8" t="inlineStr" s="1"><is><t xml:space="preserve">Question - max 120 characters<\/t>/);
  assert.match(sheet, /<c r="H8"[^>]*><is><t xml:space="preserve">Correct answer\(s\)/);
  assert.match(sheet, new RegExp(`<c r="B9" t="inlineStr"><is><t xml:space="preserve">${rows[0].question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "'")}`));
  assert.match(sheet, /<c r="G9"><v>20<\/v><\/c>/);
  assert.ok(zip.file('[Content_Types].xml') && zip.file('xl/workbook.xml') && zip.file('xl/styles.xml'));
});

test('DOCX teacher version includes the plan and answers; learner version does not', async () => {
  const teacher = await docxText(lesson, 'teacher');
  const learner = await docxText(lesson, 'learner');
  assert.match(teacher, /TEACHER VERSION/);
  assert.match(teacher, /Lesson plan/);
  assert.match(teacher, /Answer:/);
  assert.match(teacher, /Sunday sounds lovely/);
  assert.match(learner, /LEARNER WORKSHEET/);
  assert.doesNotMatch(learner, /Answer:/);
  assert.doesNotMatch(learner, /Lesson plan/);
  assert.doesNotMatch(learner, /Sunday sounds lovely/);
  assert.doesNotMatch(learner, /Teacher tip/);
  assert.match(learner, /Making Plans and Arrangements/);
  assert.match(learner, /un rendez-vous/);
});
