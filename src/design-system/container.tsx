import type { ElementType, ReactNode } from "react";

import { cx } from "@/design-system/cx";

/**
 * The shop's one content width.
 *
 * Every page centred its own `max-w-6xl px-6` before this existed, which is
 * fine until one of them says `max-w-5xl` and the header stops lining up with
 * the catalog beneath it.
 */
export function Container({
  as,
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  const Component = as ?? "div";
  return (
    <Component
      className={cx("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}
    >
      {children}
    </Component>
  );
}
