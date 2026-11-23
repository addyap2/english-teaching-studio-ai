'use client';

import { useLayoutEffect, useRef, type ElementType } from 'react';

interface TextProps {
  value: string;
  onChange?: (value: string) => void;
  editing: boolean;
  label: string;
  as?: ElementType;
  className?: string;
  placeholder?: string;
}

/** Shows text; in edit mode becomes an auto-growing textarea styled like the text it replaces. */
export function Txt({ value, onChange, editing, label, as: Tag = 'span', className, placeholder }: TextProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, editing]);

  if (editing && onChange) {
    return (
      <textarea
        ref={ref}
        rows={1}
        aria-label={label}
        className={`edit-field ${className ?? ''}`}
        value={value}
        placeholder={placeholder ?? label}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (!value) return null;
  return <Tag className={className}>{value}</Tag>;
}

interface ListProps {
  items: string[];
  onChange?: (items: string[]) => void;
  editing: boolean;
  label: string;
  ordered?: boolean;
  className?: string;
}

export function TxtList({ items, onChange, editing, label, ordered, className }: ListProps) {
  const Tag = ordered ? 'ol' : 'ul';
  if (!editing || !onChange) {
    if (!items.length) return null;
    return (
      <Tag className={className}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </Tag>
    );
  }
  return (
    <div className="edit-list">
      {items.map((item, i) => (
        <div className="edit-row" key={i}>
          <Txt
            editing
            label={`${label} ${i + 1}`}
            value={item}
            onChange={(v) => onChange(items.map((x, k) => (k === i ? v : x)))}
          />
          <RemoveButton label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, k) => k !== i))} />
        </div>
      ))}
      <AddButton label={`Add ${label.toLowerCase()}`} onClick={() => onChange([...items, ''])} />
    </div>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="btn-add no-print" onClick={onClick}>
      <span aria-hidden>＋</span> {label}
    </button>
  );
}

export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="btn-icon btn-remove no-print" aria-label={label} title={label} onClick={onClick}>
      ×
    </button>
  );
}

/** Immutable array helpers used by the editors. */
export const replaceAt = <T,>(arr: T[], i: number, value: T) => arr.map((x, k) => (k === i ? value : x));
export const removeAt = <T,>(arr: T[], i: number) => arr.filter((_, k) => k !== i);
export const move = <T,>(arr: T[], from: number, to: number) => {
  if (to < 0 || to >= arr.length) return arr;
  const out = [...arr];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
};
