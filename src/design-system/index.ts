/**
 * The ERPesque design system, web edition.
 *
 * The token layer lives in `src/app/globals.css`; this is the component layer
 * built on top of it. Everything a page renders should come from here or be
 * assembled from these — a raw `bg-neutral-200` in a page is a token that
 * escaped, and it will be the one thing that does not follow the theme.
 */
export { Breadcrumbs } from "@/design-system/breadcrumbs";
export type { Crumb } from "@/design-system/breadcrumbs";
export { Button, ButtonLink } from "@/design-system/button";
export type { ButtonSize, ButtonVariant } from "@/design-system/button";
export { Card } from "@/design-system/card";
export type { CardElevation } from "@/design-system/card";
export { Container } from "@/design-system/container";
export { cx } from "@/design-system/cx";
export { EmptyState } from "@/design-system/empty-state";
export { Field, Input, inputClasses } from "@/design-system/field";
export { Icon } from "@/design-system/icon";
export type { IconName } from "@/design-system/icon";
export { Notice } from "@/design-system/notice";
export { QuantityStepper } from "@/design-system/quantity-stepper";
export type { QuantityStepperSize } from "@/design-system/quantity-stepper";
export type { NoticeTone } from "@/design-system/notice";
export { Skeleton } from "@/design-system/skeleton";
export { Spinner } from "@/design-system/spinner";
export { StatusPill } from "@/design-system/status-pill";
export type { StatusTone } from "@/design-system/status-pill";
export { Text } from "@/design-system/text";
export type { TextTone, TextVariant } from "@/design-system/text";
