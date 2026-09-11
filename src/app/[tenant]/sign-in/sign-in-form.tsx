"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useShopper } from "@/components/shopper-provider";
import { Turnstile } from "@/components/turnstile";
import { Button, Field, Input, Notice, Text } from "@/design-system";
import { safeNext } from "@/lib/next-path";

/**
 * Two steps: a phone number, then the code sent to it.
 *
 * The step is local state rather than a URL segment because a reload has to
 * start over anyway — the code is verified against the number, and a URL that
 * looked resumable but was not would be worse than one that plainly is not.
 *
 * There is no challenge handle to carry: the ERP keeps one live code per phone
 * number, so the number the shopper typed is what step two submits alongside
 * the digits. That is also what makes the send throttle countable, since a
 * resend updates the same row rather than creating a rival one.
 *
 * Nothing here reveals whether the number is known to the shop. The server
 * answers a stranger and a regular identically, and this form moves to the code
 * step either way.
 *
 * `next` has already been vetted by the page, and is vetted again here because
 * it is about to become a navigation and this is the component that makes it —
 * a prop is only as trustworthy as whoever renders the component next.
 */
type Step = { name: "phone" } | { name: "code"; phone: string; resendAt: number };

export function SignInForm({ tenant, next }: { tenant: string; next: string }) {
  const router = useRouter();
  const { refresh } = useShopper();
  const [step, setStep] = useState<Step>({ name: "phone" });
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Bumped after every code request, successful or not. Cloudflare issues a
  // single-use token, so the one that asked for the first code is spent; a
  // resend that re-sent it would fail as a replay rather than on anything the
  // shopper could see and fix.
  const [turnstileNonce, setTurnstileNonce] = useState(0);

  /**
   * Asking for a code costs the shop a message, so the server throttles it per
   * phone number and tells us when it will answer again. Counting down to that
   * moment is kinder than a button that looks live and returns an error.
   */
  const resendAt = step.name === "code" ? step.resendAt : 0;
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (!resendAt) return;
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  /**
   * Shared by the first request and by a resend. A resend keeps the shopper on
   * the code step: the challenge id changes, so the code they were sent first
   * stops working, but making them retype the number to get a second message
   * would be a worse trade.
   */
  async function sendCode(stay: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/${tenant}/auth/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, turnstileToken }),
      });
      const body = (await response.json()) as {
        data?: { resendAfterSeconds: number };
        error?: string;
      };
      if (!response.ok || !body.data) {
        setError(body.error ?? "Could not send a code. Try again.");
        return;
      }
      setStep({
        name: "code",
        phone,
        resendAt: Date.now() + body.data.resendAfterSeconds * 1000,
      });
      if (stay) setCode("");
    } catch {
      setError("Could not reach the shop. Check your connection.");
    } finally {
      setTurnstileNonce((nonce) => nonce + 1);
      setSubmitting(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (step.name !== "code") return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/${tenant}/auth/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: step.phone,
          code,
          name: name || undefined,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "That code was not right.");
        return;
      }
      // The session cookie is set by the response to the call above. The shared
      // shopper state is asked again before navigating, so the header and the
      // add to cart button already know by the time the next page paints; the
      // router refresh does the same for server components. `replace` rather
      // than `push`, so Back from the cart does not land on a spent code form.
      await refresh();
      router.replace(safeNext(tenant, next));
      router.refresh();
    } catch {
      setError("Could not reach the shop. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-8">
      {error ? (
        <Notice tone="critical" className="mb-4">
          {error}
        </Notice>
      ) : null}

      {step.name === "phone" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode(false);
          }}
          className="flex flex-col gap-4"
        >
          <Field
            id="sign-in-phone"
            label="Phone number"
            hint="The number the shop can reach you on."
            required
          >
            {(control) => (
              <Input
                {...control}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            )}
          </Field>
          <Button type="submit" loading={submitting} block>
            {submitting ? "Sending…" : "Send me a code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-4">
          <Text variant="bodySmall" tone="subdued">
            We sent a code to {step.phone}.
          </Text>

          <Field id="sign-in-code" label="The six-digit code" required>
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            )}
          </Field>

          {/* Only useful the first time; the shop already knows a returning
              buyer's name, and sending an empty one leaves it as it was. */}
          <Field
            id="sign-in-name"
            label="Your name"
            hint="Only needed if this is your first time."
          >
            {(control) => (
              <Input
                {...control}
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>

          <Button type="submit" loading={submitting} block>
            {submitting ? "Checking…" : "Sign in"}
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              disabled={submitting || secondsLeft > 0}
              onClick={() => void sendCode(true)}
            >
              {secondsLeft > 0 ? `Send again in ${secondsLeft}s` : "Send another code"}
            </Button>
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              disabled={submitting}
              onClick={() => {
                setStep({ name: "phone" });
                setCode("");
                setError(null);
              }}
            >
              Use a different number
            </Button>
          </div>
        </form>
      )}

      {/* Mounted on both steps, because a resend needs a token of its own. It
          renders nothing when no site key is configured, which is what lets a
          local install sign in without a Cloudflare account. */}
      <div className="mt-4">
        <Turnstile onToken={setTurnstileToken} resetSignal={turnstileNonce} />
      </div>
    </div>
  );
}
