'use client';

import { useEffect, useId, useState } from 'react';
import { buildManualPrompt } from '../lib/prompt';
import { extractJson, normaliseLesson, parseLesson, qualityReport } from '../lib/normalise';
import { LEVEL_LABELS, MATERIAL_LABELS } from '../lib/options';
import type { Lesson, Settings } from '../lib/schema';

export interface ServerStatus {
  aiConfigured: boolean;
  provider: string | null;
  model: string | null;
  accessKeyRequired: boolean;
}

interface Props {
  settings: Settings;
  status: ServerStatus | null;
  accessKey: string;
  onAccessKey: (k: string) => void;
  busy: boolean;
  error: string;
  onGenerate: () => void;
  onCancel: () => void;
  onLesson: (lesson: Lesson, warnings: string[]) => void;
  onSample: () => void;
  onBack: () => void;
}

function Elapsed() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setS((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span>
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
    </span>
  );
}

export function GenerateStep({ settings, status, accessKey, onAccessKey, busy, error, onGenerate, onCancel, onLesson, onSample, onBack }: Props) {
  const id = useId();
  const [pasted, setPasted] = useState('');
  const [importError, setImportError] = useState('');
  const [copied, setCopied] = useState(false);
  const prompt = buildManualPrompt(settings);
  // One-click generation only appears if the server has an API key; the free Claude.ai route is always there.
  const ai = Boolean(status?.aiConfigured);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setImportError('Copy failed — select the prompt text and copy it manually.');
    }
  }

  function importReply() {
    setImportError('');
    try {
      const parsed = parseLesson(extractJson(pasted));
      if (!parsed.ok) {
        setImportError(`The reply is not in the expected format: ${parsed.errors.slice(0, 3).join('; ')}. Ask Claude to “return the complete JSON only” and paste again.`);
        return;
      }
      const lesson = normaliseLesson({ ...parsed.value, source: 'claude.ai' }, settings);
      onLesson(lesson, qualityReport(lesson, settings));
      setPasted('');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Could not read the reply.');
    }
  }

  const summary = [MATERIAL_LABELS[settings.materialType].label, settings.focus, LEVEL_LABELS[settings.level], `${settings.duration} min`, `${settings.questionsPerExercise} questions per exercise`];

  return (
    <div className="generate">
      <div className="panel summary-panel">
        <p className="kicker">Your brief</p>
        <h2 className="brief-title">{settings.topic}</h2>
        <ul className="meta-row">
          {summary.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <button type="button" className="btn btn-quiet" onClick={onBack}>
          ← Change settings
        </button>
      </div>

      <div className={`routes${ai ? '' : ' routes-single'}`}>
        {ai && (
        <section className="panel route route-ai" aria-labelledby={`${id}-ai`}>
          <p className="kicker">Option 1 · One click</p>
          <h2 id={`${id}-ai`}>Generate with the AI API</h2>
          {status && (
            <>
              <p className="muted">
                Uses the server’s {status.provider === 'anthropic' ? 'Claude' : 'OpenAI'} API ({status.model}). A full lesson takes about one to three minutes.
              </p>
              {status.accessKeyRequired && (
                <div className="field">
                  <label htmlFor={`${id}-key`}>Studio access key</label>
                  <input id={`${id}-key`} type="password" autoComplete="current-password" value={accessKey} onChange={(e) => onAccessKey(e.target.value)} placeholder="Your private passphrase" />
                </div>
              )}
              {busy ? (
                <div className="progress" role="status" aria-live="polite">
                  <span className="spinner" aria-hidden />
                  <div>
                    <strong>Writing your material…</strong> <Elapsed />
                    <p className="muted small">Planning stages, writing exercises, checking answers and timings.</p>
                  </div>
                  <button type="button" className="btn btn-quiet" onClick={onCancel}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-primary btn-lg" onClick={onGenerate} disabled={status.accessKeyRequired && !accessKey}>
                  ✦ Generate material
                </button>
              )}
              {error && (
                <p className="alert alert-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </section>
        )}

        <section className="panel route route-manual" aria-labelledby={`${id}-manual`}>
          <p className="kicker">{ai ? 'Option 2 · No API key needed' : 'Free · uses your Claude subscription'}</p>
          <h2 id={`${id}-manual`}>Generate with Claude.ai</h2>
          <ol className="how">
            <li>
              Copy the prompt.{' '}
              <button type="button" className="btn btn-secondary" onClick={copyPrompt}>
                {copied ? '✓ Copied' : 'Copy prompt'}
              </button>
            </li>
            <li>
              Paste it into a new chat at{' '}
              <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">
                claude.ai
              </a>{' '}
              and send it.
            </li>
            <li>Copy Claude’s whole reply and paste it below.</li>
          </ol>
          <p className="muted small">
            If the reply stops part-way, type “continue” in Claude, then paste both parts together. Very long materials (40 questions, 4 hours) use more of your Claude usage allowance.
          </p>
          <details className="prompt-preview">
            <summary>Show the prompt</summary>
            <pre tabIndex={0}>{prompt}</pre>
          </details>
          <div className="field">
            <label htmlFor={`${id}-paste`}>Claude’s reply</label>
            <textarea id={`${id}-paste`} rows={5} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder='Paste the reply here (it starts with "{")' />
          </div>
          <button type="button" className="btn btn-primary" onClick={importReply} disabled={!pasted.trim()}>
            Import lesson
          </button>
          {importError && (
            <p className="alert alert-error" role="alert">
              {importError}
            </p>
          )}
        </section>
      </div>

      <p className="sample-link">
        Just exploring?{' '}
        <button type="button" className="link-button" onClick={onSample}>
          Open the sample B1 lesson
        </button>{' '}
        to try editing and exports.
      </p>
    </div>
  );
}
