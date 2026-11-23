'use client';

import { useRef, useState } from 'react';

const COLOURS = ['#1B2A41', '#A2412E', '#5E7A6B', '#C59A3D', '#37506F', '#7D5A50'];

function polar(cx: number, cy: number, r: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function wrap(text: string, max = 16): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max && line) {
      lines.push(line);
      line = w;
    } else line = `${line} ${w}`.trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

/** An on-screen wheel for speaking prompts. Prints as a numbered list instead. */
export function SpinWheel({ items }: { items: string[] }) {
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const live = useRef<HTMLParagraphElement>(null);
  const n = Math.max(items.length, 1);
  const slice = 360 / n;
  const size = 320;
  const c = size / 2;
  const r = c - 6;

  function spin() {
    if (spinning || items.length < 2) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const target = Math.floor(Math.random() * n);
    // Land the middle of the target slice under the pointer at the top.
    const landing = 360 - (target * slice + slice / 2);
    const turns = reduced ? 0 : 5 * 360;
    const next = rotation - (rotation % 360) + turns + landing;
    setSpinning(true);
    setResult(null);
    setRotation(next);
    window.setTimeout(
      () => {
        setSpinning(false);
        setResult(target);
      },
      reduced ? 50 : 4200,
    );
  }

  return (
    <div className="wheel no-print">
      <div className="wheel-stage">
        <div className="wheel-pointer" aria-hidden />
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="wheel-svg"
          style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 4.2s cubic-bezier(.12,.67,.12,1)' : 'none' }}
          role="img"
          aria-label={`Wheel with ${items.length} prompts`}
        >
          {items.map((item, i) => {
            const a0 = i * slice;
            const a1 = a0 + slice;
            const p0 = polar(c, c, r, a0);
            const p1 = polar(c, c, r, a1);
            const large = slice > 180 ? 1 : 0;
            const mid = a0 + slice / 2;
            const tp = polar(c, c, r * 0.62, mid);
            return (
              <g key={i}>
                <path d={`M${c},${c} L${p0.x},${p0.y} A${r},${r} 0 ${large} 1 ${p1.x},${p1.y} Z`} fill={COLOURS[i % COLOURS.length]} stroke="#F7F4EE" strokeWidth="2" />
                <text x={tp.x} y={tp.y} fill="#fff" fontSize={n > 10 ? 9 : 10.5} fontWeight={600} textAnchor="middle" transform={`rotate(${mid - 90} ${tp.x} ${tp.y})`}>
                  {wrap(item, n > 10 ? 14 : 16).map((line, k, all) => (
                    <tspan key={k} x={tp.x} dy={k === 0 ? `${-(all.length - 1) * 0.55}em` : '1.1em'}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
          <circle cx={c} cy={c} r={18} fill="#F7F4EE" stroke="#1B2A41" strokeWidth="3" />
        </svg>
      </div>
      <div className="wheel-side">
        <button type="button" className="btn btn-primary" onClick={spin} disabled={spinning || items.length < 2}>
          {spinning ? 'Spinning…' : 'Spin the wheel'}
        </button>
        <p className="wheel-result" aria-live="polite" ref={live}>
          {result !== null ? items[result] : spinning ? '' : 'Press spin to choose a prompt.'}
        </p>
      </div>
    </div>
  );
}
