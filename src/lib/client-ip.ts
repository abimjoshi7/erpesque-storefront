/**
 * The shopper's own address, for forwarding to the ERP.
 *
 * Every ERP call in this app is made by *this server*, which is what keeps the
 * API key out of the browser — but it also means the ERP sees one address for
 * every shopper alike. Its rate buckets and its Turnstile check both want the
 * real one, so it is forwarded explicitly as `X-Shopper-IP`. The edge trusts
 * that header only from a caller holding the client API key, which is us.
 *
 * Only the write paths do this. Reads are deliberately left unattributed: they
 * are served from cached, statically rendered pages, and reading a request
 * header to build one would opt the whole route into dynamic rendering and
 * throw away the edge caching the catalog depends on. The ERP's read bucket
 * skips what it cannot attribute; its order bucket, which is the one that
 * matters, still gets a real address.
 */

/** Cloudflare sets this on every request that reaches a Worker. */
const CF_HEADER = "cf-connecting-ip";
/** Standard proxy chain; the client is the first entry. */
const FORWARDED_HEADER = "x-forwarded-for";

export function shopperIp(request: Request): string | undefined {
  const direct = request.headers.get(CF_HEADER)?.trim();
  if (direct) return direct;

  // `X-Forwarded-For: client, proxy1, proxy2` — later entries are the hops that
  // carried it, so only the first is the shopper.
  const forwarded = request.headers.get(FORWARDED_HEADER);
  const first = forwarded?.split(",")[0]?.trim();
  return first || undefined;
}
