'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Audience } from '../lib/learner';
import { extractJson, fitTimings, normaliseLesson, normaliseSection, parseSection, qualityReport, seededRng } from '../lib/normalise';
import { buildSectionPrompt, SYSTEM_PROMPT } from '../lib/prompt';
import { SAMPLE_LESSON } from '../lib/samples';
import { DEFAULT_SETTINGS, formatZodIssues, SECTION_LABELS, SECTION_TYPES, settingsSchema, type Lesson, type Section, type SectionType, type Settings } from '../lib/schema';
import * as store from '../lib/storage';
import { BUILT_IN_TEMPLATES, type Template } from '../lib/templates';
import { ExportStep } from './ExportStep';
import { GenerateStep, type ServerStatus } from './GenerateStep';
import { Library } from './Library';
import { SetupStep } from './SetupStep';
import { Worksheet } from './Worksheet';

type Step = 'setup' | 'generate' | 'edit' | 'export';
const STEPS: { id: Step; label: string; hint: string }[] = [
  { id: 'setup', label: 'Set up', hint: 'Brief' },
  { id: 'generate', label: 'Generate', hint: 'AI writes' },
  { id: 'edit', label: 'Edit', hint: 'Refine' },
  { id: 'export', label: 'Export', hint: 'PDF · Word · Kahoot' },
];

const EMPTY_SECTIONS: Record<SectionType, () => Section> = {
  plan: () => ({ type: 'plan', title: 'Lesson plan', stages: [{ title: 'Warm-up', minutes: 10, interaction: 'Pairs', aim: '', procedure: '', notes: '' }] }),
  vocabulary: () => ({ type: 'vocabulary', title: 'Vocabulary', instructions: '', items: [{ term: '', pos: '', french: '', example: '' }], expressions: [] }),
  grammar: () => ({ type: 'grammar', title: 'Grammar', explanation: '', form: [], usage: [], examples: [], pitfalls: [] }),
  exercise: () => ({ type: 'exercise', title: 'Exercise', kind: 'multiple-choice', instructions: 'Choose the correct answer.', items: [{ prompt: '', options: ['', '', '', ''], answer: '', correctIndex: 0, explanation: '' }] }),
  reading: () => ({ type: 'reading', title: 'Reading', intro: '', text: '', glossary: [] }),
  writing: () => ({ type: 'writing', title: 'Writing', task: '', wordCount: '', usefulLanguage: [], checklist: [], modelAnswer: '' }),
  speaking: () => ({ type: 'speaking', title: 'Speaking', activity: 'discussion', instructions: 'Discuss in pairs.', items: [{ text: '', detail: '' }], roles: [], usefulLanguage: [], teacherTips: '' }),
  notes: () => ({ type: 'notes', title: 'Teacher notes', items: [''], teacherOnly: true }),
  homework: () => ({ type: 'homework', title: 'Homework', items: [''] }),
};

