import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { forAudience, matchingColumn, type Audience } from '../learner';
import { stageClock } from '../normalise';
import { EXERCISE_LABELS, MATERIAL_LABELS, SPEAKING_LABELS } from '../options';
import type { ExerciseSection, Lesson, Section } from '../schema';

const INK = '1B2A41';
const ACCENT = 'A2412E';
const MUTED = '5C6675';
const RULE = 'D9D4C7';
const TINT = 'F4F0E6';
const FONT = 'Calibri';
const SERIF = 'Georgia';

const letter = (i: number) => String.fromCharCode(65 + i);

function p(text: string, opts: { bold?: boolean; italics?: boolean; color?: string; size?: number; after?: number; indent?: number } = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 80 },
    indent: opts.indent ? { left: opts.indent } : undefined,
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, color: opts.color, size: opts.size })],
  });
}

function runs(parts: { text: string; bold?: boolean; italics?: boolean; color?: string }[], indent?: number) {
  return new Paragraph({ spacing: { after: 60 }, indent: indent ? { left: indent } : undefined, children: parts.map((r) => new TextRun(r)) });
}

function heading(text: string, kicker?: string) {
  const out: Paragraph[] = [];
  if (kicker)
    out.push(new Paragraph({ spacing: { before: 280, after: 0 }, children: [new TextRun({ text: kicker.toUpperCase(), color: ACCENT, size: 16, bold: true, characterSpacing: 40 })] }));
  out.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: kicker ? 40 : 280, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 4 } },
      children: [new TextRun({ text, font: SERIF, color: INK, size: 30 })],
    }),
  );
  return out;
}

function fr(text?: string) {
  return text ? [p(`FR · ${text}`, { italics: true, color: MUTED, size: 19 })] : [];
}

function bullets(items: string[]) {
  return items.map((t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun(t)] }));
}

function cellP(text: string, bold = false, color?: string) {
  return text.split('\n').map((line) => new Paragraph({ children: [new TextRun({ text: line, bold, color, size: 20 })] }));
}

function table(headers: string[], rows: string[][], widths?: number[]) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: RULE };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map(
          (h, i) =>
            new TableCell({
              width: widths ? { size: widths[i], type: WidthType.PERCENTAGE } : undefined,
              shading: { type: ShadingType.CLEAR, fill: TINT, color: 'auto' },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: cellP(h, true, INK),
            }),
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            cantSplit: true,
            children: row.map((c) => new TableCell({ margins: { top: 50, bottom: 50, left: 100, right: 100 }, children: cellP(c) })),
          }),
      ),
    ],
  });
}

function answerLine(text: string, explanation: string | undefined, teacher: boolean) {
  if (!teacher || !text) return [];
  return [
    runs(
      [
        { text: 'Answer: ', bold: true, color: ACCENT },
        { text, color: ACCENT },
        ...(explanation ? [{ text: ` — ${explanation}`, italics: true, color: MUTED }] : []),
      ],
      360,
    ),
  ];
}

function exercise(section: ExerciseSection, teacher: boolean) {
  const out: (Paragraph | Table)[] = [...heading(section.title, section.exam || EXERCISE_LABELS[section.kind]), p(section.instructions, { bold: true }), ...fr(section.instructionsFr)];
  if (section.wordBank?.length && section.kind !== 'matching')
    out.push(runs([{ text: 'Word bank: ', bold: true }, { text: section.wordBank.join('  ·  ') }]));
  if (section.kind === 'matching') {
    const column = matchingColumn(section);
    out.push(
      table(
        ['', 'Item', '', 'Match'],
        section.items.map((it, i) => [String(i + 1), it.prompt, letter(i), column[i] ?? '']),
        [6, 44, 6, 44],
      ),
    );
    if (teacher)
      out.push(p(`Key: ${section.items.map((it, i) => `${i + 1}–${letter(column.indexOf(it.answer))}`).join(', ')}`, { color: ACCENT, bold: true }));
    return out;
  }
  section.items.forEach((item, i) => {
    out.push(runs([{ text: `${i + 1}. `, bold: true, color: INK }, { text: item.prompt }]));
    if (item.options?.length && (section.kind === 'multiple-choice' || section.kind === 'true-false')) {
      out.push(p(item.options.map((o, k) => `${letter(k)}) ${o}`).join('     '), { indent: 360 }));
    } else if (!teacher) {
      out.push(p('______________________________________________________________', { color: RULE, indent: 360 }));
    }
    const answer = item.options?.length && item.correctIndex !== undefined ? `${letter(item.correctIndex)}) ${item.answer}` : item.answer;
    out.push(...answerLine(answer, item.explanation, teacher));
  });
  return out;
}

