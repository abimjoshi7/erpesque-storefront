import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cx } from "@/design-system/cx";
import { Spinner } from "@/design-system/spinner";

/**
 * Button variants — a port of `DSButtonVariant`.
 *
 *   primary     gold-biscuit fill, dark ink
 *   secondary   surface fill, strong border
 *   tertiary    ghost — no fill, no border
 *   accent      brand-yellow fill
 *   destructive red fill, white ink
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "accent"
  | "destructive";

export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  // The sheen is a gradient token rather than a flat `bg-primary`: gold at
  // button size reads dull when flat, and the Flutter button paints the same
  // highlight-to-shadow sweep.
  primary:
    "bg-[image:var(--primary-sheen)] text-on-primary shadow-sm hover:brightness-105 active:brightness-95",
  secondary:
    "bg-secondary text-ink-strong border border-line-strong shadow-xs hover:bg-secondary-pressed",
  tertiary: "text-ink hover:bg-surface-subdued",
  accent: "bg-accent text-accent-fg shadow-sm hover:brightness-105 active:brightness-95",
  destructive:
    "bg-critical-solid text-on-critical shadow-sm hover:brightness-110 active:brightness-95",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-8 gap-1.5 rounded-sm px-3 py-1.5 text-body-sm font-semibold",
  // 44px minimum, the same touch target the Flutter button enforces.
  md: "min-h-11 gap-2 rounded-md px-5 py-2.5 text-title font-semibold",
  // The one control a page is built around — add to cart, place order.
  lg: "min-h-12 gap-2 rounded-md px-7 py-3 text-body-lg font-semibold",
};

const BASE =
  "inline-flex items-center justify-center whitespace-nowrap transition-[background,filter,color] duration-(--duration-fast) ease-standard disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

function classes({
  variant = "primary",
  size = "md",
  block,
  iconOnly,
  className,
}: ButtonLook & { className?: string }) {
  return cx(
    BASE,
    VARIANTS[variant],
    SIZES[size],
    block && "w-full",
    // Square when there is no label to give the box its width.
    iconOnly && (size === "sm" ? "w-8 px-0" : size === "lg" ? "w-12 px-0" : "w-11 px-0"),
    className,
  );
}

type ButtonLook = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Fills the width of its container — the mobile add-to-cart shape. */
  block?: boolean;
  iconOnly?: boolean;
};

/**
 * Layer 1 — button primitive.
 *
 * While `loading`, the label is swapped for a size-matched spinner and the
 * button keeps its width, so a row of controls does not reflow mid-submit.
 */
export function Button({
  variant,
  size = "md",
  block,
  iconOnly,
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonLook & {
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
} & ComponentProps<"button">) {
  return (
    <button
      // Explicit rather than inherited: a button inside a form defaults to
      // `submit`, which has surprised every codebase at least once.
      type="button"
      disabled={disabled || loading}
      className={classes({ variant, size, block, iconOnly, className })}
      {...rest}
    >
      {loading ? (
        <Spinner className={size === "sm" ? "size-3.5" : "size-4"} label="" />
      ) : (
        icon
      )}
      {iconOnly ? null : children}
    </button>
  );
}

/**
 * A link wearing the button's clothes.
 *
 * Separate from [Button] rather than an `as` prop because the two disagree on
 * everything that matters: a link navigates, cannot be disabled, and must stay
 * an `<a>` for middle-click and "open in new tab" to work.
 */
export function ButtonLink({
  variant,
  size,
  block,
  iconOnly,
  className,
  children,
  ...rest
}: ButtonLook & ComponentProps<typeof Link>) {
  return (
    <Link className={classes({ variant, size, block, iconOnly, className })} {...rest}>
      {children}
    </Link>
  );
}