export function Studio() {
  const [step, setStep] = useState<Step>('setup');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [setupErrors, setSetupErrors] = useState<string[]>([]);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [history, setHistory] = useState<Lesson[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [audience, setAudience] = useState<Audience>('teacher');
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [accessKey, setAccessKeyState] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryRefresh, setLibraryRefresh] = useState(0);
  const [userTemplates, setUserTemplates] = useState<Template[]>([]);
  const [printAudience, setPrintAudience] = useState<Audience>('learner');
  const [regenIndex, setRegenIndex] = useState<number | null>(null);
  const [regenBusy, setRegenBusy] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const abort = useRef<AbortController | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Restore browser-side state.
  useEffect(() => {
    const saved = store.loadSettings();
    if (saved) setSettings(saved);
    setUserTemplates(store.listTemplates());
    setAccessKeyState(store.getAccessKey());
    fetch('/api/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((s: ServerStatus | null) => setStatus(s ?? { aiConfigured: false, provider: null, model: null, accessKeyRequired: false }))
      .catch(() => setStatus({ aiConfigured: false, provider: null, model: null, accessKeyRequired: false }));
  }, []);

  useEffect(() => store.storeSettings(settings), [settings]);

  // Keep sticky offsets in step with the header height (it wraps on smaller screens).
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('.topbar');
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--topbar-h', `${Math.round(bar.getBoundingClientRect().height)}px`));
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  // Autosave the lesson being edited.
  useEffect(() => {
    if (!lesson || lesson.source === 'sample') return;
    const t = window.setTimeout(() => {
      store.saveLesson(lesson, settings);
      setLibraryRefresh((x) => x + 1);
    }, 700);
    return () => window.clearTimeout(t);
  }, [lesson, settings]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const go = useCallback((s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => mainRef.current?.focus({ preventScroll: true }), 50);
  }, []);

  const updateLesson = useCallback(
    (next: Lesson) => {
      if (lesson) setHistory((h) => [...h.slice(-49), lesson]);
      setLesson({ ...next, updatedAt: new Date().toISOString() });
    },
    [lesson],
  );

  useEffect(() => {
    if (lesson) setWarnings(qualityReport(lesson, settings));
  }, [lesson, settings]);

  function undo() {
    if (!history.length) return;
    setLesson(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  }

  function openLesson(l: Lesson, w: string[] = [], s?: Settings) {
    if (s) setSettings(s);
    setLesson(l);
    setHistory([]);
    setWarnings(w);
    setAudience('teacher');
    setEditing(false);
    go('edit');
  }

  function validateSetup(): boolean {
    const parsed = settingsSchema.safeParse(settings);
    setSetupErrors(parsed.success ? [] : formatZodIssues(parsed.error).map((e) => e.replace(/^[^:]+:\s*/, '')));
    return parsed.success;
  }

  async function generate() {
    if (!validateSetup()) return go('setup');
    setBusy(true);
    setError('');
    const controller = new AbortController();
    abort.current = controller;
    try {
      store.setAccessKey(accessKey);
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-access-key': accessKey },
        body: JSON.stringify({ action: 'lesson', settings }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({ error: `The server returned an unexpected response (${res.status}).` }));
      if (!res.ok) throw new Error(data.details ? `${data.error} ${data.details.join('; ')}` : data.error);
      openLesson(data.lesson, data.warnings ?? []);
      setToast('Lesson ready — saved to your library.');
    } catch (e) {
      if ((e as Error).name === 'AbortError') setError('Generation cancelled.');
      else setError(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  function printAs(a: Audience) {
    setPrintAudience(a);
    window.setTimeout(() => window.print(), 60);
  }

  const templates = [...userTemplates, ...BUILT_IN_TEMPLATES];
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar no-print">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            E
          </span>
          <div>
            <p className="brand-name">English Teaching Studio</p>
            <p className="brand-sub">British English materials for adult learners · Antony Addy</p>
          </div>
        </div>
        <nav className="steps" aria-label="Steps">
          <ol>
            {STEPS.map((s, i) => {
              const locked = (s.id === 'edit' || s.id === 'export') && !lesson;
              return (
                <li key={s.id}>
                  <button type="button" className={`step${step === s.id ? ' is-current' : ''}${i < stepIndex ? ' is-done' : ''}`} onClick={() => go(s.id)} disabled={locked} aria-current={step === s.id ? 'step' : undefined}>
                    <span className="step-n" aria-hidden>
                      {i + 1}
                    </span>
                    <span className="step-label">{s.label}</span>
                    <span className="step-hint">{s.hint}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <button type="button" className="btn btn-quiet library-btn" onClick={() => setLibraryOpen(true)}>
          Library
        </button>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className={`main main-${step} no-print`}>
        {step === 'setup' && (
          <>
            <Intro title="Plan the material" text="Choose what you need, for whom and how long. General English is the default; every exercise has at least ten questions." />
            <SetupStep
              settings={settings}
              onChange={(s) => {
                setSettings(s);
                if (setupErrors.length) setSetupErrors([]);
              }}
              templates={templates}
              onApplyTemplate={(t) => {
                setSettings(t.settings);
                setToast(`Template “${t.name}” applied.`);
              }}
              onSaveTemplate={() => {
                const name = window.prompt('Name this template', `${settings.topic.slice(0, 40)} · ${settings.level}`);
                if (name?.trim()) {
                  store.saveTemplate(name.trim(), settings);
                  setUserTemplates(store.listTemplates());
                  setToast('Template saved.');
                }
              }}
              onDeleteTemplate={(id) => {
                store.deleteTemplate(id);
                setUserTemplates(store.listTemplates());
              }}
              errors={setupErrors}
              onNext={() => validateSetup() && go('generate')}
            />
          </>
        )}

        {step === 'generate' && (
          <>
            <Intro title="Generate" text="Write the material with the AI API in one click, or for free through your Claude.ai subscription." />
            <GenerateStep
              settings={settings}
              status={status}
              accessKey={accessKey}
              onAccessKey={setAccessKeyState}
              busy={busy}
              error={error}
              onGenerate={generate}
              onCancel={() => abort.current?.abort()}
              onLesson={(l, w) => {
                openLesson(l, w);
                setToast('Lesson imported — saved to your library.');
              }}
              onSample={() => openLesson(normaliseLesson(SAMPLE_LESSON, { duration: 90 }, seededRng(11)), [])}
              onBack={() => go('setup')}
            />
          </>
        )}

        {step === 'edit' && lesson && (
          <div className="editor">
            <div className="editor-bar" role="toolbar" aria-label="Editor">
              <div className="segmented" role="radiogroup" aria-label="Version">
                {(['teacher', 'learner'] as const).map((a) => (
                  <label key={a} className={audience === a ? 'is-on' : ''}>
                    <input
                      type="radio"
                      name="audience"
                      checked={audience === a}
                      onChange={() => {
                        setAudience(a);
                        if (a === 'learner') setEditing(false);
                      }}
                    />
                    {a === 'teacher' ? 'Teacher version' : 'Learner version'}
                  </label>
                ))}
              </div>
              <div className="editor-actions">
                <button type="button" className="btn btn-quiet" onClick={undo} disabled={!history.length}>
                  ↶ Undo
                </button>
                <button
                  type="button"
                  className={`btn ${editing ? 'btn-primary' : 'btn-secondary'}`}
                  aria-pressed={editing}
                  onClick={() => {
                    setAudience('teacher');
                    setEditing((e) => !e);
                  }}
                >
                  {editing ? '✓ Done editing' : '✎ Edit'}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => go('export')}>
                  Export →
                </button>
              </div>
            </div>
            {lesson.source === 'sample' && <p className="alert alert-info">This is the built-in sample lesson (written by hand, not by AI). Edits to it are not saved; generate or import your own lesson to build your library.</p>}
            {warnings.length > 0 && (
              <details className="alert alert-warn quality">
                <summary>
                  {warnings.length} quality check{warnings.length > 1 ? 's' : ''} to review
                </summary>
                <ul>
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
            {audience === 'learner' && <p className="alert alert-info">Learner preview — answers, explanations, model answers, the lesson plan and teacher notes are removed.</p>}
            <div className="sheet-frame">
              <Worksheet lesson={lesson} audience={audience} editing={editing} onChange={updateLesson} onRegenerate={(i) => setRegenIndex(i)} regenerating={regenBusy} />
            </div>
            {editing && (
              <AddSection
                onAdd={(type) => {
                  updateLesson({ ...lesson, sections: [...lesson.sections, normaliseSection(EMPTY_SECTIONS[type]())] });
                }}
              />
            )}
          </div>
        )}

        {step === 'export' && lesson && (
          <>
            <Intro title="Export" text={`“${lesson.title}” — choose the version and format.`} />
            <ExportStep lesson={lesson} onPrint={printAs} />
            <div className="step-actions">
              <button type="button" className="btn btn-quiet" onClick={() => go('edit')}>
                ← Back to editing
              </button>
            </div>
          </>
        )}
      </main>

      {lesson && (
        <div className="print-root" aria-hidden>
          <Worksheet lesson={lesson} audience={printAudience} editing={false} printMode />
        </div>
      )}

      {regenIndex !== null && lesson && (
        <RegenerateDialog
          section={lesson.sections[regenIndex]}
          lesson={lesson}
          settings={settings}
          status={status}
          accessKey={accessKey}
          onClose={() => setRegenIndex(null)}
          onBusy={(b) => setRegenBusy(b ? regenIndex : null)}
          onReplace={(section) => {
            const i = regenIndex;
            const fitted: Section =
              section.type === 'plan' && lesson.duration > 0
                ? { ...section, stages: section.stages.map((st, k, all) => ({ ...st, minutes: fitTimings(all.map((x) => x.minutes), lesson.duration)[k] })) }
                : section;
            updateLesson({ ...lesson, sections: lesson.sections.map((s, k) => (k === i ? { ...fitted, id: s.id } : s)) });
            setRegenIndex(null);
            setToast('Section rewritten. Use Undo to restore the previous version.');
          }}
        />
      )}

      <Library open={libraryOpen} onClose={() => setLibraryOpen(false)} onOpenLesson={(l, s) => openLesson(l, [], s)} refreshKey={libraryRefresh} />

      <div className="toast-region no-print" aria-live="polite">
        {toast && <p className="toast">{toast}</p>}
      </div>
    </div>
  );
}

function Intro({ title, text }: { title: string; text: string }) {
  return (
    <div className="intro">
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  );
}

function AddSection({ onAdd }: { onAdd: (type: SectionType) => void }) {
  return (
    <div className="add-section no-print">
      <span className="muted">Add a section:</span>
      {SECTION_TYPES.map((t) => (
        <button key={t} type="button" className="btn-chip" onClick={() => onAdd(t)}>
          ＋ {SECTION_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

function RegenerateDialog(props: {
  section: Section;
  lesson: Lesson;
  settings: Settings;
  status: ServerStatus | null;
  accessKey: string;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
  onReplace: (section: Section) => void;
}) {
  const { section, lesson, settings, status } = props;
  const [request, setRequest] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pasted, setPasted] = useState('');
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const ai = Boolean(status?.aiConfigured);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const lessonCtx = { title: lesson.title, summary: lesson.summary, level: lesson.level, keyLanguage: lesson.keyLanguage };

  async function rewrite() {
    setBusy(true);
    props.onBusy(true);
    setError('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-access-key': props.accessKey },
        body: JSON.stringify({ action: 'section', settings, sectionType: section.type, request, lesson: lessonCtx, current: section }),
      });
      const data = await res.json().catch(() => ({ error: `Unexpected response (${res.status}).` }));
      if (!res.ok) throw new Error(data.error);
      props.onReplace(data.section);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rewrite failed.');
    } finally {
      setBusy(false);
      props.onBusy(false);
    }
  }

  async function copy() {
    const text = `${SYSTEM_PROMPT}\n\n---\n\n${buildSectionPrompt(settings, lessonCtx, section.type, request, section)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError('Copy failed.');
    }
  }

  function importPasted() {
    setError('');
    try {
      const parsed = parseSection(extractJson(pasted));
      if (!parsed.ok) throw new Error(parsed.errors.slice(0, 3).join('; '));
      if (parsed.value.type !== section.type) throw new Error(`Expected a ${section.type} section.`);
      props.onReplace(normaliseSection(parsed.value));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the reply.');
    }
  }

  return (
    <dialog ref={ref} className="regen-dialog" aria-labelledby="regen-title" onClose={props.onClose} onCancel={props.onClose}>
      <h2 id="regen-title">Rewrite “{section.title}”</h2>
      <p className="muted small">Only this section changes; the rest of your lesson and your edits stay as they are.</p>
      <div className="field">
        <label htmlFor="regen-request">What should change?</label>
        <textarea id="regen-request" rows={3} value={request} onChange={(e) => setRequest(e.target.value)} placeholder="e.g. Make it easier · 15 questions · more phrasal verbs · add a hospitality context" maxLength={600} />
      </div>
      {ai ? (
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={rewrite} disabled={busy}>
            {busy ? 'Rewriting…' : '✦ Rewrite section'}
          </button>
          <button type="button" className="btn btn-quiet" onClick={props.onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      ) : (
        <>
          <p className="muted small">No API key on the server: copy the prompt into Claude.ai and paste the reply here.</p>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={copy}>
              {copied ? '✓ Copied' : 'Copy prompt'}
            </button>
          </div>
          <div className="field">
            <label htmlFor="regen-paste">Claude’s reply</label>
            <textarea id="regen-paste" rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} />
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={importPasted} disabled={!pasted.trim()}>
              Replace section
            </button>
            <button type="button" className="btn btn-quiet" onClick={props.onClose}>
              Cancel
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
    </dialog>
  );
}
