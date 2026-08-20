'use client';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle,
  Info,
  Minus,
  Plus,
  Warning,
  WarningOctagon,
} from '@phosphor-icons/react';
import type { Notice } from '@/lib/types';
import { SPRING, haptic, reveal } from '@/lib/motion';
import { Icon } from './Icon';
import { Pressable } from './Pressable';

/** Single-layer surface. The default for routine content. */
export function Card({
  children,
  className = '',
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <m.section {...reveal(reduced, index)} className={`panel p-4 sm:p-5 ${className}`}>
      {children}
    </m.section>
  );
}

/**
 * Nested surface: a core seated inside a shell, curves concentric.
 * Reserved for the few places that carry the moment, so the extra weight
 * still means something when it appears.
 */
export function ShellCard({
  children,
  className = '',
  coreClassName = '',
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  coreClassName?: string;
  index?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <m.section {...reveal(reduced, index)} className={`shell ${className}`}>
      <div className={`core overflow-hidden ${coreClassName}`}>{children}</div>
    </m.section>
  );
}

/**
 * Tiles a phase's panels into columns once there is room for them.
 *
 * Multi-column rather than a grid, so panels keep their natural heights instead
 * of stretching to fill a row, and so the DOM order is untouched: a narrow
 * screen gets exactly the single column it had before, in the same order.
 */
export function TileGrid({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`space-y-4 lg:columns-2 lg:gap-5 lg:space-y-0 lg:[&>*]:mb-5 lg:[&>*]:break-inside-avoid ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * A tile that runs the full width of a TileGrid instead of sitting in a column.
 *
 * For panels whose content is naturally wide, like a stack per player, and for
 * the tall trailing panel that would otherwise leave one column short.
 */
export function TileWide({ children }: { children: ReactNode }) {
  return <div className="lg:[column-span:all]">{children}</div>;
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
        <h2 className="type-title text-[0.9375rem] font-semibold text-ink-50">{title}</h2>
        {hint && <p className="type-body mt-1 text-sm text-ink-400">{hint}</p>}
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
      {hint && <span className="type-body mt-1.5 block text-xs text-ink-500">{hint}</span>}
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
  parse: (raw: string) => number | null;
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
 * Reformatting mid-keystroke ("2" becoming "$2.00" while you reach for the 5")
 * is the fastest way to make a form unusable, so the raw text is held locally
 * and only normalised once focus leaves.
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

/**
 * Segmented control.
 *
 * The selection is one object that travels between positions rather than a
 * highlight that blinks off one item and on to another. Because it is a spring
 * on a shared layout id, tapping mid-flight redirects it from where it actually
 * is instead of restarting.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const count = Math.max(1, options.length);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  return (
    <div
      role="tablist"
      className={`relative flex rounded-control bg-black/30 p-1 outline outline-1 -outline-offset-1 outline-white/[.06] ${className}`}
    >
      {/* One object that travels between positions, rather than a highlight
          blinking off one item and on to the next. */}
      <m.span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-inner bg-felt-500 shadow-[inset_0_1px_0_rgba(255,255,255,.18)]"
        style={{ width: `calc((100% - 0.5rem) / ${count})` }}
        animate={{ x: `${index * 100}%` }}
        transition={reduced ? { duration: 0 } : SPRING.move}
      />
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            role="tab"
            aria-selected={active}
            depth="sm"
            feedback="select"
            onClick={() => onChange(option.value)}
            className="relative z-10 flex-1 rounded-inner px-2 py-2 text-center text-sm font-medium"
          >
            <span
              className={`transition-colors duration-200 ease-standard ${
                active ? 'text-white' : 'text-ink-400'
              }`}
            >
              {option.label}
            </span>
          </Pressable>
        );
      })}
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
  const reduced = useReducedMotion();

  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-ink-100">{label}</span>
        {hint && <span className="type-body mt-1 block text-xs text-ink-400">{hint}</span>}
      </label>
      <Pressable
        id={id}
        role="switch"
        depth="sm"
        feedback="select"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-[26px] w-[46px] shrink-0 rounded-full transition-colors duration-300 ease-standard ${
          checked ? 'bg-felt-500' : 'bg-white/[.09]'
        }`}
      >
        <m.span
          animate={{ x: checked ? 20 : 0 }}
          transition={reduced ? { duration: 0 } : SPRING.move}
          className="absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.5)]"
        />
      </Pressable>
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
    <div className="flex items-center gap-1 rounded-full bg-black/30 p-1 outline outline-1 -outline-offset-1 outline-white/[.06]">
      <Pressable
        depth="sm"
        feedback="select"
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-300 transition-colors duration-200 ease-standard hover:bg-white/[.07] disabled:opacity-30"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Fewer ${label ?? 'items'}`}
      >
        <Icon as={Minus} size={16} />
      </Pressable>
      <span className="num w-8 text-center text-base font-semibold text-ink-50">{value}</span>
      <Pressable
        depth="sm"
        feedback="select"
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-300 transition-colors duration-200 ease-standard hover:bg-white/[.07] disabled:opacity-30"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`More ${label ?? 'items'}`}
      >
        <Icon as={Plus} size={16} />
      </Pressable>
    </div>
  );
}

