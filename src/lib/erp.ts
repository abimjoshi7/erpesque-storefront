import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { components } from "@/types/erp-api";

/**
 * Read-only client for the ERP's public storefront endpoints.
 *
 * `server-only` is not decoration. This module reads an API key from the
 * environment, and importing it from a client component would make Next inline
 * that key into the browser bundle. The import above turns that mistake into a
 * build error instead of a leaked credential.
 *
 * Every call therefore happens in a server component or route handler; the
 * browser never talks to the ERP directly, which is also why there is no CORS
 * configuration anywhere in this project.
 */

export type Tenant = components["schemas"]["StorefrontTenant"];
export type Product = components["schemas"]["StorefrontProduct"];

export type Catalog = {
  tenant: Tenant;
  products: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/**
 * The orderings the ERP catalog accepts, in the order a sort menu should list
 * them. `featured` is the merchant's own merchandising weight and the default.
 */
export const CATALOG_SORTS = [
  "featured",
  "newest",
  "price_asc",
  "price_desc",
  "name_asc",
  "name_desc",
] as const;

export type CatalogSort = (typeof CATALOG_SORTS)[number];

/**
 * Narrows whatever arrived in the URL to a sort the ERP knows.
 *
 * A bad value is dropped rather than passed through: the ERP would fall back to
 * `featured` anyway, and letting the raw string reach the query string would
 * put an un-normalised URL in the canonical link.
 */
export function parseSort(value: string | undefined): CatalogSort | undefined {
  return CATALOG_SORTS.includes(value as CatalogSort)
    ? (value as CatalogSort)
    : undefined;
}

export type CatalogQuery = {
  q?: string;
  category?: string;
  brand?: string;
  page?: number;
  limit?: number;
  sort?: CatalogSort;
  /**
   * Inclusive bounds in minor units, matching `priceMinor` on the product. The
   * conversion from what a shopper typed happens in `money.majorToMinor`, so
   * nothing below this line ever sees a major-unit figure.
   */
  minPrice?: number;
  maxPrice?: number;
  /** Hide what the shop holds none of. Non-stock-tracked items stay visible. */
  inStock?: boolean;
};

export type Facet = components["schemas"]["StorefrontFacet"];

export type Facets = {
  tenant: Tenant;
  categories: Facet[];
  brands: Facet[];
};

export type Quote = {
  tenant: Tenant;
  lines: QuoteLine[];
  /**
   * Null when the shop does not charge for delivery. Deliberately not a line:
   * the cart renders from `lines`, and a delivery entry there would look like
   * something the shopper can change the quantity of or remove.
   */
  delivery: Delivery | null;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxInclusivePricing?: boolean;
};

export type Delivery = {
  title: string;
  /** What delivery adds to `totalMinor`. Zero when this basket earned it free. */
  amountMinor: number;
  /**
   * The shop charges for delivery, but this basket cleared the threshold.
   * Distinguishes "free" from "not offered", which `amountMinor: 0` cannot.
   */
  waived: boolean;
  freeOverMinor?: number | null;
};

export type OrderStatus = components["schemas"]["StorefrontOrderStatus"];

export type SitemapEntry = { slug: string; lastModified?: string | null };

export type QuoteLine = components["schemas"]["StorefrontQuoteLine"];
export type Contact = components["schemas"]["StorefrontContact"];

export type CartLine = { slug: string; quantity: number };

export type PlacedOrder = {
  orderNumber: string;
  statusToken: string;
  totalMinor: number;
  currency?: Tenant["currency"];
};

/**
 * Thrown for any non-2xx that is not a 404. Pages translate 404 into
 * `notFound()` and let everything else become an error boundary, so a shop
 * that is merely disabled looks different from an ERP that is down.
 */
export class ErpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    /**
     * The ERP's own message when it explained itself — "'boot-polish' is no
     * longer available". Worth surfacing verbatim: it is written for the
     * shopper, and a generic "something went wrong" would hide the one detail
     * that lets them fix their cart.
     */
    readonly detail?: string,
  ) {
    super(detail ?? `ERP responded ${status} for ${path}`);
    this.name = "ErpError";
  }
}

