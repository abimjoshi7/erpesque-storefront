"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

import { cx, Icon } from "@/design-system";
import type { ShortcutLink } from "@/components/shop-shortcuts";

/**
 * One shelf in the categories menu. The href is built on the server by
 * `listingHref` and handed down, because `catalog-url` reaches into the
 * server-only ERP module and cannot be imported here.
 */
export type CategoryLink = { value: string; href: string; productCount: number };

/** What the current page is, as far as the nav row can mark it. */
type Marked = {
  /** The selected category's value, or undefined when no shelf is on screen. */
  category?: string;
  /** Whether the page is the plain, unfiltered listing. */
  all?: boolean;
  /** The href of the shortcut whose exact listing is on screen. */
  shortcut?: string;
};

/**
 * The row under the header: one menu holding every shelf, then the shortcuts.
 *
 * The shelves used to be a row of their own, all fourteen, repeated on every
 * page — and repeated again by the listing's sidebar and the footer. One menu
 * keeps every shelf a click away without spending a band of every page on
 * them, and frees the row for ways in that no other part of the page offers.
 *
 * A client island only to read the query string, for the same reason the
 * search box is one: the layout this sits in is not given the search params,
 * and reading them on the server would make every page under `/{tenant}`
 * render per request. The shop header wraps this in a Suspense boundary whose
 * fallback is [ShopNavView] with nothing marked — the same links, so the row is
 * complete wherever the page is prerendered and only gains its marks here.
 *
 * Only the plain category listing counts as "on" a shelf. A search or a brand
 * inside one is a narrower page than the shelf, and marking the shelf there
 * would claim the shopper is looking at all of it. A shortcut is marked only
 * when the page is exactly its listing, give or take the page number, for the
 * same reason.
 */
