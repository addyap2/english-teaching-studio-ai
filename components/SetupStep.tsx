'use client';

import { useId } from 'react';
import {
  DURATIONS,
  FOCUSES,
  FOCUS_BRIEFS,
  FORMATS,
  LEVELS,
  LEVEL_LABELS,
  MATERIAL_LABELS,
  MATERIAL_TYPES,
  SPEAKING_ACTIVITIES,
  SPEAKING_LABELS,
} from '../lib/options';
import type { Settings } from '../lib/schema';
import type { Template } from '../lib/templates';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  templates: Template[];
  onApplyTemplate: (t: Template) => void;
  onSaveTemplate: () => void;
  onDeleteTemplate: (id: string) => void;
  onNext: () => void;
  errors: string[];
}

export function SetupStep({ settings, onChange, templates, onApplyTemplate, onSaveTemplate, onDeleteTemplate, onNext, errors }: Props) {
  const id = useId();
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  const toggleActivity = (a: Settings['speakingActivities'][number]) =>
    set('speakingActivities', settings.speakingActivities.includes(a) ? settings.speakingActivities.filter((x) => x !== a) : [...settings.speakingActivities, a]);

  return (
    <form
      className="setup"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
      noValidate
    >
      <section className="panel templates-panel" aria-labelledby={`${id}-tpl`}>
        <div className="panel-head">
          <h2 id={`${id}-tpl`}>Start from a template</h2>
          <button type="button" className="btn btn-quiet" onClick={onSaveTemplate}>
            Save current settings as template
          </button>
        </div>
        <ul className="template-row">
          {templates.map((t) => (
            <li key={t.id}>
              <button type="button" className="template" onClick={() => onApplyTemplate(t)}>
                <strong>{t.name}</strong>
                <span>{t.description}</span>
              </button>
              {!t.builtIn && (
                <button type="button" className="btn-icon btn-remove template-del" aria-label={`Delete template ${t.name}`} onClick={() => onDeleteTemplate(t.id)}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby={`${id}-what`}>
        <h2 id={`${id}-what`}>What are you making?</h2>
        <div className="tiles" role="radiogroup" aria-label="Material type">
          {MATERIAL_TYPES.map((m) => (
            <label key={m} className={`tile${settings.materialType === m ? ' is-on' : ''}`}>
              <input type="radio" name="materialType" value={m} checked={settings.materialType === m} onChange={() => set('materialType', m)} />
              <strong>{MATERIAL_LABELS[m].label}</strong>
              <span>{MATERIAL_LABELS[m].blurb}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby={`${id}-who`}>
        <h2 id={`${id}-who`}>Topic, context and level</h2>
        <div className="grid-2">
          <div className="field span-2">
            <label htmlFor={`${id}-topic`}>Topic</label>
            <input id={`${id}-topic`} value={settings.topic} onChange={(e) => set('topic', e.target.value)} placeholder="e.g. Making plans and arrangements" maxLength={300} required />
          </div>
          <div className="field">
            <label htmlFor={`${id}-focus`}>Context</label>
            <select id={`${id}-focus`} value={settings.focus} onChange={(e) => set('focus', e.target.value as Settings['focus'])}>
              {FOCUSES.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <p className="hint">{FOCUS_BRIEFS[settings.focus]}</p>
          </div>
          <div className="field">
            <span className="label" id={`${id}-level`}>
              CEFR level
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby={`${id}-level`}>
              {LEVELS.map((l) => (
                <label key={l} className={settings.level === l ? 'is-on' : ''} title={LEVEL_LABELS[l]}>
                  <input type="radio" name="level" value={l} checked={settings.level === l} onChange={() => set('level', l)} />
                  {l}
                </label>
              ))}
            </div>
            <p className="hint">{LEVEL_LABELS[settings.level]}</p>
            {settings.level === 'Mixed' && (
              <input aria-label="Level range for the mixed group" className="mt-s" value={settings.mixedRange} onChange={(e) => set('mixedRange', e.target.value)} placeholder="Range, e.g. A2–B1" maxLength={40} />
            )}
          </div>
          <div className="field">
            <label htmlFor={`${id}-grammar`}>
              Grammar focus <span className="optional">optional</span>
            </label>
            <input id={`${id}-grammar`} value={settings.grammarFocus} onChange={(e) => set('grammarFocus', e.target.value)} placeholder="e.g. Present perfect vs past simple" maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-vocab`}>
              Vocabulary focus <span className="optional">optional</span>
            </label>
            <input id={`${id}-vocab`} value={settings.vocabularyFocus} onChange={(e) => set('vocabularyFocus', e.target.value)} placeholder="e.g. Phrasal verbs for travel" maxLength={200} />
          </div>
        </div>
      </section>

      <section className="panel" aria-labelledby={`${id}-class`}>
        <h2 id={`${id}-class`}>Class and format</h2>
        <div className="grid-4">
          <div className="field">
            <label htmlFor={`${id}-duration`}>Duration</label>
            <select id={`${id}-duration`} value={settings.duration} onChange={(e) => set('duration', Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-learners`}>Learners</label>
            <input id={`${id}-learners`} type="number" inputMode="numeric" min={1} max={60} value={settings.learners} onChange={(e) => set('learners', Math.min(60, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-format`}>Format</label>
            <select id={`${id}-format`} value={settings.format} onChange={(e) => set('format', e.target.value as Settings['format'])}>
              {FORMATS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-lang`}>Instructions</label>
            <select id={`${id}-lang`} value={settings.instructionLanguage} onChange={(e) => set('instructionLanguage', e.target.value as Settings['instructionLanguage'])}>
              <option value="Bilingual">English + French</option>
              <option value="English">English only</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-q`}>Questions per exercise</label>
            <input id={`${id}-q`} type="number" inputMode="numeric" min={10} max={40} value={settings.questionsPerExercise} onChange={(e) => set('questionsPerExercise', Number(e.target.value) || 10)} aria-describedby={`${id}-q-hint`} />
            <p className="hint" id={`${id}-q-hint`}>
              10 to 40
            </p>
          </div>
          <div className="field">
            <span className="label" id={`${id}-opts`}>
              Multiple-choice options
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby={`${id}-opts`}>
              {([3, 4] as const).map((n) => (
                <label key={n} className={settings.optionsPerQuestion === n ? 'is-on' : ''}>
                  <input type="radio" name="opts" checked={settings.optionsPerQuestion === n} onChange={() => set('optionsPerQuestion', n)} />
                  {n} options
                </label>
              ))}
            </div>
          </div>
        </div>
        <fieldset className="field chips-field">
          <legend>Speaking activities</legend>
          <div className="chips">
            {SPEAKING_ACTIVITIES.map((a) => (
              <label key={a} className={`chip${settings.speakingActivities.includes(a) ? ' is-on' : ''}`}>
                <input type="checkbox" checked={settings.speakingActivities.includes(a)} onChange={() => toggleActivity(a)} />
                {SPEAKING_LABELS[a]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor={`${id}-notes`}>
            Notes for the AI <span className="optional">optional</span>
          </label>
          <textarea id={`${id}-notes`} rows={3} value={settings.notes} onChange={(e) => set('notes', e.target.value)} maxLength={1500} placeholder="e.g. Learners are nurses; avoid politics; include a short listening script the teacher can read aloud." />
        </div>
      </section>

      {errors.length > 0 && (
        <div className="alert alert-error" role="alert">
          <strong>Please check:</strong>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="step-actions">
        <button type="submit" className="btn btn-primary btn-lg">
          Continue to generate →
        </button>
      </div>
    </form>
  );
}
