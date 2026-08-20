import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import type { Notice } from '@/lib/types';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink-50">{title}</h2>
        {hint && <p className="mt-0.5 text-sm leading-snug text-ink-400">{hint}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
};

export function TextInput({ value, onChange, className = '', ...rest }: TextInputProps) {
  return (
    <input
      {...rest}
      className={`field ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

interface NumberInputProps {
  value: number;
  onCommit: (value: number) => void;
  /** Turns the typed string into a number, or null if it isn't valid yet. */
  parse: (raw: string) => number | null;
  /** Renders the committed value back into the box when it isn't being edited. */
  format: (value: number) => string;
  placeholder?: string;
  className?: string;
  inputMode?: 'numeric' | 'decimal';
  selectOnFocus?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * A numeric field that lets you type freely.
 *
 * Reformatting mid-keystroke ("2" becoming "$2.00" while you reach for the 5") is
 * the fastest way to make a form unusable, so the raw text is held locally and
 * only normalised once focus leaves.
 */
export function NumberInput({
  value,
  onCommit,
  parse,
  format,
  placeholder,
  className = '',
  inputMode = 'decimal',
  selectOnFocus = true,
  disabled,
  ariaLabel,
}: NumberInputProps) {
  const [text, setText] = useState(() => format(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(format(value));
  }, [value, focused, format]);

  return (
    <input
      className={`field ${className}`}
      inputMode={inputMode}
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      onFocus={(e) => {
        setFocused(true);
        if (selectOnFocus) e.currentTarget.select();
      }}
      onChange={(e) => {
        setText(e.target.value);
        const parsed = parse(e.target.value);
        if (parsed != null) onCommit(parsed);
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parse(text);
        setText(format(parsed ?? value));
        if (parsed == null) onCommit(value);
      }}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={`seg ${className}`} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={`seg-item ${value === option.value ? 'seg-item-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-ink-100">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-snug text-ink-400">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-felt-500' : 'bg-ink-800'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn-ghost h-9 w-9 !px-0 text-lg"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${label ?? 'value'}`}
      >
        −
      </button>
      <span className="num w-10 text-center text-base font-semibold">{value}</span>
      <button
        type="button"
        className="btn-ghost h-9 w-9 !px-0 text-lg"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${label ?? 'value'}`}
      >
        +
      </button>
    </div>
  );
}

const NOTICE_STYLES: Record<Notice['level'], string> = {
  info: 'border-felt-500/25 bg-felt-500/10 text-felt-100',
  warn: 'border-gold-500/30 bg-gold-500/10 text-gold-300',
  error: 'border-red-500/30 bg-red-500/10 text-red-200',
};

const NOTICE_ICON: Record<Notice['level'], string> = {
  info: 'i',
  warn: '!',
  error: '!',
};

export function Notices({ notices, className = '' }: { notices: Notice[]; className?: string }) {
  if (notices.length === 0) return null;
  return (
    <ul className={`space-y-2 ${className}`}>
      {notices.map((notice, i) => (
        <li
          key={`${notice.level}-${i}`}
          className={`flex gap-2.5 rounded-xl border px-3 py-2.5 text-sm leading-snug ${
            NOTICE_STYLES[notice.level]
          }`}
        >
          <span
            aria-hidden
            className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-bold"
          >
            {NOTICE_ICON[notice.level]}
          </span>
          <span>{notice.message}</span>
        </li>
      ))}
    </ul>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'good' | 'bad' | 'gold';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-felt-300'
      : tone === 'bad'
        ? 'text-red-300'
        : tone === 'gold'
          ? 'text-gold-400'
          : 'text-ink-50';
  return (
    <div className="rounded-xl border border-white/5 bg-white/[.02] px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`num mt-0.5 text-lg font-semibold leading-tight ${toneClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-500">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
      <p className="text-sm font-medium text-ink-300">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

/** Confirms an action that would throw away work, without a blocking dialog. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Sure?',
  className = 'btn-danger',
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
          return;
        }
        setArmed(true);
        timer.current = window.setTimeout(() => setArmed(false), 3000);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
