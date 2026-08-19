import { cx } from "@/design-system/cx";

/** Semantic tones — a port of `DSStatusTone`. */
const TONES = {
  neutral: "bg-surface-subdued text-ink-subdued",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  critical: "bg-critical-soft text-critical",
  active: "bg-active-soft text-active",
} as const;

export type StatusTone = keyof typeof TONES;

/**
 * Layer 2 — status pill.
 *
 * A subdued fill with matching text, and a dot that carries the same meaning
 * without relying on the fill: at these tints the difference between "warning"
 * and "success" is a hue shift a colorblind shopper may not get, so the word
 * inside the pill is always the real signal and the color only reinforces it.
 */
export function StatusPill({
  tone = "neutral",
  dot = true,
  className,
  children,
}: {
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}
