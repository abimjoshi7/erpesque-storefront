import { cx } from "@/design-system/cx";

/**
 * Layer 1 — indeterminate progress.
 *
 * `currentColor`, so it takes the tone of whatever it sits inside — a button
 * label's color while a form submits, the ink scale on a page.
 */
export function Spinner({
  className,
  label = "Loading",
}: {
  className?: string;
  /** Announced to screen readers. Pass `""` when a neighbour already says it. */
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cx(
        "inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
