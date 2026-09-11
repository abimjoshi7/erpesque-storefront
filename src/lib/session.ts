import "server-only";

import { cookies } from "next/headers";

/**
 * The buyer's session cookie: reading it, writing it, clearing it, and the one
 * place its attributes are decided.
 *
 * The cookie's value *is* the ERP's session token. This app stores nothing and
 * looks nothing up — it relays. That is what keeps decision 0002's rule intact:
 * buyer login adds no database here, and a shopper's session survives a deploy
 * because it never lived in this process to begin with.
 *
 * `server-only` for the same reason `lib/erp.ts` carries it. A client component
 * that imported this would be asking for a session token in the browser bundle,
 * and the token is the credential.
 */

/**
 * Scoped per tenant, mirroring the `KEY_PREFIX` in `lib/cart.ts`. Two shops
 * open in one browser must not see each other's session, and since `Path` is
 * the whole origin (see below), the name is what keeps them apart.
 */
export function sessionCookieName(tenant: string): string {
  return `sf_session_${tenant}`;
}

/**
 * Thirty days, matching the idle window the ERP shipped (under a ninety-day
 * absolute cap that the ERP enforces on its own). The cookie expiring before the
 * session does would sign a shopper out while the server still held a live
 * session; the reverse leaves a cookie that fails once and is then cleared.
 * Neither is harmful, but they should agree, and this is the value to change if
 * the ERP's window moves.
 *
 * The cookie's `Max-Age` is only refreshed when it is written, at sign-in,
 * while the ERP slides its window on every authenticated request. A shopper
 * who keeps browsing therefore outlives the cookie rather than the other way
 * round, and meets the sign-in page thirty days after they last signed in.
 * That is the harmless direction, and it is now the only mismatch left.
 */
const IDLE_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * `Secure` is conditional because development runs on `http://localhost:3001`,
 * where a Secure cookie is simply dropped and the sign-in appears to succeed
 * and then do nothing. Everywhere else it is on.
 */
const secure = process.env.NODE_ENV === "production";

/**
 * `Path=/`, and the tenant lives in the cookie's name instead.
 *
 * The first cut scoped `Path` to `/{tenant}`, so that a request to another
 * shop's pages would not carry this shop's token. It also meant the browser
 * never sent the cookie to `/api/{tenant}/…`, which is where every route
 * handler lives — `/api/nsbs/me` does not sit beneath `/nsbs` — so the header
 * always read "Sign in", sign-out never revoked anything at the ERP, and an
 * order could not carry a session at all. Pages under `/{tenant}` saw the
 * cookie, which is why the account page worked and hid the fault.
 *
 * Nothing is lost by widening it. Two shops open in one browser still cannot
 * see each other's session, because the name differs per tenant. And the path
 * was always hygiene rather than the boundary: the ERP binds every session
 * lookup to the tenant it resolved from the URL, so a token from one shop
 * presented to another simply misses.
 */
function cookieOptions() {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
}

/** The shopper's session token, or undefined when they are not signed in. */
export async function readSession(tenant: string): Promise<string | undefined> {
  const store = await cookies();
  return store.get(sessionCookieName(tenant))?.value;
}

/**
 * Only ever called from the verify-code route handler. Cookies cannot be
 * written during server component render — HTTP does not allow a `Set-Cookie`
 * after streaming has started — so this belongs to a route handler or a server
 * function and nowhere else.
 */
export async function setSession(tenant: string, token: string): Promise<void> {
  const store = await cookies();
  store.set(sessionCookieName(tenant), token, {
    ...cookieOptions(),
    maxAge: IDLE_TTL_SECONDS,
  });
}

/**
 * Cleared by expiring it rather than by `delete`, because the attributes have
 * to match the ones it was written with for the browser to accept the
 * instruction, and writing them out once here is harder to get wrong than
 * remembering that `delete` needs the same path.
 */
export async function clearSession(tenant: string): Promise<void> {
  const store = await cookies();
  store.set(sessionCookieName(tenant), "", {
    ...cookieOptions(),
    maxAge: 0,
  });
}
