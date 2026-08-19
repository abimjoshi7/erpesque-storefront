import { cx } from "@/design-system/cx";

/**
 * Layer 2 — loading placeholder.
 *
 * Always `aria-hidden`: a screen reader gains nothing from being read a row of
 * grey boxes, and the `loading.tsx` around it is what announces the wait.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx("animate-pulse rounded-sm bg-surface-subdued", className)}
    />
  );
}
