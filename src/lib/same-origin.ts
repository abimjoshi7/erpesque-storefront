/**
 * The cross-site request forgery check that this app did not need until it set
 * a cookie.
 *
 * Before buyer login there was no ambient credential here: every mutation
 * carried everything it needed in its body or its path, so a form on another
 * origin could post to `/api/{tenant}/order` and achieve nothing a shopper had
 * not already given it. A session cookie changes that — the browser attaches it
 * to a cross-site POST whether or not the shopper meant to send one.
 *
 * `SameSite=Lax` on the cookie is the first layer and stops the common case,
 * but it treats every subdomain of the site as the same site, so it is not on
 * its own an answer. This is the second layer.
 *
 * Next performs exactly this comparison for Server Actions on its own. It does
 * not for route handlers, and every mutation in this app is a route handler, so
 * it is written out here and called explicitly.
 */

/**
 * True when the request came from this same site.
 *
 * A missing `Origin` is treated as same-origin. Browsers send it on every
 * cross-origin request and on every POST, so its absence means a caller that is
 * not a browser — curl, a health check, a server-to-server call — and those are
 * not the thing this defends against: forgery needs a browser holding the
 * shopper's cookie. Rejecting them instead would break non-browser callers to
 * stop an attack that cannot be mounted without one.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  // `X-Forwarded-Host` is what survives the Cloudflare hop; `Host` is what
  // arrives when nothing is in front. Preferring the forwarded one matches how
  // Next itself resolves this for Server Actions.
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    // An `Origin` that will not parse is not one a browser sent.
    return false;
  }
}

/**
 * The response to send when it is not. A bare 403 with no detail: a forged
 * request's author is the only one who will ever see this, and there is nothing
 * to tell them.
 */
export function forbiddenResponse(): Response {
  return Response.json({ error: "Request rejected." }, { status: 403 });
}
