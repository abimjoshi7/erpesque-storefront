/**
 * Where to send a shopper once they have signed in.
 *
 * The sign-in page takes `?next=` so that a shopper sent there from the cart
 * or a product page lands back where they were. Any redirect parameter is an
 * open-redirect waiting to happen: a link to this shop's own sign-in page that
 * forwards a freshly signed-in buyer to a look-alike shop elsewhere is exactly
 * the phishing a one-time-code login invites, because the shopper has just been
 * taught to trust the page.
 *
 * So the answer is never "is this value bad" but "is this value one of ours".
 * It must be a path on this shop — `/{tenant}` or something beneath it — and
 * anything that is not provably that falls back to the account page. The value
 * is resolved with the WHATWG URL parser, the same one the browser will use,
 * rather than inspected as a string, so that `..` segments, `%2e%2e` and
 * friends are normalised before the prefix is checked and not after.
 *
 * Pure and dependency-free, so both the server page and the client form can
 * call it and cannot disagree.
 */

/** Only used to give relative paths something to resolve against. */
const PROBE_ORIGIN = "http://next.invalid";

/** Long enough for any real path in this app; short enough to not be a payload. */
const MAX_LENGTH = 512;

export function safeNext(tenant: string, value: unknown): string {
  const base = `/${tenant}`;
  const fallback = `${base}/account`;

  if (typeof value !== "string" || !value || value.length > MAX_LENGTH) return fallback;

  // A path, and only a path. `//host` is protocol-relative and `/\host` is read
  // as the same thing by browsers that treat a backslash as a slash; control
  // characters are stripped by the URL parser, which could join two harmless
  // halves into a harmful whole. None of these appear in a path this app makes.
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PROBE_ORIGIN) return fallback;

  // An encoded slash or backslash survives parsing as `%2F` / `%5C` and could be
  // decoded by something downstream into a different path from the one checked
  // here. No route in this app has one, so refusing them costs nothing.
  if (/%2f|%5c/i.test(url.pathname)) return fallback;

  const path = url.pathname;
  if (path !== base && !path.startsWith(`${base}/`)) return fallback;

  // Back to the sign-in page would be a loop: signed in, sent to sign in, which
  // sends a signed-in shopper on to `next`, which is the sign-in page.
  if (path === `${base}/sign-in` || path.startsWith(`${base}/sign-in/`)) return fallback;

  return `${path}${url.search}${url.hash}`;
}

/** The sign-in page, primed to come back to `path` afterwards. */
export function signInHref(tenant: string, path: string): string {
  return `/${tenant}/sign-in?next=${encodeURIComponent(path)}`;
}

/**
 * The shop listing with the payment rail open.
 *
 * The cart route redirects here, and the header's cart control points here, so
 * checkout is the same screen as the products.
 */
export function checkoutHref(tenant: string): string {
  return `/${encodeURIComponent(tenant)}?checkout=1`;
}
