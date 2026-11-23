'use client';

import { useEffect, useRef, useState } from 'react';
import { lessonSchema, type Lesson, type Settings } from '../lib/schema';
import { deleteLesson, exportLibrary, importLibrary, listLessons, type SavedLesson } from '../lib/storage';
import { normaliseLesson } from '../lib/normalise';
import { download } from './ExportStep';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenLesson: (lesson: Lesson, settings?: Settings) => void;
  refreshKey: number;
}

export function Library({ open, onClose, onOpenLesson, refreshKey }: Props) {
  const [lessons, setLessons] = useState<SavedLesson[]>([]);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setLessons(listLessons());
  }, [open, refreshKey]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function onFile(f: File) {
    setMessage('');
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (data && Array.isArray(data.lessons)) {
        const r = importLibrary(text);
        setLessons(listLessons());
        setMessage(`Imported ${r.lessons} lesson(s) and ${r.templates} template(s).`);
        return;
      }
      const parsed = lessonSchema.safeParse(data);
      if (!parsed.success) throw new Error('This file is not a lesson or library backup.');
      onOpenLesson(normaliseLesson(parsed.data));
      onClose();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not read the file.');
    }
  }

  const shown = lessons.filter((l) => `${l.title} ${l.level} ${l.focus}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <dialog ref={dialog} className="library" aria-labelledby="library-title" onClose={onClose} onCancel={onClose}>
      <div className="library-head">
        <h2 id="library-title">Library</h2>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Close library">
          ×
        </button>
      </div>
      <p className="muted small">Lessons are saved automatically in this browser. Back up your library to keep a copy or move it to another device.</p>
      <div className="library-tools">
        <input type="search" aria-label="Search saved lessons" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="btn btn-secondary" onClick={() => file.current?.click()}>
          Import file
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => download('teaching-studio-library.json', exportLibrary(), 'application/json')}>
          Back up library
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = '';
          }}
        />
      </div>
      {message && (
        <p className="alert alert-ok" role="status">
          {message}
        </p>
      )}
      {shown.length === 0 ? (
        <p className="empty">{lessons.length ? 'No lessons match your search.' : 'No saved lessons yet. Generated and edited lessons appear here.'}</p>
      ) : (
        <ul className="saved-list">
          {shown.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                className="saved"
                onClick={() => {
                  onOpenLesson(l.lesson, l.settings);
                  onClose();
                }}
              >
                <strong>{l.title}</strong>
                <span>
                  {l.level} · {l.focus} · {new Date(l.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </button>
              <button
                type="button"
                className="btn-icon btn-remove"
                aria-label={`Delete ${l.title}`}
                onClick={() => {
                  if (window.confirm(`Delete “${l.title}” from this browser? This cannot be undone.`)) {
                    deleteLesson(l.id);
                    setLessons(listLessons());
                  }
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}