function baseUrl(): string {
  const url = process.env.ERP_API_URL;
  if (!url) throw new Error("ERP_API_URL is not set");
  return url.replace(/\/$/, "");
}

/**
 * Which key header to send depends on what is being talked to.
 *
 * Against the Cloudflare Worker (production) the edge gate expects
 * `X-Client-API-Key`. Against the Rust origin directly (local development,
 * where no Worker exists) the origin gate expects `X-API-Key`. Sending the
 * wrong one is a 401 that looks exactly like a missing shop, so it is worth
 * being explicit rather than sending both.
 */
function authHeaders(): Record<string, string> {
  const clientKey = process.env.ERP_CLIENT_API_KEY;
  if (clientKey) return { "X-Client-API-Key": clientKey };

  const originKey = process.env.ERP_ORIGIN_API_KEY;
  if (originKey) return { "X-API-Key": originKey };

  throw new Error("Set ERP_CLIENT_API_KEY (via Worker) or ERP_ORIGIN_API_KEY (direct to origin)");
}

type ServiceBinding = {
  fetch(input: string, init?: RequestInit): Promise<Response>;
};

/**
 * On Cloudflare the ERP is reached through the `ERP_API` service binding, not
 * its public URL. api.ghumtibags.com shares this Worker's zone, and a same-zone
 * Worker-to-Worker fetch fails with error 1042 — served as a 404 that reads
 * exactly like a missing shop. The URL still carries the path; the binding
 * ignores the host.
 *
 * Anywhere without the binding (`next dev`, `next start`) falls back to a plain
 * fetch against ERP_API_URL.
 */
function erpFetch(url: string, init: RequestInit): Promise<Response> {
  const binding = erpBinding();
  return binding ? binding.fetch(url, init) : fetch(url, init);
}

function erpBinding(): ServiceBinding | undefined {
  try {
    return (getCloudflareContext().env as { ERP_API?: ServiceBinding }).ERP_API;
  } catch {
    // No Workers request context: next dev, next start, or build time.
    return undefined;
  }
}

/**
 * `null` on 404 so callers can decide what a missing thing means, rather than
 * having to catch an exception for an expected outcome.
 */
