import { cx } from "@/design-system";

/**
 * The shop's name as a mark: a monogram tile and the name beside it.
 *
 * The ERP holds no logo for a shop, so the monogram stands in for one — built
 * from the name the merchant already chose, rather than a stock glyph that
 * would make every shop on the platform wear the same badge.
 *
 * `Array.from` rather than `charAt(0)`, so a name that opens with a character
 * outside the basic plane is not cut in half.
 */
export function ShopWordmark({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initial = (Array.from(name.trim())[0] ?? "").toUpperCase();

  return (
    <span className={cx("flex min-w-0 items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[image:var(--primary-sheen)] text-h4 font-bold text-on-primary shadow-xs"
      >
        {initial}
      </span>
      <span className="truncate text-h3 font-bold tracking-tight text-ink-strong">
        {name}
      </span>
    </span>
  );
}
