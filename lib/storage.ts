'use client';

import { lessonSchema, settingsSchema, type Lesson, type Settings } from './schema';
import type { Template } from './templates';

/**
 * Everything is stored in this browser (localStorage) — no database, no
 * account. Use "Back up library" to move lessons between devices.
 */

const KEYS = { lessons: 'ets.lessons.v1', templates: 'ets.templates.v1', settings: 'ets.settings.v1' } as const;

export interface SavedLesson {
  id: string;
  title: string;
  level: string;
  focus: string;
  updatedAt: string;
  settings?: Settings;
  lesson: Lesson;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // private mode or storage full
  }
}

export function listLessons(): SavedLesson[] {
  return read<SavedLesson[]>(KEYS.lessons, [])
    .filter((l) => l && l.lesson && lessonSchema.safeParse(l.lesson).success)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveLesson(lesson: Lesson, settings?: Settings): boolean {
  const id = lesson.id ?? `lesson-${Date.now()}`;
  const entry: SavedLesson = {
    id,
    title: lesson.title,
    level: lesson.level,
    focus: lesson.focus,
    updatedAt: new Date().toISOString(),
    settings,
    lesson: { ...lesson, id },
  };
  const others = read<SavedLesson[]>(KEYS.lessons, []).filter((l) => l.id !== id);
  return write(KEYS.lessons, [entry, ...others].slice(0, 200));
}

export function deleteLesson(id: string): void {
  write(
    KEYS.lessons,
    read<SavedLesson[]>(KEYS.lessons, []).filter((l) => l.id !== id),
  );
}

export function listTemplates(): Template[] {
  return read<Template[]>(KEYS.templates, []).filter((t) => settingsSchema.safeParse(t.settings).success);
}

export function saveTemplate(name: string, settings: Settings): Template {
  const template: Template = { id: `tpl-${Date.now()}`, name, description: `${settings.level} · ${settings.focus}`, settings };
  write(KEYS.templates, [template, ...listTemplates()]);
  return template;
}

export function deleteTemplate(id: string): void {
  write(
    KEYS.templates,
    listTemplates().filter((t) => t.id !== id),
  );
}

export function loadSettings(): Settings | null {
  const parsed = settingsSchema.safeParse(read<unknown>(KEYS.settings, null));
  return parsed.success ? parsed.data : null;
}

export function storeSettings(settings: Settings): void {
  write(KEYS.settings, settings);
}

export function exportLibrary(): string {
  return JSON.stringify({ app: 'english-teaching-studio', version: 1, lessons: listLessons(), templates: listTemplates() }, null, 2);
}

export function importLibrary(json: string): { lessons: number; templates: number } {
  const data = JSON.parse(json) as { lessons?: SavedLesson[]; templates?: Template[] };
  const lessons = (data.lessons ?? []).filter((l) => lessonSchema.safeParse(l.lesson).success);
  const templates = (data.templates ?? []).filter((t) => settingsSchema.safeParse(t.settings).success);
  const existing = read<SavedLesson[]>(KEYS.lessons, []);
  const ids = new Set(lessons.map((l) => l.id));
  write(KEYS.lessons, [...lessons, ...existing.filter((l) => !ids.has(l.id))]);
  const tIds = new Set(templates.map((t) => t.id));
  write(KEYS.templates, [...templates, ...listTemplates().filter((t) => !tIds.has(t.id))]);
  return { lessons: lessons.length, templates: templates.length };
}

export function getAccessKey(): string {
  try {
    return window.sessionStorage.getItem('ets.access') ?? '';
  } catch {
    return '';
  }
}

export function setAccessKey(key: string): void {
  try {
    window.sessionStorage.setItem('ets.access', key);
  } catch {
    /* ignore */
  }
}
