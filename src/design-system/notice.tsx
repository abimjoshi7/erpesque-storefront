import type { ReactNode } from "react";

import { cx } from "@/design-system/cx";

const TONES = {
  neutral: "border-line bg-surface-subdued text-ink-subdued",
  info: "border-info/30 bg-info-soft text-info",
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  critical: "border-critical/30 bg-critical-soft text-critical",
} as const;

export type NoticeTone = keyof typeof TONES;

/**
 * Layer 2 — an inline message about the page the shopper is on.
 *
 * `role="alert"` only for the critical tone: a screen reader interrupting to
 * read a neutral "payment is on delivery" note is noise, where a failed
 * checkout genuinely needs to jump the queue.
 */
export function Notice({
  tone = "neutral",
  dashed,
  className,
  children,
}: {
  tone?: NoticeTone;
  /** A dashed edge reads as "nothing here yet" rather than "something is wrong". */
  dashed?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "critical" ? "alert" : undefined}
      className={cx(
        "rounded-md border p-4 text-body-sm",
        dashed ? "border-dashed" : "",
        TONES[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}
