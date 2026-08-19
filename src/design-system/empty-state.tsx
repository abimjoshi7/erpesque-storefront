import type { ReactNode } from "react";

import { cx } from "@/design-system/cx";
import { Text } from "@/design-system/text";

/**
 * Layer 2 — the "there is nothing here" state.
 *
 * A port of `DSEmptyState`. The `action` slot is what separates a dead end
 * from a recoverable one: a search with no results should always offer the way
 * back to the full catalog rather than leaving the shopper to edit the URL.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <div className="text-ink-disabled">{icon}</div> : null}
      <Text as="h2" variant="headlineMedium">
        {title}
      </Text>
      {description ? (
        <Text variant="bodyMedium" tone="subdued" className="max-w-prose">
          {description}
        </Text>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