async function get<T>(path: string, search?: URLSearchParams): Promise<T | null> {
  const query = search?.toString();
  const url = `${baseUrl()}${path}${query ? `?${query}` : ""}`;

  const response = await erpFetch(url, {
    headers: { Accept: "application/json", ...authHeaders() },
    // Catalog pages are cached at the edge for a minute; add-to-cart and
    // checkout will re-read live. A shopper may briefly see a price that is
    // about to change, but nothing incorrect can be bought.
    next: { revalidate: 60 },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new ErpError(response.status, path);

  const body = (await response.json()) as { data: T };
  return body.data;
}

export async function fetchCatalog(
  tenantCode: string,
  query: CatalogQuery = {},
): Promise<Catalog | null> {
  const search = new URLSearchParams();
  if (query.q) search.set("q", query.q);
  if (query.category) search.set("category", query.category);
  if (query.brand) search.set("brand", query.brand);
  if (query.page && query.page > 1) search.set("page", String(query.page));
  if (query.limit) search.set("limit", String(query.limit));
  // `featured` is the ERP's own default, so it is left out of the query string
  // rather than spelled out — one listing, one URL, and the canonical link for
  // an unsorted shop stays the bare one.
  if (query.sort && query.sort !== "featured") search.set("sort", query.sort);
  if (query.minPrice) search.set("minPrice", String(query.minPrice));
  if (query.maxPrice) search.set("maxPrice", String(query.maxPrice));
  if (query.inStock) search.set("inStock", "true");

  return get<Catalog>(`/storefront/${encodeURIComponent(tenantCode)}/catalog`, search);
}

/**
 * The shop's category and brand navigation.
 *
 * Cached for an hour rather than the minute `get` uses: this changes only when
 * the merchant publishes something new, and re-fetching it on every listing
 * render would make the cheap query as expensive as the one it sits beside.
 */
export async function fetchFacets(tenantCode: string): Promise<Facets | null> {
  const path = `/storefront/${encodeURIComponent(tenantCode)}/facets`;
  const response = await erpFetch(`${baseUrl()}${path}`, {
    headers: { Accept: "application/json", ...authHeaders() },
    next: { revalidate: 3600 },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new ErpError(response.status, path);

  const body = (await response.json()) as { data: Facets };
  return body.data;
}

/**
 * The shop itself, for chrome that every page under `/{tenant}` carries.
 *
 * Served by the facets endpoint rather than the catalog: both return the
 * tenant, but facets is the cheaper read and is already cached for an hour, so
 * a header does not put a catalog query behind every product page. Next dedupes
 * the two calls when a page asks for facets as well, so the listing pays for
 * one request, not two.
 */
export async function fetchShop(tenantCode: string): Promise<Tenant | null> {
  const facets = await fetchFacets(tenantCode);
  return facets?.tenant ?? null;
}

/**
 * The shop as it is right now, for a page that makes a decision with it.
 *
 * `fetchShop` is up to an hour old, which is fine for a name in a header and
 * wrong for `requireSignIn` and `signInWith`: a merchant who turns sign-in off
 * would see their cart keep sending guests to a sign-in page for an hour, and
 * one who turns it on would see guests offered a checkout the ERP then refuses.
 *
 * `no-store`, not a shorter revalidate. Only per-request pages call this — the
 * cart, sign-in — which already render per shopper and read a cookie, so there
 * is no page cache for a live read to spoil. A one-minute revalidate would
 * only shrink the window in which the storefront and the ERP disagree, not
 * close it. The cost is one facets query per cart view by a signed-out shopper,
 * which is the cheapest read the ERP exposes that carries the tenant.
 *
 * A `no-store` fetch neither reads nor writes the data cache, so the hour-long
 * entry the layout reads is left exactly as it was.
 */
export async function fetchShopLive(tenantCode: string): Promise<Tenant | null> {
  const path = `/storefront/${encodeURIComponent(tenantCode)}/facets`;
  const response = await fetch(`${baseUrl()}${path}`, {
    headers: { Accept: "application/json", ...authHeaders() },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new ErpError(response.status, path);

  const body = (await response.json()) as { data: Facets };
  return body.data.tenant;
}

/**
 * Fetches a product photograph's raw bytes.
 *
 * Returns the `Response` rather than a parsed body: the media route handler
 * streams it straight back to the browser, so decoding it here would only mean
 * buffering an image in memory to hand it over unchanged.
 *
 * `apiPath` comes from `Product.images` and is used verbatim. It is the ERP's
 * own output, not user input, and the ERP re-checks tenant and publication on
 * every request regardless.
 */
export async function fetchMedia(apiPath: string): Promise<Response> {
  return erpFetch(`${baseUrl()}${apiPath}`, {
    headers: authHeaders(),
    // The ERP marks these immutable for a year and the browser will honour
    // that; caching the bytes in the Next data cache as well would spend the
    // cache budget on something already cached one hop further out.
    cache: "no-store",
  });
}

/**
 * Never cached, unlike `get`. A quote and an order are decisions about money,
 * so they always read the live catalog even when the page the shopper came
 * from was served from the edge a minute ago.
 */
async function post<T>(
  path: string,
  payload: unknown,
  shopperIp?: string,
): Promise<T | null> {
  const response = await erpFetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders(),
      // Forwarded so the ERP can rate-limit and challenge the shopper rather
      // than this server, which every shopper shares. See lib/client-ip.
      ...(shopperIp ? { "X-Shopper-IP": shopperIp } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: { error?: string }) => body.error)
      .catch(() => undefined);
    throw new ErpError(response.status, path, detail);
  }

  const body = (await response.json()) as { data: T };
  return body.data;
}

/**
 * Prices a cart. Note what is *not* sent: the client holds slugs and
 * quantities, and every amount comes back from the server. There is nowhere in
 * this call for the browser's idea of a price to enter.
 */
export async function fetchQuote(
  tenantCode: string,
  lines: CartLine[],
  shopperIp?: string,
): Promise<Quote | null> {
  return post<Quote>(
    `/storefront/${encodeURIComponent(tenantCode)}/quote`,
    { lines },
    shopperIp,
  );
}

/**
 * Writes the order, on behalf of the signed-in shopper when there is one.
 *
 * Goes through `privatePost` because it can carry a session, and so follows
 * that block's rules: never cached, and the session in `X-Shopper-Session`.
 * With a session the ERP stamps the buyer's account on the order, and for a
 * phone sign-in records the number the code was received on whatever
 * `contact.phone` says; an email sign-in has no verified number, so the typed
 * one is kept for delivery. On a shop
 * that requires sign-in, a missing or lapsed session is a 401 thrown from here,
 * which the order route turns into "sign in again".
 */
export async function placeOrder(
  tenantCode: string,
  payload: {
    lines: CartLine[];
    contact: Contact;
    note?: string;
    /**
     * From the checkout widget. Single-use: the ERP rejects a replay, so an
     * order that fails for any other reason needs a freshly solved one.
     */
    turnstileToken?: string;
  },
  options: { session?: string; shopperIp?: string } = {},
): Promise<PlacedOrder | null> {
  return privatePost<PlacedOrder>(
    `/storefront/${encodeURIComponent(tenantCode)}/order`,
    payload,
    options,
  );
}

/**
 * One shopper's order, by the token they were given at checkout.
 *
 * Never cached: it is personal, and it changes as the shop works through it.
 */
export async function fetchOrderStatus(
  tenantCode: string,
  token: string,
): Promise<OrderStatus | null> {
  const path = `/storefront/${encodeURIComponent(tenantCode)}/order/${encodeURIComponent(token)}`;
  const response = await erpFetch(`${baseUrl()}${path}`, {
    headers: { Accept: "application/json", ...authHeaders() },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new ErpError(response.status, path);

  const body = (await response.json()) as { data: OrderStatus };
  return body.data;
}

/**
 * Cancels an order the shop has not started. The ERP re-checks that
 * server-side, so a stale page offering the button cannot force it through.
 */
export async function cancelOrder(
  tenantCode: string,
  token: string,
  shopperIp?: string,
): Promise<OrderStatus | null> {
  return post<OrderStatus>(
    `/storefront/${encodeURIComponent(tenantCode)}/order/${encodeURIComponent(token)}/cancel`,
    {},
    shopperIp,
  );
}

/**
 * Every published slug, for the sitemap.
 *
 * Cached for an hour: crawlers do not need the hour's news, and this is the
 * one call that reads the whole catalog at once.
 */
export async function fetchSitemap(
  tenantCode: string,
): Promise<{ tenant: Tenant; products: SitemapEntry[]; truncated: boolean } | null> {
  const path = `/storefront/${encodeURIComponent(tenantCode)}/sitemap`;
  const response = await erpFetch(`${baseUrl()}${path}`, {
    headers: { Accept: "application/json", ...authHeaders() },
    next: { revalidate: 3600 },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new ErpError(response.status, path);

  const body = (await response.json()) as {
    data: { tenant: Tenant; products: SitemapEntry[]; truncated: boolean };
  };
  return body.data;
}

export async function fetchProduct(
  tenantCode: string,
  slug: string,
): Promise<{ tenant: Tenant; product: Product } | null> {
  return get(
    `/storefront/${encodeURIComponent(tenantCode)}/product/${encodeURIComponent(slug)}`,
  );
}

/* ------------------------------------------------------------------------- *
 * Buyer sessions
 *
 * Everything below carries a signed-in shopper's session. Two rules apply to
 * all of it and to anything added beside it.
 *
 * First: never `next: { revalidate }`, always `cache: "no-store"`. Next's data
 * cache keys on the URL and does not vary on headers, so a cached response to
 * the order history would be handed to the next shopper who asked — someone
 * else's addresses and someone else's totals. The `get` helper above defaults
 * to a sixty-second revalidate, which is right for a catalog and catastrophic
 * here, which is why none of these calls goes through it.
 *
 * Second: the session rides in `X-Shopper-Session`, never in a URL and never in
 * `Authorization`. The Worker's edge gate reserves `Authorization` for staff
 * JWTs, and a named header alongside `X-Shopper-IP` says what it is and travels
 * the same path.
 * ------------------------------------------------------------------------- */

/**
 * Who is signed in — the shop, the shopper, and the accounts they may act for.
 *
 * Accounts are named and never numbered, deliberately: nothing here can be fed
 * back to the ERP as a selector. `current` marks the one this session acts for.
 */
export type ShopperSession = components["schemas"]["StorefrontShopperSession"];

/** One row of order history. Carries its own currency, so a list never has to
 * borrow the tenant's to render a total. */
export type OrderSummary = components["schemas"]["StorefrontOrderSummary"];

/**
 * Who a code is for: exactly one of a phone number or an email address, as the
 * shopper typed it. The ERP canonicalises both — ten trailing digits, or the
 * address trimmed and lower-cased — and a code is only ever redeemed against
 * the same one it was sent to.
 *
 * A union rather than two optional fields, so that a call naming both, or
 * neither, does not compile. The ERP refuses both with a 400 anyway; this
 * keeps the mistake from being written in the first place.
 */
export type LoginIdentifier = { phone: string; email?: never } | { email: string; phone?: never };

/** The channels a shop can deliver a sign-in code on right now. */
export type SignInChannel = Tenant["signInWith"][number];

/**
 * The answer to a code request. Says nothing about whether the phone or address
 * was known: the ERP answers a stranger and a regular identically, so this
 * endpoint cannot be used to find out who shops here. There is no challenge id
 * — the identifier is what names the challenge, and one has one live code.
 */
export type LoginChallenge = {
  sent: boolean;
  expiresInSeconds: number;
  /** Escalates with each send in the hour: 60, 120, 300, then 900. */
  resendAfterSeconds: number;
};

/** The only copy of `token`; the ERP keeps a SHA-256 and nothing else. */
export type LoginResult = ShopperSession & {
  token: string;
  /** End of the sliding idle window, extended on every authenticated request. */
  expiresAt: string;
  /** The hard cap, set once at sign-in and never extended. */
  absoluteExpiresAt: string;
};

export type OrderHistory = {
  tenant: Tenant;
  orders: OrderSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function sessionHeaders(session: string): Record<string, string> {
  return { "X-Shopper-Session": session };
}

/** True when the ERP says this session is no longer good. */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ErpError && error.status === 401;
}

/**
 * A read on behalf of a signed-in shopper.
 *
 * 401 is thrown rather than folded into `null`, because by this point the shop
 * demonstrably exists — the tenant resolved — and "sign in again" is a
 * different outcome from "this shop is gone" that the pages need to tell apart.
 */
async function privateGet<T>(
  path: string,
  session: string,
  search?: URLSearchParams,
): Promise<T | null> {
  const query = search?.toString();
  const url = `${baseUrl()}${path}${query ? `?${query}` : ""}`;

  const response = await erpFetch(url, {
    headers: {
      Accept: "application/json",
      ...authHeaders(),
      ...sessionHeaders(session),
    },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new ErpError(response.status, path);

  const body = (await response.json()) as { data: T };
  return body.data;
}

/**
 * A write, with or without a session.
 *
 * Separate from `post` rather than an extra parameter on it, so that the quote
 * — which never carries a session — cannot start sending one by accident.
 * Placing an order moved here when checkout became session-aware.
 *
 * The ERP's own message is carried out on every rejection, not only on 400.
 * Signing in fails with a 401 that says which of "wrong", "expired" and "asked
 * too often" happened in the one sentence the shopper is allowed to see, and a
 * 503 names a shop that cannot send messages at all — both are worth more to
 * them than "something went wrong".
 */
async function privatePost<T>(
  path: string,
  payload: unknown,
  options: { session?: string; shopperIp?: string } = {},
): Promise<T | null> {
  const response = await erpFetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.session ? sessionHeaders(options.session) : {}),
      ...(options.shopperIp ? { "X-Shopper-IP": options.shopperIp } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: { error?: string }) => body.error)
      .catch(() => undefined);
    throw new ErpError(response.status, path, detail);
  }

  const body = (await response.json()) as { data: T };
  return body.data;
}

/**
 * Asks the shop to send a one-time code.
 *
 * Creates no customer: the row is written when the code is verified, never
 * here, so an unauthenticated caller cannot fill the customer table with
 * numbers it made up.
 */
export async function requestLoginCode(
  tenantCode: string,
  identifier: LoginIdentifier,
  turnstileToken?: string,
  shopperIp?: string,
): Promise<LoginChallenge | null> {
  return privatePost<LoginChallenge>(
    `/storefront/${encodeURIComponent(tenantCode)}/auth/request-code`,
    { ...identifier, turnstileToken },
    { shopperIp },
  );
}

/**
 * Exchanges a code for a session.
 *
 * Keyed by the phone number or email address rather than by a challenge id,
 * because one identifier has exactly one live code — which is also what makes
 * the send throttle a throttle. `name` is for a form that doubles as a
 * sign-up; omitting it leaves whatever name the shopper's last order recorded.
 */
export async function verifyLoginCode(
  tenantCode: string,
  payload: LoginIdentifier & { code: string; name?: string },
  shopperIp?: string,
): Promise<LoginResult | null> {
  return privatePost<LoginResult>(
    `/storefront/${encodeURIComponent(tenantCode)}/auth/verify`,
    payload,
    { shopperIp },
  );
}

/**
 * Ends the session at the ERP, which is what actually matters — clearing the
 * cookie alone would leave a token that still worked if it had been copied.
 *
 * `everywhere` ends every session this shopper holds, which is what a lost
 * phone needs.
 */
export async function logoutBuyer(
  tenantCode: string,
  session: string,
  everywhere = false,
): Promise<{ signedOut: boolean } | null> {
  const query = everywhere ? "?everywhere=true" : "";
  return privatePost<{ signedOut: boolean }>(
    `/storefront/${encodeURIComponent(tenantCode)}/auth/logout${query}`,
    {},
    { session },
  );
}

/**
 * Who the session belongs to, for the header's account slot.
 *
 * Reading it slides the ERP's idle window forward, so a shopper browsing the
 * catalog stays signed in without ever visiting their account page.
 */
export async function fetchShopperSession(
  tenantCode: string,
  session: string,
): Promise<ShopperSession | null> {
  return privateGet<ShopperSession>(
    `/storefront/${encodeURIComponent(tenantCode)}/auth/session`,
    session,
  );
}

/**
 * The account's orders, newest first.
 *
 * Scoped by the ERP to the session's account and to nothing in the request, so
 * there is no parameter here that names whose orders to return. A year of guest
 * checkouts appears the moment someone signs in, because verifying a code
 * adopts the orders placed against that same phone number.
 */
export async function fetchOrders(
  tenantCode: string,
  session: string,
  query: { page?: number; limit?: number } = {},
): Promise<OrderHistory | null> {
  const search = new URLSearchParams();
  if (query.page && query.page > 1) search.set("page", String(query.page));
  if (query.limit) search.set("limit", String(query.limit));

  return privateGet<OrderHistory>(
    `/storefront/${encodeURIComponent(tenantCode)}/account/orders`,
    session,
    search,
  );
}

/**
 * One of the account's orders by its number.
 *
 * Order numbers are sequential and guessable, which is exactly why the status
 * token exists for guests. This path is safe for a different reason: the
 * session is the authorisation, not the number. The ERP folds the account into
 * the lookup itself, so another account's order number is the same 404 as one
 * that never existed.
 */
export async function fetchAccountOrder(
  tenantCode: string,
  session: string,
  orderNumber: string,
): Promise<OrderStatus | null> {
  return privateGet<OrderStatus>(
    `/storefront/${encodeURIComponent(tenantCode)}/account/orders/${encodeURIComponent(orderNumber)}`,
    session,
  );
}