export function ShopNav({
  tenant,
  allHref,
  categories,
  shortcuts,
}: {
  tenant: string;
  allHref: string;
  categories: CategoryLink[];
  shortcuts: ShortcutLink[];
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  const onListing =
    pathname === `/${tenant}` || pathname === `/${encodeURIComponent(tenant)}`;

  const current = new URLSearchParams(params);
  current.delete("page");

  const marked: Marked = onListing
    ? {
        category:
          !params.get("q") && !params.get("brand")
            ? (params.get("category") ?? undefined)
            : undefined,
        all: current.size === 0,
        shortcut: shortcuts.find((shortcut) => sameQuery(queryOf(shortcut.href), current))
          ?.href,
      }
    : {};

  return (
    <ShopNavView
      allHref={allHref}
      categories={categories}
      shortcuts={shortcuts}
      marked={marked}
      routeKey={`${pathname}?${params.toString()}`}
    />
  );
}

/**
 * The row itself, with no reading of the URL, so it can also be the
 * server-rendered fallback.
 */
export function ShopNavView({
  allHref,
  categories,
  shortcuts,
  marked = {},
  routeKey,
}: {
  allHref: string;
  categories: CategoryLink[];
  shortcuts: ShortcutLink[];
  marked?: Marked;
  /** Changes on every navigation; the menu closes when it does. */
  routeKey?: string;
}) {
  return (
    <nav aria-label="Shop" className="flex items-center">
      {categories.length > 0 ? (
        <>
          <CategoryMenu
            allHref={allHref}
            categories={categories}
            marked={marked}
            routeKey={routeKey}
          />
          <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-line sm:mx-2" />
        </>
      ) : null}

      {/* Only the shortcuts scroll, and the menu sits outside them: a scroll
          container clips whatever overflows it, and the menu's panel has to
          hang below the row. On a desktop there is room for all three; on a
          phone the fade on the right edge says there is more to swipe to. */}
      <ul className="flex min-w-0 flex-1 overflow-x-auto pr-8 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] [scrollbar-width:none]">
        {shortcuts.map((shortcut) => (
          <li key={shortcut.href} className="shrink-0">
            <Link
              href={shortcut.href}
              aria-current={marked.shortcut === shortcut.href ? "page" : undefined}
              className={cx(
                TAB,
                marked.shortcut === shortcut.href
                  ? "border-primary font-semibold text-ink-strong"
                  : "border-transparent text-ink-subdued hover:text-ink-strong",
              )}
            >
              <Icon name={shortcut.icon} className="hidden size-4 sm:block" />
              {shortcut.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const TAB =
  "inline-flex h-11 items-center gap-1.5 border-b-2 px-2 text-body-sm whitespace-nowrap transition-colors duration-(--duration-fast) ease-standard sm:px-3";

/**
 * Every shelf, behind one button.
 *
 * A `<details>` rather than a scripted popover, so the menu opens and every
 * link in it works before hydration and without JavaScript at all. The script
 * here only tidies up after it: a click elsewhere, Escape, or a navigation
 * closes it, which a bare `<details>` would leave open.
 *
 * The button names the shelf the shopper is on, so the row still says where
 * they are now that the shelves are not all on show.
 */
function CategoryMenu({
  allHref,
  categories,
  marked,
  routeKey,
}: {
  allHref: string;
  categories: CategoryLink[];
  marked: Marked;
  routeKey?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  // A navigation closes the menu. Clicking a shelf changes the route, and a
  // menu still open over the page it led to would hide the very listing the
  // shopper just asked for.
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [routeKey]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const menu = ref.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const menu = ref.current;
      if (event.key !== "Escape" || !menu?.open) return;
      menu.open = false;
      // Back to the button that opened it, so a keyboard user is not left
      // focused on a link that has just disappeared.
      menu.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // A link to the page already on screen changes no route, so it closes the
  // menu itself.
  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as Element).closest("a") && ref.current) ref.current.open = false;
  };

  const active = marked.category
    ? categories.find(
        (category) => category.value.toLowerCase() === marked.category!.toLowerCase(),
      )
    : undefined;

  return (
    <details ref={ref} className="group relative shrink-0">
      <summary
        className={cx(
          TAB,
          "cursor-pointer list-none font-semibold text-ink-strong [&::-webkit-details-marker]:hidden",
          active ? "border-primary" : "border-transparent",
        )}
      >
        {active ? (
          <>
            {/* The word stays for screen readers on a phone, where the shelf's
                name alone has to fit the button. */}
            <span className="sr-only sm:not-sr-only">Categories:</span>
            <span className="max-w-[7.5rem] truncate sm:max-w-[12rem]">{active.value}</span>
          </>
        ) : (
          "Categories"
        )}
        <Icon
          name="chevron-down"
          className="size-4 text-ink-muted transition-transform duration-(--duration-fast) ease-standard group-open:rotate-180"
        />
      </summary>

      <div
        onClick={closeOnLink}
        className="absolute top-full left-0 z-30 mt-px w-[min(36rem,calc(100vw-2rem))] rounded-b-lg rounded-tr-lg border border-line bg-surface-elevated p-2 shadow-lg"
      >
        {/* Columns rather than a grid, so the shelves read down and then
            across, in the order the ERP sorts them. The scrolling box wraps
            the list instead of being it: a height-capped multi-column box
            grows extra columns sideways rather than scrolling. */}
        <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
          <ul className="sm:columns-2 sm:gap-2 [&>li]:mb-0.5 [&>li]:break-inside-avoid">
            <MenuItem href={allHref} selected={Boolean(marked.all)}>
              All products
            </MenuItem>
            {categories.map((category) => (
              <MenuItem
                key={category.value}
                href={category.href}
                selected={category === active}
                count={category.productCount}
              >
                {category.value}
              </MenuItem>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

function MenuItem({
  href,
  selected,
  count,
  children,
}: {
  href: string;
  selected: boolean;
  count?: number;
  children: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={selected ? "page" : undefined}
        className={cx(
          "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-body-sm transition-colors duration-(--duration-fast) ease-standard",
          selected
            ? "bg-accent-soft font-semibold text-ink-strong"
            : "text-ink hover:bg-surface-subdued hover:text-ink-strong",
        )}
      >
        <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
        {count !== undefined ? (
          <span className="shrink-0 text-caption text-ink-muted tabular-nums">{count}</span>
        ) : null}
      </Link>
    </li>
  );
}

function queryOf(href: string): URLSearchParams {
  return new URLSearchParams(href.split("?")[1] ?? "");
}

/** Same keys, same values, in any order. */
function sameQuery(a: URLSearchParams, b: URLSearchParams): boolean {
  const flatten = (query: URLSearchParams) =>
    [...query.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join("&");
  return flatten(a) === flatten(b);
}
