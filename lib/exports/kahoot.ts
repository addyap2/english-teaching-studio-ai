import JSZip from 'jszip';
import { resolveCorrectIndex } from '../normalise';
import type { ExerciseSection, Lesson } from '../schema';
import { KAHOOT_TIME_LIMITS } from '../options';

/**
 * Kahoot imports quizzes from its spreadsheet template (KahootQuizTemplate.xlsx):
 * headers on row 8 in columns B–H, one question per row from row 9:
 *   B Question · C–F Answer 1–4 · G Time limit (sec) · H Correct answer(s) as "1" or "1,3".
 * Limits: question 120 characters, answers 75 characters, 2–4 answers, time
 * limit one of 5, 10, 20, 30, 60, 90, 120, 240 seconds.
 * Kahoot's importer takes .xlsx; the CSV has the same columns for Google Sheets
 * (open it, then File → Download → .xlsx) or other quiz tools.
 */

export const KAHOOT_QUESTION_MAX = 120;
export const KAHOOT_ANSWER_MAX = 75;
export const KAHOOT_HEADERS = [
  'Question - max 120 characters',
  'Answer 1 - max 75 characters',
  'Answer 2 - max 75 characters',
  'Answer 3 - max 75 characters',
  'Answer 4 - max 75 characters',
  'Time limit (sec) – 5, 10, 20, 30, 60, 90, 120, or 240 secs',
  'Correct answer(s) - choose at least one',
] as const;

export interface KahootRow {
  question: string;
  answers: [string, string, string, string];
  timeLimit: number;
  correct: string;
}

export interface KahootResult {
  rows: KahootRow[];
  warnings: string[];
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function kahootTimeLimit(seconds: number): number {
  return KAHOOT_TIME_LIMITS.reduce((best, t) => (Math.abs(t - seconds) < Math.abs(best - seconds) ? t : best), 20);
}

/** Collects every multiple-choice / true-false item in the lesson as Kahoot rows. */
export function kahootRows(lesson: Lesson, timeLimit = 20): KahootResult {
  const warnings: string[] = [];
  const rows: KahootRow[] = [];
  const limit = kahootTimeLimit(timeLimit);
  const sections = lesson.sections.filter(
    (s): s is ExerciseSection => s.type === 'exercise' && (s.kind === 'multiple-choice' || s.kind === 'true-false'),
  );
  for (const section of sections) {
    section.items.forEach((item, i) => {
      const options = (item.options ?? []).slice(0, 4);
      const correct = resolveCorrectIndex({ ...item, options });
      const n = rows.length + 1;
      if (options.length < 2 || correct < 0) {
        warnings.push(`Skipped “${section.title}” question ${i + 1}: no valid options/answer.`);
        return;
      }
      if (item.prompt.length > KAHOOT_QUESTION_MAX) warnings.push(`Question ${n} was shortened to ${KAHOOT_QUESTION_MAX} characters.`);
      if (options.some((o) => o.length > KAHOOT_ANSWER_MAX)) warnings.push(`An answer in question ${n} was shortened to ${KAHOOT_ANSWER_MAX} characters.`);
      const answers = [0, 1, 2, 3].map((k) => (options[k] ? clip(options[k], KAHOOT_ANSWER_MAX) : '')) as KahootRow['answers'];
      rows.push({ question: clip(item.prompt, KAHOOT_QUESTION_MAX), answers, timeLimit: limit, correct: String(correct + 1) });
    });
  }
  if (!rows.length) warnings.push('This material has no multiple-choice questions to export.');
  return { rows, warnings };
}

function csvCell(value: string | number): string {
  const s = String(value);
  // Neutralise spreadsheet formula injection (=, +, -, @ at the start).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function kahootCsv(rows: KahootRow[]): string {
  const lines = [KAHOOT_HEADERS.map(csvCell).join(',')];
  for (const r of rows) lines.push([r.question, ...r.answers, r.timeLimit, r.correct].map(csvCell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

/* ------------------------------------------------------------------ */
/* Minimal XLSX writer laid out exactly like Kahoot's template          */
/* ------------------------------------------------------------------ */

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

function cell(ref: string, value: string | number, style = 0): string {
  const s = style ? ` s="${style}"` : '';
  if (typeof value === 'number') return `<c r="${ref}"${s}><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

export function kahootSheetRows(rows: KahootRow[], title: string): (string | number)[][] {
  const grid: (string | number)[][] = [];
  grid[1] = ['', 'Quiz template'];
  grid[2] = ['', `${title} — created with English Teaching Studio`];
  grid[3] = ['', 'Questions max 120 characters, answers max 75. Correct answers: answer numbers, comma-separated if several.'];
  grid[7] = ['', ...KAHOOT_HEADERS];
  rows.forEach((r, i) => {
    grid[8 + i] = [i + 1, r.question, ...r.answers, r.timeLimit, r.correct];
  });
  return grid;
}

export async function kahootXlsx(rows: KahootRow[], title = 'Quiz'): Promise<Uint8Array> {
  const cols = 'ABCDEFGH';
  const grid = kahootSheetRows(rows, title);
  const sheetRows = grid
    .map((row, r) => {
      if (!row) return '';
      const cells = row
        .map((v, c) => (v === '' ? '' : cell(`${cols[c]}${r + 1}`, v, r === 7 ? 1 : 0)))
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');

  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`,
  );
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="5" customWidth="1"/><col min="2" max="2" width="60" customWidth="1"/><col min="3" max="6" width="28" customWidth="1"/><col min="7" max="8" width="18" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData></worksheet>`,
  );
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