const NOTICE_STYLE: Record<Notice['level'], { box: string; glyph: typeof Info }> = {
  info: { box: 'bg-felt-500/[.09] text-felt-100 outline-felt-500/25', glyph: Info },
  warn: { box: 'bg-gold-500/[.09] text-gold-300 outline-gold-500/30', glyph: Warning },
  error: { box: 'bg-red-500/[.09] text-red-200 outline-red-500/30', glyph: WarningOctagon },
};

export function Notices({ notices, className = '' }: { notices: Notice[]; className?: string }) {
  const reduced = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {/* Height is the one non-transform property animated in this app: a
          disclosure has to push the content below it, and Motion measures the
          target once rather than on every frame. */}
      {notices.length > 0 && (
        <m.ul
          initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={SPRING.sheet}
          className={`space-y-2 overflow-hidden ${className}`}
        >
          {notices.map((notice, i) => {
            const style = NOTICE_STYLE[notice.level];
            return (
              <li
                key={`${notice.level}-${i}`}
                className={`type-body flex gap-2.5 rounded-control px-3 py-2.5 text-sm outline outline-1 -outline-offset-1 ${style.box}`}
              >
                <span className="mt-px shrink-0">
                  <Icon as={style.glyph} size={17} />
                </span>
                <span>{notice.message}</span>
              </li>
            );
          })}
        </m.ul>
      )}
    </AnimatePresence>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
  mono = false,
  row = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'good' | 'bad' | 'money';
  /** Set for values that are purely a number or an amount. Words stay in Geist. */
  mono?: boolean;
  /** Label beside the value instead of above it, for narrow columns where a
   *  stacked label would have to truncate. */
  row?: boolean;
}) {
  const toneClass =
    tone === 'good'
      ? 'text-felt-300'
      : tone === 'bad'
        ? 'text-red-300'
        : tone === 'money'
          ? 'text-gold-400'
          : 'text-ink-50';
  if (row) {
    return (
      <div className="flex min-w-0 items-baseline justify-between gap-3 rounded-control bg-white/[.025] px-3 py-2 outline outline-1 -outline-offset-1 outline-white/[.045]">
        <span className="type-label min-w-0 truncate text-xs font-medium text-ink-500">{label}</span>
        <span
          className={`type-title shrink-0 whitespace-nowrap text-[0.9375rem] font-semibold tabular-nums ${
            mono ? 'num' : ''
          } ${toneClass}`}
        >
          {value}
        </span>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-control bg-white/[.025] px-3 py-2.5 outline outline-1 -outline-offset-1 outline-white/[.045]">
      <div className="type-label truncate text-xs font-medium text-ink-500">{label}</div>
      <div
        className={`type-title mt-1 truncate text-[1.0625rem] font-semibold tabular-nums ${
          mono ? 'num' : ''
        } ${toneClass}`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-ink-500">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-control px-4 py-8 text-center outline-dashed outline-1 -outline-offset-1 outline-white/[.09]">
      <p className="text-sm font-medium text-ink-300">{title}</p>
      {hint && <p className="type-body mx-auto mt-1.5 max-w-sm text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

/**
 * Two-stage destructive action. Arming in place beats a modal for something
 * this small, and it leaves an obvious way out: do nothing for three seconds.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Sure?',
  className = 'btn-danger',
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: ReactNode;
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
    <Pressable
      depth="sm"
      className={className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          haptic('commit');
          onConfirm();
          return;
        }
        haptic('warn');
        setArmed(true);
        timer.current = window.setTimeout(() => setArmed(false), 3000);
      }}
    >
      {armed ? confirmLabel : children}
    </Pressable>
  );
}

/** Primary action with its trailing glyph seated in a well of its own. */
export function ActionButton({
  children,
  onClick,
  disabled,
  className = '',
  feedback = 'commit',
  glyph = ArrowRight,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  feedback?: 'commit' | 'select';
  glyph?: typeof ArrowRight;
}) {
  return (
    <Pressable
      depth="lg"
      feedback={feedback}
      disabled={disabled}
      onClick={onClick}
      className={`btn-primary group w-full !py-2.5 !pl-5 !pr-2 text-[0.9375rem] ${className}`}
    >
      <span className="flex-1 text-left">{children}</span>
      <span className="btn-slug transition-transform duration-300 ease-standard group-hover:translate-x-0.5">
        <Icon as={glyph} size={16} />
      </span>
    </Pressable>
  );
}

export { CheckCircle };
