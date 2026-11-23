'use client';

import { Fragment } from 'react';
import { forAudience, matchingColumn, type Audience } from '../lib/learner';
import { fitTimings, stageClock } from '../lib/normalise';
import { EXERCISE_LABELS, MATERIAL_LABELS, SPEAKING_LABELS } from '../lib/options';
import {
  SECTION_LABELS,
  type ExerciseSection,
  type GrammarSection,
  type Lesson,
  type PlanSection,
  type ReadingSection,
  type Section,
  type SpeakingSection,
  type VocabularySection,
  type WritingSection,
} from '../lib/schema';
import { AddButton, RemoveButton, Txt, TxtList, move, removeAt, replaceAt } from './editable';
import { SpinWheel } from './SpinWheel';

const letter = (i: number) => String.fromCharCode(65 + i);

interface Props {
  lesson: Lesson;
  audience: Audience;
  editing: boolean;
  onChange?: (lesson: Lesson) => void;
  onRegenerate?: (sectionIndex: number) => void;
  regenerating?: number | null;
  printMode?: boolean;
}

export function Worksheet({ lesson, audience, editing, onChange, onRegenerate, regenerating, printMode }: Props) {
  const teacher = audience === 'teacher';
  const view = forAudience(lesson, audience);
  const canEdit = editing && teacher && !!onChange;
  const set = (patch: Partial<Lesson>) => onChange?.({ ...lesson, ...patch });
  const setSection = (i: number, s: Section) => set({ sections: replaceAt(lesson.sections, i, s) });
  const meta = [view.level, view.focus, MATERIAL_LABELS[view.materialType]?.label, view.duration ? `${view.duration} min` : ''].filter(Boolean);

  return (
    <article className={`sheet ${teacher ? 'sheet-teacher' : 'sheet-learner'}`} aria-label={`${teacher ? 'Teacher' : 'Learner'} version of ${view.title}`}>
      <header className="sheet-head">
        <p className="kicker">{teacher ? 'Teacher version' : 'Learner worksheet'}</p>
        <Txt as="h1" className="sheet-title" editing={canEdit} label="Lesson title" value={lesson.title} onChange={(title) => set({ title })} />
        <Txt as="p" className="sheet-subtitle" editing={canEdit} label="Subtitle" value={view.subtitle} onChange={(subtitle) => set({ subtitle })} />
        <ul className="meta-row">
          {meta.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        {!teacher && (
          <p className="name-line">
            Name <span /> Date <span />
          </p>
        )}
      </header>

      {teacher && (
        <div className="sheet-intro">
          <Txt as="p" className="summary" editing={canEdit} label="Summary for the teacher" value={lesson.summary} onChange={(summary) => set({ summary })} />
          <div className="intro-grid">
            <div>
              <h3 className="mini-h">Objectives</h3>
              <TxtList editing={canEdit} label="Objective" items={lesson.objectives} onChange={(objectives) => set({ objectives })} />
            </div>
            {(lesson.keyLanguage.length > 0 || canEdit) && (
              <div>
                <h3 className="mini-h">Key language</h3>
                <TxtList editing={canEdit} label="Key phrase" items={lesson.keyLanguage} onChange={(keyLanguage) => set({ keyLanguage })} className="key-language" />
              </div>
            )}
            {(lesson.materials.length > 0 || canEdit) && (
              <div>
                <h3 className="mini-h">Materials</h3>
                <TxtList editing={canEdit} label="Material" items={lesson.materials} onChange={(materials) => set({ materials })} />
              </div>
            )}
          </div>
        </div>
      )}
      {!teacher && view.objectives.length > 0 && (
        <div className="sheet-intro">
          <h3 className="mini-h">In this lesson you will…</h3>
          <ul>
            {view.objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      )}

      {view.sections.map((section, vi) => {
        // In the teacher view indexes match the lesson; learner view is read-only.
        const index = teacher ? vi : -1;
        return (
          <section key={section.id ?? vi} className={`block block-${section.type}${section.teacherOnly ? ' teacher-only' : ''}`} aria-labelledby={`h-${section.id ?? vi}`}>
            {canEdit && index > -1 && !printMode && (
              <SectionToolbar
                index={index}
                count={lesson.sections.length}
                busy={regenerating === index}
                onMove={(to) => set({ sections: move(lesson.sections, index, to) })}
                onDuplicate={() =>
                  set({
                    sections: [
                      ...lesson.sections.slice(0, index + 1),
                      { ...structuredClone(section), id: `${section.type}-${Date.now()}`, title: `${section.title} (copy)` },
                      ...lesson.sections.slice(index + 1),
                    ],
                  })
                }
                onDelete={() => {
                  if (window.confirm(`Delete “${section.title}”?`)) set({ sections: removeAt(lesson.sections, index) });
                }}
                onRegenerate={onRegenerate ? () => onRegenerate(index) : undefined}
              />
            )}
            {teacher && !printMode && regenerating === index && <div className="regen-overlay" role="status">Rewriting this section…</div>}
            <SectionBody section={section} editing={canEdit} teacher={teacher} printMode={!!printMode} duration={lesson.duration} onChange={(s) => index > -1 && setSection(index, s)} />
          </section>
        );
      })}

      <footer className="sheet-foot">English Teaching Studio · Antony Addy</footer>
    </article>
  );
}

function SectionToolbar(props: {
  index: number;
  count: number;
  busy: boolean;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRegenerate?: () => void;
}) {
  const { index, count, busy } = props;
  return (
    <div className="section-tools no-print" role="toolbar" aria-label="Section tools">
      <button type="button" className="btn-icon" onClick={() => props.onMove(index - 1)} disabled={index === 0} aria-label="Move section up" title="Move up">
        ↑
      </button>
      <button type="button" className="btn-icon" onClick={() => props.onMove(index + 1)} disabled={index === count - 1} aria-label="Move section down" title="Move down">
        ↓
      </button>
      <button type="button" className="btn-icon" onClick={props.onDuplicate} aria-label="Duplicate section" title="Duplicate">
        ⧉
      </button>
      {props.onRegenerate && (
        <button type="button" className="btn-chip" onClick={props.onRegenerate} disabled={busy}>
          ✦ Rewrite with AI
        </button>
      )}
      <button type="button" className="btn-icon btn-remove" onClick={props.onDelete} aria-label="Delete section" title="Delete">
        ×
      </button>
    </div>
  );
}

interface BodyProps<S extends Section> {
  section: S;
  editing: boolean;
  teacher: boolean;
  printMode: boolean;
  duration?: number;
  onChange: (s: S) => void;
}

function SectionHeading({ section, kicker, editing, onChange }: { section: Section; kicker: string; editing: boolean; onChange: (title: string) => void }) {
  return (
    <header className="block-head">
      <p className="kicker">
        {kicker}
        {section.teacherOnly && <span className="badge">Teacher only</span>}
      </p>
      <Txt as="h2" className="block-title" editing={editing} label="Section title" value={section.title} onChange={onChange} />
    </header>
  );
}

function Fr({ value, editing, onChange, label = 'French instructions' }: { value?: string; editing: boolean; onChange: (v: string) => void; label?: string }) {
  if (!editing && !value) return null;
  return (
    <p className="fr">
      <span className="fr-tag" aria-hidden>
        FR
      </span>
      <Txt editing={editing} label={label} value={value ?? ''} onChange={onChange} />
    </p>
  );
}

function SectionBody(props: BodyProps<Section>) {
  const { section } = props;
  switch (section.type) {
    case 'plan':
      return <PlanBody {...(props as BodyProps<PlanSection>)} />;
    case 'vocabulary':
      return <VocabularyBody {...(props as BodyProps<VocabularySection>)} />;
    case 'grammar':
      return <GrammarBody {...(props as BodyProps<GrammarSection>)} />;
    case 'exercise':
      return <ExerciseBody {...(props as BodyProps<ExerciseSection>)} />;
    case 'reading':
      return <ReadingBody {...(props as BodyProps<ReadingSection>)} />;
    case 'writing':
      return <WritingBody {...(props as BodyProps<WritingSection>)} />;
    case 'speaking':
      return <SpeakingBody {...(props as BodyProps<SpeakingSection>)} />;
    case 'notes':
    case 'homework':
      return (
        <>
          <SectionHeading section={section} kicker={SECTION_LABELS[section.type]} editing={props.editing} onChange={(title) => props.onChange({ ...section, title })} />
          <TxtList editing={props.editing} label={section.type === 'notes' ? 'Note' : 'Task'} items={section.items} onChange={(items) => props.onChange({ ...section, items })} />
        </>
      );
  }
}

function PlanBody({ section, editing, duration, onChange }: BodyProps<PlanSection>) {
  const clocks = stageClock(section.stages.map((s) => s.minutes));
  const total = section.stages.reduce((a, s) => a + s.minutes, 0);
  const mismatch = Boolean(duration) && total !== duration;
  const fit = () => {
    const fitted = fitTimings(section.stages.map((s) => s.minutes), duration!);
    onChange({ ...section, stages: section.stages.map((s, i) => ({ ...s, minutes: fitted[i] })) });
  };
  const setStage = (i: number, patch: Partial<PlanSection['stages'][number]>) =>
    onChange({ ...section, stages: replaceAt(section.stages, i, { ...section.stages[i], ...patch }) });
  return (
    <>
      <SectionHeading section={section} kicker={`Lesson plan · ${total} min`} editing={editing} onChange={(title) => onChange({ ...section, title })} />
      <ol className="stages">
        {section.stages.map((st, i) => (
          <li key={i} className="stage">
            <div className="stage-time">
              <span className="clock">{clocks[i]}</span>
              {editing ? (
                <label className="minutes-edit">
                  <input type="number" min={1} max={240} value={st.minutes} onChange={(e) => setStage(i, { minutes: Math.max(0, Number(e.target.value) || 0) })} aria-label={`Minutes for stage ${i + 1}`} />
                  min
                </label>
              ) : (
                <span className="minutes">{st.minutes} min</span>
              )}
              <Txt className="interaction" editing={editing} label="Interaction" value={st.interaction} onChange={(interaction) => setStage(i, { interaction })} />
            </div>
            <div className="stage-body">
              <Txt as="h3" className="stage-title" editing={editing} label="Stage title" value={st.title} onChange={(title) => setStage(i, { title })} />
              <Txt as="p" className="stage-aim" editing={editing} label="Aim" value={st.aim} onChange={(aim) => setStage(i, { aim })} />
              <Txt as="p" className="stage-procedure" editing={editing} label="Procedure" value={st.procedure} onChange={(procedure) => setStage(i, { procedure })} />
              <Txt as="p" className="stage-notes" editing={editing} label="Stage notes" value={st.notes} onChange={(notes) => setStage(i, { notes })} />
            </div>
            {editing && <RemoveButton label={`Remove stage ${i + 1}`} onClick={() => onChange({ ...section, stages: removeAt(section.stages, i) })} />}
          </li>
        ))}
      </ol>
      {mismatch && (
        <p className="timing-warning no-print" role="status">
          Stages add up to {total} min; the lesson is {duration} min.{' '}
          <button type="button" className="link-button" onClick={fit}>
            Fit timings to {duration} min
          </button>
        </p>
      )}
      {editing && <AddButton label="Add stage" onClick={() => onChange({ ...section, stages: [...section.stages, { title: 'New stage', minutes: 5, interaction: 'Pairs', aim: '', procedure: '', notes: '' }] })} />}
    </>
  );
}

function VocabularyBody({ section, editing, onChange }: BodyProps<VocabularySection>) {
  const setItem = (i: number, patch: Partial<VocabularySection['items'][number]>) => onChange({ ...section, items: replaceAt(section.items, i, { ...section.items[i], ...patch }) });
  const setExpr = (i: number, patch: Partial<VocabularySection['expressions'][number]>) =>
    onChange({ ...section, expressions: replaceAt(section.expressions, i, { ...section.expressions[i], ...patch }) });
  return (
    <>
      <SectionHeading section={section} kicker="Vocabulary · EN / FR" editing={editing} onChange={(title) => onChange({ ...section, title })} />
      <Txt as="p" className="instructions" editing={editing} label="Instructions" value={section.instructions} onChange={(instructions) => onChange({ ...section, instructions })} />
      <Fr value={section.instructionsFr} editing={editing} onChange={(instructionsFr) => onChange({ ...section, instructionsFr })} />
      <div className="table-wrap">
        <table className="vocab">
          <thead>
            <tr>
              <th scope="col">English</th>
              <th scope="col">Français</th>
              <th scope="col">Example</th>
              {editing && <th aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {section.items.map((v, i) => (
              <tr key={i}>
                <td>
                  <Txt as="strong" editing={editing} label="Term" value={v.term} onChange={(term) => setItem(i, { term })} />
                  {(v.pos || editing) && (
                    <span className="pos">
                      {' '}
                      <Txt editing={editing} label="Part of speech" value={v.pos} onChange={(pos) => setItem(i, { pos })} />
                    </span>
                  )}
                </td>
                <td>
                  <Txt editing={editing} label="French" value={v.french} onChange={(french) => setItem(i, { french })} />
                </td>
                <td className="example">
                  <Txt editing={editing} label="Example" value={v.example} onChange={(example) => setItem(i, { example })} />
                </td>
                {editing && (
                  <td>
                    <RemoveButton label={`Remove ${v.term}`} onClick={() => onChange({ ...section, items: removeAt(section.items, i) })} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <AddButton label="Add word" onClick={() => onChange({ ...section, items: [...section.items, { term: '', pos: '', french: '', example: '' }] })} />}
      {(section.expressions.length > 0 || editing) && (
        <>
          <h3 className="mini-h">Useful expressions</h3>
          <ul className="expressions">
            {section.expressions.map((e, i) => (
              <li key={i}>
                <Txt as="strong" editing={editing} label="Expression" value={e.expression} onChange={(expression) => setExpr(i, { expression })} />
                <span className="expr-fr">
                  <Txt editing={editing} label="French" value={e.french} onChange={(french) => setExpr(i, { french })} />
                </span>
                <Txt as="em" editing={editing} label="Example" value={e.example} onChange={(example) => setExpr(i, { example })} />
                {editing && <RemoveButton label={`Remove ${e.expression}`} onClick={() => onChange({ ...section, expressions: removeAt(section.expressions, i) })} />}
              </li>
            ))}
          </ul>
          {editing && <AddButton label="Add expression" onClick={() => onChange({ ...section, expressions: [...section.expressions, { expression: '', french: '', example: '' }] })} />}
        </>
      )}
    </>
  );
}

function GrammarBody({ section, editing, onChange }: BodyProps<GrammarSection>) {
  return (
    <>
      <SectionHeading section={section} kicker="Grammar" editing={editing} onChange={(title) => onChange({ ...section, title })} />
      <Txt as="p" className="explanation" editing={editing} label="Explanation" value={section.explanation} onChange={(explanation) => onChange({ ...section, explanation })} />
      <Fr value={section.explanationFr} editing={editing} label="French explanation" onChange={(explanationFr) => onChange({ ...section, explanationFr })} />
      {section.form.length > 0 && (
        <div className="table-wrap">
          <table className="form-table">
            <tbody>
              {section.form.map((f, i) => (
                <tr key={i}>
                  <th scope="row">
                    <Txt editing={editing} label="Form label" value={f.label} onChange={(label) => onChange({ ...section, form: replaceAt(section.form, i, { ...f, label }) })} />
                  </th>
                  <td className="pattern">
                    <Txt editing={editing} label="Pattern" value={f.pattern} onChange={(pattern) => onChange({ ...section, form: replaceAt(section.form, i, { ...f, pattern }) })} />
                  </td>
                  <td className="example">
                    <Txt editing={editing} label="Example" value={f.example} onChange={(example) => onChange({ ...section, form: replaceAt(section.form, i, { ...f, example }) })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="two-col">
        {(section.usage.length > 0 || editing) && (
          <div>
            <h3 className="mini-h">When we use it</h3>
            <TxtList editing={editing} label="Use" items={section.usage} onChange={(usage) => onChange({ ...section, usage })} />
          </div>
        )}
        {(section.examples.length > 0 || editing) && (
          <div>
            <h3 className="mini-h">Examples</h3>
            <TxtList editing={editing} label="Example" items={section.examples} onChange={(examples) => onChange({ ...section, examples })} className="examples" />
          </div>
        )}
      </div>
      {section.pitfalls.length > 0 && (
        <>
          <h3 className="mini-h">Watch out</h3>
          <ul className="pitfalls">
            {section.pitfalls.map((p, i) => (
              <li key={i}>
                <span className="wrong">
                  <span aria-label="Incorrect">✗</span> <Txt editing={editing} label="Incorrect" value={p.wrong} onChange={(wrong) => onChange({ ...section, pitfalls: replaceAt(section.pitfalls, i, { ...p, wrong }) })} />
                </span>
                <span className="right">
                  <span aria-label="Correct">✓</span> <Txt editing={editing} label="Correct" value={p.right} onChange={(right) => onChange({ ...section, pitfalls: replaceAt(section.pitfalls, i, { ...p, right }) })} />
                </span>
                <Txt as="span" className="why" editing={editing} label="Why" value={p.note} onChange={(note) => onChange({ ...section, pitfalls: replaceAt(section.pitfalls, i, { ...p, note }) })} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function ExerciseBody({ section, editing, teacher, onChange }: BodyProps<ExerciseSection>) {
  const setItem = (i: number, patch: Partial<ExerciseSection['items'][number]>) => onChange({ ...section, items: replaceAt(section.items, i, { ...section.items[i], ...patch }) });
  const choice = section.kind === 'multiple-choice' || section.kind === 'true-false';
  const kicker = [section.exam || EXERCISE_LABELS[section.kind], `${section.items.length} questions`].join(' · ');
  const column = section.kind === 'matching' ? matchingColumn(section) : [];

  return (
    <>
      <SectionHeading section={section} kicker={kicker} editing={editing} onChange={(title) => onChange({ ...section, title })} />
      <Txt as="p" className="instructions" editing={editing} label="Instructions" value={section.instructions} onChange={(instructions) => onChange({ ...section, instructions })} />
      <Fr value={section.instructionsFr} editing={editing} onChange={(instructionsFr) => onChange({ ...section, instructionsFr })} />
      {section.wordBank && section.wordBank.length > 0 && section.kind !== 'matching' && (
        <p className="word-bank">
          {section.wordBank.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </p>
      )}

      {section.kind === 'matching' && !editing ? (
        <div className="matching">
          <ol className="match-left">
            {section.items.map((it, i) => (
              <li key={i}>
                {it.prompt}
                <span className="match-blank">{teacher ? letter(column.indexOf(it.answer)) : ''}</span>
              </li>
            ))}
          </ol>
          <ol className="match-right" type="A">
            {column.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        </div>
      ) : (
        <ol className={`items items-${section.kind}`}>
          {section.items.map((item, i) => (
            <li key={i} className="item">
              <Txt as="p" className="prompt" editing={editing} label={`Question ${i + 1}`} value={item.prompt} onChange={(prompt) => setItem(i, { prompt })} />
              {choice && item.options && (
                <ol className="options" type="A">
                  {item.options.map((o, k) => {
                    const correct = teacher && item.correctIndex === k;
                    return (
                      <li key={k} className={correct ? 'correct' : undefined}>
                        {editing && section.kind === 'multiple-choice' ? (
                          <span className="option-edit">
                            <input
                              type="radio"
                              name={`correct-${section.id}-${i}`}
                              checked={item.correctIndex === k}
                              onChange={() => setItem(i, { correctIndex: k, answer: o })}
                              aria-label={`Mark option ${letter(k)} as correct`}
                            />
                            <Txt
                              editing
                              label={`Option ${letter(k)}`}
                              value={o}
                              onChange={(v) => {
                                const options = replaceAt(item.options!, k, v);
                                setItem(i, { options, answer: item.correctIndex === k ? v : item.answer });
                              }}
                            />
                          </span>
                        ) : (
                          <>
                            {o}
                            {correct && <span className="sr-only"> (correct answer)</span>}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {!choice && !teacher && <span className="answer-line" aria-hidden />}
              {teacher && (
                <div className="answer">
                  {!choice && (
                    <p>
                      <span className="answer-tag">Answer</span>
                      <Txt editing={editing} label={`Answer ${i + 1}`} value={item.answer} onChange={(answer) => setItem(i, { answer })} />
                    </p>
                  )}
                  {choice && item.correctIndex !== undefined && !editing && <span className="answer-tag">Answer {letter(item.correctIndex)}</span>}
                  <Txt as="span" className="explain" editing={editing} label={`Explanation ${i + 1}`} value={item.explanation} onChange={(explanation) => setItem(i, { explanation })} />
                </div>
              )}
              {editing && <RemoveButton label={`Remove question ${i + 1}`} onClick={() => onChange({ ...section, items: removeAt(section.items, i) })} />}
            </li>
          ))}
        </ol>
      )}
      {editing && (
        <AddButton
          label="Add question"
          onClick={() =>
            onChange({
              ...section,
              items: [
                ...section.items,
                section.kind === 'multiple-choice'
                  ? { prompt: '', options: ['', '', '', ''], answer: '', correctIndex: 0, explanation: '' }
                  : section.kind === 'true-false'
                    ? { prompt: '', options: ['True', 'False'], answer: 'True', correctIndex: 0, explanation: '' }
                    : { prompt: '', answer: '', explanation: '' },
              ],
            })
          }
        />
      )}
    </>
  );
}

function ReadingBody({ section, editing, onChange }: BodyProps<ReadingSection>) {
  return (
    <>
      <SectionHeading section={section} kicker="Reading" editing={editing} onChange={(title) => onChange({ ...section, title })} />
      <Txt as="p" className="reading-intro" editing={editing} label="Introduction" value={section.intro} onChange={(intro) => onChange({ ...section, intro })} />
      {editing ? (
        <Txt editing label="Reading text" className="reading-text" value={section.text} onChange={(text) => onChange({ ...section, text })} />
      ) : (
        <div className="reading-text">
          {section.text.split(/\n\s*\n/).map((para, i) => (
            <p key={i}>{para.trim()}</p>
          ))}
        </div>
      )}
      {section.glossary.length > 0 && (
        <p className="glossary">
          <strong>Glossary</strong>{' '}
          {section.glossary.map((g, i) => (
            <Fragment key={i}>
              <span>
                {g.term} = <em>{g.french}</em>
              </span>
            </Fragment>
          ))}
        </p>
      )}
    </>
  );
}

function WritingBody({ section, editing, teacher, onChange }: BodyProps<WritingSection>) {
  return (
    <>
      <SectionHeading section={section} kicker={`Writing${section.wordCount ? ` · ${section.wordCount}` : ''}`} editing={editing} onChange={(title) => onChange({ ...section, title })} />
      <Txt as="p" className="instructions" editing={editing} label="Task" value={section.task} onChange={(task) => onChange({ ...section, task })} />
      <Fr value={section.instructionsFr} editing={editing} onChange={(instructionsFr) => onChange({ ...section, instructionsFr })} />
      <div className="two-col">
        {(section.usefulLanguage.length > 0 || editing) && (
          <div>
            <h3 className="mini-h">Useful language</h3>
            <TxtList editing={editing} label="Phrase" items={section.usefulLanguage} onChange={(usefulLanguage) => onChange({ ...section, usefulLanguage })} />
          </div>
        )}
        {(section.checklist.length > 0 || editing) && (
          <div>
            <h3 className="mini-h">Checklist</h3>
            <TxtList editing={editing} label="Check" items={section.checklist} onChange={(checklist) => onChange({ ...section, checklist })} className="checklist" />
          </div>
        )}
      </div>
      {!teacher && <div className="writing-lines" aria-hidden />}
      {teacher && (section.modelAnswer || editing) && (
        <div className="model-answer">
          <h3 className="mini-h">Model answer</h3>
          <Txt as="p" editing={editing} label="Model answer" value={section.modelAnswer} onChange={(modelAnswer) => onChange({ ...section, modelAnswer })} />
        </div>
      )}
    </>
  );
}

const CARD_ACTIVITIES = new Set(['would-you-rather', 'this-or-that', 'conversation-cards']);

function SpeakingBody({ section, editing, teacher, printMode, onChange }: BodyProps<SpeakingSection>) {
  const setItem = (i: number, patch: Partial<SpeakingSection['items'][number]>) => onChange({ ...section, items: replaceAt(section.items, i, { ...section.items[i], ...patch }) });
  const cards = CARD_ACTIVITIES.has(section.activity) && !editing;
  return (
    <>
      <SectionHeading section={section} kicker={`Speaking · ${SPEAKING_LABELS[section.activity]}`} editing={editing} onChange={(title) => onChange({ ...section, title })} />
      <Txt as="p" className="instructions" editing={editing} label="Instructions" value={section.instructions} onChange={(instructions) => onChange({ ...section, instructions })} />
      <Fr value={section.instructionsFr} editing={editing} onChange={(instructionsFr) => onChange({ ...section, instructionsFr })} />

      {section.roles.length > 0 && (
        <div className="roles">
          {section.roles.map((r, i) => (
            <div key={i} className="role-card">
              <Txt as="h3" editing={editing} label="Role name" value={r.name} onChange={(name) => onChange({ ...section, roles: replaceAt(section.roles, i, { ...r, name }) })} />
              <Txt as="p" editing={editing} label="Role brief" value={r.brief} onChange={(brief) => onChange({ ...section, roles: replaceAt(section.roles, i, { ...r, brief }) })} />
            </div>
          ))}
        </div>
      )}

      {section.activity === 'spin-the-wheel' && !editing && !printMode && <SpinWheel items={section.items.map((i) => i.text)} />}

      {cards ? (
        <ul className={`cards cards-${section.activity}`}>
          {section.items.map((it, i) => (
            <li key={i} className="card">
              <span className="card-n">{i + 1}</span>
              <p className="card-text">{it.text}</p>
              {it.detail && <p className="card-detail">{it.detail}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <ol className={`prompts${section.activity === 'spin-the-wheel' && !printMode && !editing ? ' print-only' : ''}`}>
          {section.items.map((it, i) => (
            <li key={i}>
              <Txt as="p" className="prompt" editing={editing} label={`Prompt ${i + 1}`} value={it.text} onChange={(text) => setItem(i, { text })} />
              <Txt as="p" className="detail" editing={editing} label={`Follow-up ${i + 1}`} value={it.detail} onChange={(detail) => setItem(i, { detail })} />
              {editing && <RemoveButton label={`Remove prompt ${i + 1}`} onClick={() => onChange({ ...section, items: removeAt(section.items, i) })} />}
            </li>
          ))}
        </ol>
      )}
      {editing && <AddButton label="Add prompt" onClick={() => onChange({ ...section, items: [...section.items, { text: '', detail: '' }] })} />}

      {(section.usefulLanguage.length > 0 || editing) && (
        <div className="useful">
          <h3 className="mini-h">Useful language</h3>
          {editing ? (
            <TxtList editing label="Phrase" items={section.usefulLanguage} onChange={(usefulLanguage) => onChange({ ...section, usefulLanguage })} />
          ) : (
            <p className="phrase-strip">
              {section.usefulLanguage.map((u, i) => (
                <span key={i}>{u}</span>
              ))}
            </p>
          )}
        </div>
      )}
      {teacher && (section.teacherTips || editing) && (
        <p className="tip">
          <span className="answer-tag">Teacher tip</span>
          <Txt editing={editing} label="Teacher tip" value={section.teacherTips} onChange={(teacherTips) => onChange({ ...section, teacherTips })} />
        </p>
      )}
    </>
  );
}
