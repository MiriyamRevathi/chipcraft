import React from 'react';
import type { SignalState } from '../types/circuit';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4CE6] focus-visible:ring-offset-1 disabled:opacity-45 disabled:pointer-events-none cursor-pointer';
  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  }[size];
  const variants = {
    primary: 'bg-[#5B4CE6] text-white hover:bg-[#4A3BD6] border border-transparent',
    secondary: 'bg-white text-[#141226] hover:bg-[#F3F0FF] border border-[#E4DFF7]',
    ghost: 'bg-transparent text-[#5B587A] hover:text-[#141226] hover:bg-[#F3F0FF] border border-transparent',
    danger: 'bg-[#DC2626] text-white hover:bg-[#B91C1C] border border-transparent',
  }[variant];

  return (
    <button className={`${base} ${sizes} ${variants} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Surface({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-[#E4DFF7] rounded-lg ${className}`}>
      {children}
    </div>
  );
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (val: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % options.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + options.length) % options.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = options.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    onChange(options[nextIdx].value);
    const parent = e.currentTarget.parentElement;
    const buttons = parent?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[nextIdx]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 p-1 bg-[#F1EEFC] border border-[#E4DFF7] rounded-lg ${className}`}
    >
      {options.map((opt, idx) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4CE6] ${
              active
                ? 'bg-white text-[#5B4CE6] shadow-xs'
                : 'text-[#5B587A] hover:text-[#141226]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function SignalReadout({ state, compact = false }: { state: SignalState; compact?: boolean }) {
  const styles: Record<SignalState, { text: string; glyph: string; label: string }> = {
    HIGH: { text: 'text-[#15803D]', glyph: '1', label: 'HIGH' },
    LOW: { text: 'text-[#5B587A]', glyph: '0', label: 'LOW' },
    UNKNOWN: { text: 'text-[#B45309]', glyph: 'X', label: 'FLOATING' },
    HIGH_IMPEDANCE: { text: 'text-[#0891B2]', glyph: 'Z', label: 'HI-Z' },
    ERROR: { text: 'text-[#DC2626]', glyph: 'E', label: 'ERROR' },
  };
  const s = styles[state];
  return (
    <span className={`font-mono text-xs font-semibold tabular-nums ${s.text}`}>
      {compact ? s.glyph : `${s.glyph} · ${s.label}`}
    </span>
  );
}

export function KeyHint({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-mono text-[#5B587A] bg-[#F3F0FF] border border-[#E4DFF7] rounded">
      {children}
    </kbd>
  );
}
