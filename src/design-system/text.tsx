import type { ElementType, ReactNode } from "react";

import { cx } from "@/design-system/cx";

/**
 * The type scale, by name — a port of `DSTextStyle`.
 *
 * Each entry pairs a size token from `globals.css` with the weight the Flutter
 * scale gives it, so `variant="title"` reads the same on both platforms.
 */
const VARIANTS = {
  displayLarge: "text-h1 font-bold text-ink-strong",
  displayMedium: "text-h2 font-bold text-ink-strong",
  headlineLarge: "text-h3 font-bold text-ink-strong",
  headlineMedium: "text-h4 font-semibold text-ink-strong",
  headlineSmall: "text-title font-semibold text-ink-strong",
  titleLarge: "text-title font-semibold",
  titleMedium: "text-body font-medium",
  titleSmall: "text-body-sm font-medium",
  bodyLarge: "text-body-lg",
  bodyMedium: "text-body",
  bodySmall: "text-body-sm",
  labelLarge: "text-title font-semibold",
  labelMedium: "text-body-sm font-semibold",
  labelSmall: "text-label font-semibold",
  caption: "text-caption font-medium",
} as const;

export type TextVariant = keyof typeof VARIANTS;

/** The ink scale, by meaning. `null` leaves the inherited color alone. */
const TONES = {
  strong: "text-ink-strong",
  default: "text-ink",
  subdued: "text-ink-subdued",
  muted: "text-ink-muted",
  disabled: "text-ink-disabled",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  critical: "text-critical",
  inherit: "",
} as const;

export type TextTone = keyof typeof TONES;

/**
 * Layer 1 — text primitive.
 *
 * The element and the style are separate props on purpose: a card heading is
 * an `h2` for a screen reader whatever size the design gives it, and a page
 * that picks its heading level from a font size ends up with an outline no
 * assistive technology can follow.
 */
export function Text({
  as,
  variant = "bodyMedium",
  tone = "inherit",
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  variant?: TextVariant;
  tone?: TextTone;
  className?: string;
  children?: ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "color">) {
  const Component = as ?? "p";
  return (
    <Component className={cx(VARIANTS[variant], TONES[tone], className)} {...rest}>
      {children}
    </Component>
  );
}
