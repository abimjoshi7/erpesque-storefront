/**
 * Stands in for a product photograph that does not exist yet.
 *
 * A minority of items in a catalogue import never had a photo at the source
 * (see `image_path` in the ERP) — there is nothing to fetch for them, so this
 * is not a loading or error state, just an honest "nothing here". An icon
 * rather than bare text: a blank box with four words in the corner reads as
 * broken, where an icon in the same neutral tone as the box reads as a
 * deliberate placeholder.
 */
export function ImagePlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-ink-disabled ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-10 w-10"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="1.75" />
        <path d="M21 15.5 16.5 11 5 21" />
      </svg>
      <span className="text-caption text-ink-muted">No photo yet</span>
    </div>
  );
}
