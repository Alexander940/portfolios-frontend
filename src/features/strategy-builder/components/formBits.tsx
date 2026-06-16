// Small presentational primitives for the builder form (ported from the design).
import type { ReactNode } from 'react';

import { Icon } from '../icons';

export function Tip({ text }: { text: string }) {
  return (
    <span className="sb-tip">
      <Icon name="info" size={13} />
      <span className="sb-tip-pop">{text}</span>
    </span>
  );
}

export function Section({
  num,
  title,
  sub,
  warn,
  open,
  onToggle,
  children,
}: {
  num: string;
  title: string;
  sub: string;
  warn?: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`sb-section ${open ? '' : 'collapsed'}`}>
      <div className="sb-section-head" onClick={onToggle}>
        <div className="sb-section-num">{num}</div>
        <div>
          <div className="sb-section-title">
            {title}
            {warn && <span className="sb-section-warn-dot" title="Needs attention" />}
          </div>
          <div className="sb-section-sub">{sub}</div>
        </div>
        <span className="sb-section-chevron">
          <Icon name="chevron" size={16} />
        </span>
      </div>
      <div className="sb-section-body">{children}</div>
    </div>
  );
}

export function NumField({
  label,
  tip,
  value,
  onChange,
  suffix,
  min,
  max,
  step = 1,
  error,
  hint,
}: {
  label: string;
  tip?: string;
  value: number | '';
  onChange: (v: number | '') => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="sb-field" style={{ marginTop: 0 }}>
      <div className="sb-field-label">
        {label}
        {tip && <Tip text={tip} />}
      </div>
      <div className="sb-input-suffix">
        <input
          type="number"
          className={`sb-input mono ${error ? 'error' : ''}`}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
        />
        {suffix && <span>{suffix}</span>}
      </div>
      {error ? (
        <div className="sb-field-error">
          <Icon name="warn" size={11} /> {error}
        </div>
      ) : hint ? (
        <div className="sb-field-hint">{hint}</div>
      ) : null}
    </div>
  );
}

export function ToggleRow({
  name,
  desc,
  tip,
  on,
  onToggle,
}: {
  name: string;
  desc: string;
  tip?: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="sb-toggle-row">
      <div className="sb-toggle-info">
        <div className="sb-toggle-name">
          {name}
          {tip && <Tip text={tip} />}
        </div>
        <div className="sb-toggle-desc">{desc}</div>
      </div>
      <button
        type="button"
        className={`sb-switch ${on ? 'on' : ''}`}
        onClick={onToggle}
        role="switch"
        aria-checked={on}
        aria-label={name}
      />
    </div>
  );
}

export function Sparkline({
  data,
  width = 104,
  height = 34,
  stroke = 'var(--c-accent)',
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const x = (i: number) => pad + (i / (data.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);
  const d = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${d} L ${x(data.length - 1).toFixed(1)},${height} L ${x(0).toFixed(1)},${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={area} fill={stroke} opacity={0.1} />
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
