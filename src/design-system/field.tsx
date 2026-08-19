import type { ComponentProps, ReactNode } from "react";

import { cx } from "@/design-system/cx";

export const inputClasses =
  "w-full min-w-0 rounded-md border border-line-strong bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-muted transition-colors duration-(--duration-fast) ease-standard hover:border-line-active focus:border-line-active disabled:opacity-50 aria-[invalid=true]:border-critical";

/**
 * Layer 1 — text input.
 *
 * Exported alongside [inputClasses] so a control this does not cover — a
 * `select`, a native date picker — can wear the same box without being
 * reimplemented here first.
 */
export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cx(inputClasses, className)} {...rest} />;
}

/** What a [Field] hands its control when the control is given as a function. */
type ControlProps = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
};

/**
 * Layer 2 — a labelled control with room for help and error text.
 *
 * The label is a real `<label htmlFor>`, and `id` is required rather than
 * generated, because the id is usually also what a form's error summary or an
 * `aria-describedby` elsewhere on the page needs to point at.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  labelHidden,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Keeps the label for screen readers when the design leaves it out. */
  labelHidden?: boolean;
  className?: string;
  /**
   * The control. Given as a function when it needs the wiring — the id to
   * carry and the `aria-describedby` pointing at whichever of the hint or the
   * error is currently on screen.
   */
  children: ReactNode | ((control: ControlProps) => ReactNode);
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className={cx(
          "text-body-sm font-semibold text-ink-strong",
          labelHidden && "sr-only",
        )}
      >
        {label}
        {required ? (
          <span className="text-critical" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
      </label>

      {typeof children === "function"
        ? children({
            id,
            "aria-describedby": describedBy,
            "aria-invalid": error ? true : undefined,
          })
        : children}

      {/* Only one of the two shows: once a field is wrong, the correction is
          the thing to read, and stacking both buries it. */}
      {error ? (
        <p id={`${id}-error`} className="text-caption text-critical" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-ink-subdued">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
