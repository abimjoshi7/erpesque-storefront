import "server-only";

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

export type CatalogQuery = {
  q?: string;
  category?: string;
  brand?: string;
  page?: number;
  limit?: number;
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

/**
 * `null` on 404 so callers can decide what a missing thing means, rather than
 * having to catch an exception for an expected outcome.
 */
async function get<T>(path: string, search?: URLSearchParams): Promise<T | null> {
  const query = search?.toString();
  const url = `${baseUrl()}${path}${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
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
  const response = await fetch(`${baseUrl()}${path}`, {
    headers: { Accept: "application/json", ...authHeaders() },
    next: { revalidate: 3600 },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new ErpError(response.status, path);

  const body = (await response.json()) as { data: Facets };
  return body.data;
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
  return fetch(`${baseUrl()}${apiPath}`, {
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
  const response = await fetch(`${baseUrl()}${path}`, {
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
  shopperIp?: string,
): Promise<PlacedOrder | null> {
  return post<PlacedOrder>(
    `/storefront/${encodeURIComponent(tenantCode)}/order`,
    payload,
    shopperIp,
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
  const response = await fetch(`${baseUrl()}${path}`, {
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
  const response = await fetch(`${baseUrl()}${path}`, {
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
