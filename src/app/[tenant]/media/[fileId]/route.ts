import { fetchMedia } from "@/lib/erp";

/**
 * Serves a product photograph through this app's own origin.
 *
 * The ERP needs an API key, and an `<img src>` cannot carry one — a browser
 * would have to hold the key for the image to load, which is exactly what this
 * project is built to avoid. So the bytes come through here instead, and the
 * shopper's browser only ever talks to the storefront.
 *
 * The ERP does the authorization: it hands over a file only when that file is
 * in the gallery of a currently published item belonging to this tenant. This
 * handler adds no check of its own, because duplicating the rule here would
 * give it somewhere to drift out of step with the one that matters.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenant: string; fileId: string }> },
) {
  const { tenant, fileId } = await params;

  // Rebuilt from the route's own segments rather than taken from a query
  // parameter, and only after `fileId` is confirmed to be digits, so this
  // handler cannot be pointed at an arbitrary ERP path.
  if (!/^\d+$/.test(fileId)) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetchMedia(
    `/storefront/${encodeURIComponent(tenant)}/media/${fileId}`,
  );

  if (!upstream.ok || !upstream.body) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  // The ERP already refuses non-images, so this is a second floor rather than
  // the rule: whatever changes upstream, this route cannot become a way to
  // serve arbitrary files from the ERP's storage through the shop's origin.
  if (!contentType.startsWith("image/")) {
    return new Response("Not found", { status: 404 });
  }

  // Streamed, not buffered: a product photograph should not have to fit in this
  // worker's memory before the browser sees any of it.
  return new Response(upstream.body, {
    headers: {
      "Content-Type": contentType,
      // Mirrors the ERP's own header. The URL carries a file id and replacing a
      // photo means a new id, so nothing here can go stale.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