function section(s: Section, teacher: boolean): (Paragraph | Table)[] {
  switch (s.type) {
    case 'plan': {
      const clocks = stageClock(s.stages.map((x) => x.minutes));
      return [
        ...heading(s.title, 'Teacher · Lesson plan'),
        table(
          ['Time', 'Stage & aim', 'Procedure', 'Interaction'],
          s.stages.map((st, i) => [`${clocks[i]}\n(${st.minutes} min)`, `${st.title}${st.aim ? ` — ${st.aim}` : ''}`, `${st.procedure}${st.notes ? `\nNote: ${st.notes}` : ''}`, st.interaction]),
          [13, 25, 50, 12],
        ),
      ];
    }
    case 'vocabulary':
      return [
        ...heading(s.title, 'Vocabulary · EN / FR'),
        ...(s.instructions ? [p(s.instructions)] : []),
        ...fr(s.instructionsFr),
        table(['English', 'Français', 'Example'], s.items.map((v) => [`${v.term}${v.pos ? ` (${v.pos})` : ''}`, v.french, v.example]), [24, 24, 52]),
        ...(s.expressions.length
          ? [p(''), p('Useful expressions', { bold: true, color: INK }), table(['Expression', 'Français', 'Example'], s.expressions.map((e) => [e.expression, e.french, e.example]), [30, 25, 45])]
          : []),
      ];
    case 'grammar':
      return [
        ...heading(s.title, 'Grammar'),
        p(s.explanation),
        ...fr(s.explanationFr),
        ...(s.form.length ? [table(['Form', 'Pattern', 'Example'], s.form.map((f) => [f.label, f.pattern, f.example]), [18, 40, 42])] : []),
        ...(s.usage.length ? [p('When we use it', { bold: true, color: INK }), ...bullets(s.usage)] : []),
        ...(s.examples.length ? [p('Examples', { bold: true, color: INK }), ...bullets(s.examples)] : []),
        ...(s.pitfalls.length ? [p('Watch out', { bold: true, color: INK }), table(['✗', '✓', 'Why'], s.pitfalls.map((x) => [x.wrong, x.right, x.note]), [30, 30, 40])] : []),
      ];
    case 'exercise':
      return exercise(s, teacher);
    case 'reading':
      return [
        ...heading(s.title, 'Reading'),
        ...(s.intro ? [p(s.intro, { italics: true, color: MUTED })] : []),
        ...s.text.split(/\n\s*\n/).map((para) => new Paragraph({ spacing: { after: 140, line: 300 }, children: [new TextRun({ text: para.trim(), font: SERIF, size: 22 })] })),
        ...(s.glossary.length ? [p('Glossary', { bold: true, color: INK }), p(s.glossary.map((g) => `${g.term} = ${g.french}`).join('  ·  '), { size: 19 })] : []),
      ];
    case 'writing':
      return [
        ...heading(s.title, `Writing${s.wordCount ? ` · ${s.wordCount}` : ''}`),
        p(s.task, { bold: true }),
        ...fr(s.instructionsFr),
        ...(s.usefulLanguage.length ? [p('Useful language', { bold: true, color: INK }), ...bullets(s.usefulLanguage)] : []),
        ...(s.checklist.length ? [p('Checklist', { bold: true, color: INK }), ...s.checklist.map((c) => p(`☐  ${c}`))] : []),
        ...(teacher && s.modelAnswer ? [p('Model answer', { bold: true, color: ACCENT }), ...s.modelAnswer.split(/\n+/).map((l) => p(l, { italics: true }))] : []),
      ];
    case 'speaking':
      return [
        ...heading(s.title, `Speaking · ${SPEAKING_LABELS[s.activity]}`),
        p(s.instructions, { bold: true }),
        ...fr(s.instructionsFr),
        ...s.roles.flatMap((r) => [runs([{ text: `${r.name}: `, bold: true, color: INK }, { text: r.brief }])]),
        ...s.items.flatMap((it, i) => [runs([{ text: `${i + 1}. `, bold: true, color: INK }, { text: it.text }]), ...(it.detail ? [p(it.detail, { italics: true, color: MUTED, indent: 360 })] : [])]),
        ...(s.usefulLanguage.length ? [p('Useful language', { bold: true, color: INK }), p(s.usefulLanguage.join('  ·  '))] : []),
        ...(teacher && s.teacherTips ? [runs([{ text: 'Teacher tip: ', bold: true, color: ACCENT }, { text: s.teacherTips, italics: true }])] : []),
      ];
    case 'notes':
      return [...heading(s.title, 'Teacher notes'), ...bullets(s.items)];
    case 'homework':
      return [...heading(s.title, 'Homework'), ...bullets(s.items)];
  }
}

export function buildDocx(lesson: Lesson, audience: Audience): Document {
  const teacher = audience === 'teacher';
  const view = forAudience(lesson, audience);
  const meta = [view.level, view.focus, MATERIAL_LABELS[view.materialType]?.label, view.duration ? `${view.duration} min` : ''].filter(Boolean).join('  ·  ');

  const intro: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: teacher ? 'TEACHER VERSION' : 'LEARNER WORKSHEET', color: ACCENT, bold: true, size: 16, characterSpacing: 60 })] }),
    new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 60 }, children: [new TextRun({ text: view.title, font: SERIF, size: 48, color: INK })] }),
    ...(view.subtitle ? [p(view.subtitle, { color: MUTED, size: 24 })] : []),
    p(meta, { color: MUTED, size: 18, after: 200 }),
  ];
  if (!teacher) intro.push(p('Name: ______________________     Date: ______________', { color: MUTED, after: 200 }));
  if (teacher) intro.push(p(view.summary, { italics: true }));
  if (view.objectives.length) intro.push(p(teacher ? 'Objectives' : 'In this lesson you will…', { bold: true, color: INK }), ...bullets(view.objectives));
  if (teacher && view.materials.length) intro.push(p('Materials', { bold: true, color: INK }), ...bullets(view.materials));

  return new Document({
    creator: 'English Teaching Studio',
    title: view.title,
    styles: { default: { document: { run: { font: FONT, size: 21, color: '222222' } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1050, right: 1050 } } },
        headers: {
          default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${view.title}  ·  ${view.level}`, color: MUTED, size: 16 })] })] }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'English Teaching Studio · Antony Addy   —   ', color: MUTED, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16 })],
              }),
            ],
          }),
        },
        children: [...intro, ...view.sections.flatMap((s) => section(s, teacher))],
      },
    ],
  });
}

export async function docxBlob(lesson: Lesson, audience: Audience): Promise<Blob> {
  return Packer.toBlob(buildDocx(lesson, audience));
}

export async function docxBuffer(lesson: Lesson, audience: Audience): Promise<Buffer> {
  return Packer.toBuffer(buildDocx(lesson, audience));
}
