import Link from "next/link";

import { cx } from "@/design-system/cx";
import { Icon } from "@/design-system/icon";

export type Crumb = {
  label: string;
  /** Leave out for the page the shopper is on — it is not a link to itself. */
  href?: string;
};

/**
 * Layer 2 — the trail back up the shop.
 *
 * Real links, not decoration: a category a product sits in is a page of the
 * shop, and a shopper who liked the thing wants the shelf it came off.
 *
 * The separators are drawn, not typed, and hidden from assistive technology —
 * the ordered list already says "one of three", and a screen reader reading
 * out "slash" between every crumb helps nobody.
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cx("text-body-sm text-ink-subdued", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${index}-${item.label}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <Icon name="chevron-right" className="size-3.5 text-ink-disabled" />
              ) : null}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="truncate transition-colors duration-(--duration-fast) ease-standard hover:text-ink-strong hover:underline hover:underline-offset-4"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={cx("truncate", last && "font-medium text-ink-strong")}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
