"use client";

import { useId, useState } from "react";

import { cx } from "@/design-system/cx";

const SIZES = {
  sm: { box: "h-8", button: "w-8", field: "w-10 text-body-sm", icon: "size-3" },
  md: { box: "h-11", button: "w-11", field: "w-12 text-body", icon: "size-3.5" },
} as const;

export type QuantityStepperSize = keyof typeof SIZES;

/**
 * Layer 1 — quantity control.
 *
 * A typed field between two steppers, rather than `<input type="number">`.
 * Three reasons, all of them things the native control gets wrong here:
 *
 *  * Its spinners are a few pixels tall and unusable on a phone, which is where
 *    most of this shop's traffic is.
 *  * It reports an empty string for anything it cannot parse, so code that
 *    reads it has no way to tell "the shopper is mid-edit" from "the shopper
 *    typed nonsense" — the old cart guessed, and guessed wrong: clearing the
 *    field to retype left the previous quantity in place.
 *  * A scroll over a focused number input silently changes it, which on a cart
 *    page means a shopper scrolls past their basket and buys eleven.
 *
 * The draft is held as a string so the box can legitimately be empty while
 * someone is retyping. Nothing is committed until it parses; blurring an empty
 * or unparseable box restores the last good value rather than deleting the line,
 * because removing something is what the Remove control is for.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  size = "md",
  disabled,
  label = "Quantity",
  className,
}: {
  value: number;
  onChange: (quantity: number) => void;
  min?: number;
  max?: number;
  size?: QuantityStepperSize;
  disabled?: boolean;
  /** Announced for the group and the field — name the product where you can. */
  label?: string;
  className?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const sizing = SIZES[size];

  // Follows the value when it changes from outside — another tab editing the
  // same cart, or a quote coming back with a quantity the shop capped.
  //
  // Adjusted during render against the last value seen rather than in an
  // effect: an effect would paint the stale number first and correct it a frame
  // later, and syncing on every render (rather than only when `value` actually
  // moved) would fight the shopper as they type.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

  const clamp = (next: number) => Math.min(Math.max(next, min), max);

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = clamp(parsed);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  const step = (delta: number) => {
    const next = clamp(value + delta);
    if (next !== value) onChange(next);
    setDraft(String(next));
  };

  return (
    <div
      // A group rather than three unrelated controls, so a screen reader
      // announces "Quantity, 3" instead of reading a bare number between two
      // buttons called minus and plus.
      role="group"
      aria-label={label}
      className={cx(
        "inline-flex items-stretch overflow-hidden rounded-md border border-line-strong bg-surface",
        sizing.box,
        disabled && "opacity-50",
        className,
      )}
    >
      <StepButton
        label={`Decrease ${label.toLowerCase()}`}
        onClick={() => step(-1)}
        disabled={disabled || value <= min}
        sizing={sizing}
      >
        <path d="M5 12h14" />
      </StepButton>

      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={draft}
        disabled={disabled}
        onChange={(event) => {
          // Digits only, and the empty string. Filtering here rather than on
          // commit means a stray letter never appears at all, so the box does
          // not flicker between what was typed and what was kept.
          const next = event.target.value.replace(/[^0-9]/g, "");
          setDraft(next);
        }}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(draft);
          }
          // Arrows step, matching what the native control did and what anyone
          // who has used one expects.
          if (event.key === "ArrowUp") {
            event.preventDefault();
            step(1);
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            step(-1);
          }
        }}
        className={cx(
          "min-w-0 border-x border-line bg-transparent text-center font-semibold text-ink-strong tabular-nums",
          "focus:outline-none",
          sizing.field,
        )}
      />

      <StepButton
        label={`Increase ${label.toLowerCase()}`}
        onClick={() => step(1)}
        disabled={disabled || value >= max}
        sizing={sizing}
      >
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </StepButton>
    </div>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  sizing,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  sizing: (typeof SIZES)[QuantityStepperSize];
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // The glyph is a shape, not a character; the button's name comes from
      // here so "−" is never read out as "minus sign" on its own.
      aria-label={label}
      className={cx(
        "flex shrink-0 items-center justify-center text-ink-subdued",
        "transition-colors duration-(--duration-fast) ease-standard",
        "hover:bg-surface-subdued hover:text-ink-strong",
        "disabled:pointer-events-none disabled:text-ink-disabled",
        sizing.button,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={sizing.icon}
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}
