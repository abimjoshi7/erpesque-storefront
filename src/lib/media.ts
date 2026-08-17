/**
 * Turns an ERP image path into one this app serves.
 *
 * `Product.images` holds API-relative paths — `/storefront/nsbs/media/42` —
 * because the ERP does not know which host the shopper's browser should be
 * pointed at. It must not be that one: the browser has no API key, and giving
 * it a reason to talk to the ERP directly would reintroduce the CORS surface
 * this project exists without. So every image is rewritten to this app's own
 * origin and proxied.
 *
 * Deliberately not in `erp.ts`: that module is `server-only`, and the product
 * card that needs this renders in both places.
 */
const API_MEDIA_PATH = /^\/storefront\/[^/]+\/media\/(\d+)$/;

/**
 * `null` for anything that does not match, so a path this app does not
 * recognise renders no image rather than a broken one — and so a value that
 * somehow arrived from elsewhere cannot be turned into a link to elsewhere.
 */
export function mediaHref(tenant: string, apiPath: string): string | null {
  const fileId = API_MEDIA_PATH.exec(apiPath)?.[1];
  if (!fileId) return null;
  return `/${encodeURIComponent(tenant)}/media/${fileId}`;
}

/** The card image: the first photograph the merchant arranged, if any. */
export function primaryImage(
  tenant: string,
  images: string[] | undefined,
): string | null {
  for (const path of images ?? []) {
    const href = mediaHref(tenant, path);
    if (href) return href;
  }
  return null;
}
