/**
 * Joins class names, dropping anything falsy.
 *
 * Deliberately not `clsx` or `cva`: the whole design system needs exactly this
 * much, and a dependency in a storefront that deploys to Workers is a
 * dependency to keep working forever.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
