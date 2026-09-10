"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile, guarding order submission and the sign-in code request.
 *
 * The widget produces a token; the ERP verifies it against Cloudflare before it
 * will write an order or send a code. Solving it is usually invisible — most
 * shoppers see a spinner resolve itself and nothing else. It guards both because
 * both cost the shop something a script could spend: an order costs a rider's
 * time, and a code costs a message.
 *
 * Renders nothing when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset. That matches
 * the server, which skips the check when it has no secret key, so a local or
 * self-hosted install still takes orders instead of refusing every one of them.
 *
 * The token is **single-use**: Cloudflare rejects a replay with
 * `timeout-or-duplicate`. So the widget must be reset after any failed submit,
 * or a shopper who mistyped their phone number is locked out of their own
 * order — the second attempt would fail on the stale token rather than on
 * anything they could see and fix. `resetSignal` is how the form asks for that.
 */

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "auto" | "light" | "dark";
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Loaded once per page, however many widgets ask for it. */
let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed to load"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function Turnstile({
  onToken,
  resetSignal = 0,
}: {
  onToken: (token: string | null) => void;
  /** Increment to discard the current token and re-challenge. */
  resetSignal?: number;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  // Held in a ref so re-rendering the form does not tear the widget down and
  // make the shopper solve it again. Assigned in an effect rather than during
  // render: a render can be discarded, and a ref written from one that is would
  // leave the widget calling into a callback that never committed.
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let cancelled = false;
    const element = container.current;

    loadTurnstile()
      .then(() => {
        if (cancelled || !window.turnstile || widgetId.current) return;
        widgetId.current = window.turnstile.render(element, {
          sitekey: siteKey,
          callback: (token) => callback.current(token),
          // Both of these mean "the token you have is worthless now". Clearing
          // it stops the form submitting something Cloudflare will refuse.
          "expired-callback": () => callback.current(null),
          "error-callback": () => callback.current(null),
        });
      })
      .catch(() => {
        // The ERP decides what an unverified order means; if the script cannot
        // load, submitting without a token gets an honest answer from there
        // rather than a dead button here.
        callback.current(null);
      });

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (!resetSignal || !widgetId.current || !window.turnstile) return;
    window.turnstile.reset(widgetId.current);
    callback.current(null);
  }, [resetSignal]);

  if (!siteKey) return null;

  return <div ref={container} className="min-h-[65px]" />;
}
