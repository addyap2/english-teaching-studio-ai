'use client';

import { useState } from 'react';
import type { Audience } from '../lib/learner';
import { KAHOOT_TIME_LIMITS } from '../lib/options';
import type { Lesson } from '../lib/schema';

export function slug(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'lesson'
  );
}

export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

interface Props {
  lesson: Lesson;
  onPrint: (audience: Audience) => void;
}

export function ExportStep({ lesson, onPrint }: Props) {
  const [time, setTime] = useState(20);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const base = slug(lesson.title);

  async function run(label: string, task: () => Promise<string | void>) {
    setWorking(label);
    setMessage(null);
    try {
      const note = await task();
      setMessage(note ? { kind: 'warn', text: note } : { kind: 'ok', text: `${label} downloaded.` });
    } catch (e) {
      setMessage({ kind: 'error', text: `${label} failed: ${e instanceof Error ? e.message : 'unknown error'}` });
    } finally {
      setWorking('');
    }
  }

  const docx = (audience: Audience) =>
    run(`${audience === 'teacher' ? 'Teacher' : 'Learner'} Word document`, async () => {
      const { docxBlob } = await import('../lib/exports/docx');
      download(`${base}-${audience}.docx`, await docxBlob(lesson, audience), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

  const kahoot = (format: 'xlsx' | 'csv') =>
    run(`Kahoot ${format.toUpperCase()}`, async () => {
      const k = await import('../lib/exports/kahoot');
      const { rows, warnings } = k.kahootRows(lesson, time);
      if (!rows.length) throw new Error('there are no multiple-choice or true/false questions in this material');
      if (format === 'xlsx') download(`${base}-kahoot.xlsx`, (await k.kahootXlsx(rows, lesson.title)) as BlobPart, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      else download(`${base}-kahoot.csv`, k.kahootCsv(rows), 'text/csv;charset=utf-8');
      return warnings.length ? `Kahoot file downloaded (${rows.length} questions). ${warnings.slice(0, 3).join(' ')}` : `Kahoot file downloaded (${rows.length} questions).`;
    });

  const busy = Boolean(working);

  return (
    <div className="export">
      <div className="export-grid">
        <section className="panel export-card">
          <p className="kicker">Print-ready PDF</p>
          <h2>Print or save as PDF</h2>
          <p className="muted">A4 worksheet layout. In the print window choose “Save as PDF”. Turn off “Headers and footers” for the cleanest page.</p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => onPrint('learner')} disabled={busy}>
              Learner PDF
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => onPrint('teacher')} disabled={busy}>
              Teacher PDF
            </button>
          </div>
        </section>

        <section className="panel export-card">
          <p className="kicker">Editable</p>
          <h2>Word document (.docx)</h2>
          <p className="muted">Opens in Word, Pages, LibreOffice or Google Docs. The learner version has no answers or teacher notes.</p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => docx('learner')} disabled={busy}>
              Learner .docx
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => docx('teacher')} disabled={busy}>
              Teacher .docx
            </button>
          </div>
        </section>

        <section className="panel export-card">
          <p className="kicker">Quiz</p>
          <h2>Kahoot</h2>
          <p className="muted">
            Exports every multiple-choice and true/false question. In Kahoot: <em>Create → Add question → Import spreadsheet</em> and upload the <strong>.xlsx</strong>. The CSV has the same columns for Google Sheets or other quiz tools.
          </p>
          <div className="field inline-field">
            <label htmlFor="kahoot-time">Time per question</label>
            <select id="kahoot-time" value={time} onChange={(e) => setTime(Number(e.target.value))}>
              {KAHOOT_TIME_LIMITS.map((t) => (
                <option key={t} value={t}>
                  {t} seconds
                </option>
              ))}
            </select>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => kahoot('xlsx')} disabled={busy}>
              Kahoot .xlsx
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => kahoot('csv')} disabled={busy}>
              Kahoot .csv
            </button>
          </div>
        </section>

        <section className="panel export-card">
          <p className="kicker">Backup</p>
          <h2>Lesson file (.json)</h2>
          <p className="muted">The complete editable lesson. Re-open it later from the Library with “Import”.</p>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={() => download(`${base}.json`, JSON.stringify(lesson, null, 2), 'application/json')} disabled={busy}>
              Download .json
            </button>
          </div>
        </section>
      </div>
      <div aria-live="polite" className="export-status">
        {working && <p className="muted">Preparing {working}…</p>}
        {message && <p className={`alert alert-${message.kind}`}>{message.text}</p>}
      </div>
    </div>
  );
}
