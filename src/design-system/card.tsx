import type { ReactNode } from "react";

import { cx } from "@/design-system/cx";

/** Elevation levels — a port of `DSCardElevation`. */
const ELEVATION = {
  none: "",
  sm: "shadow-xs",
  md: "shadow-md",
  lg: "shadow-lg",
} as const;

export type CardElevation = keyof typeof ELEVATION;

/**
 * Layer 2 — surface container.
 *
 * The `header` slot is a slot rather than a `title` string because half the
 * headers in a shop carry a control on the right, and a component that only
 * takes text forces every one of those back out into a hand-rolled div.
 *
 * Pass `padding={false}` when the content is a table or a list that should
 * meet the card's edges.
 */
export function Card({
  header,
  padding = true,
  elevation = "sm",
  className,
  children,
}: {
  header?: ReactNode;
  padding?: boolean;
  elevation?: CardElevation;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-lg border border-line bg-surface",
        ELEVATION[elevation],
        className,
      )}
    >
      {header ? (
        <div className="border-b border-line px-4 py-3">{header}</div>
      ) : null}
      <div className={cx(padding && "p-4")}>{children}</div>
    </div>
  );
}
