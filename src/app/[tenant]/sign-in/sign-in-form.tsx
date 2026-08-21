"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Turnstile } from "@/components/turnstile";
import { Button, Field, Input, Notice, Text } from "@/design-system";

/**
 * Two steps: a phone number, then the code sent to it.
 *
 * The step is local state rather than a URL segment because the challenge id
 * only exists in this component's lifetime — a shopper who reloads has to ask
 * for a new code anyway, and a URL that looked resumable but was not would be
 * worse than one that plainly is not.
 *
 * Nothing here reveals whether the number is known to the shop. The server
 * answers a stranger and a regular identically, and this form moves to the code
 * step either way.
 */
type Step =
  | { name: "phone" }
  | { name: "code"; challengeId: string; phone: string; resendAt: number };

export function SignInForm({ tenant }: { tenant: string }) {
  const router = useRouter();
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
        data?: { challengeId: string; resendAfterSeconds: number };
        error?: string;
      };
      if (!response.ok || !body.data) {
        setError(body.error ?? "Could not send a code. Try again.");
        return;
      }
      setStep({
        name: "code",
        challengeId: body.data.challengeId,
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
          challengeId: step.challengeId,
          code,
          name: name || undefined,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "That code was not right.");
        return;
      }
      // The session cookie is set by the response to the call above. Navigate
      // and refresh so the header's account slot and the account page both read
      // the new state from the server rather than from anything held here.
      router.push(`/${tenant}/account`);
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

          <Field id="sign-in-code" label="The code" required>
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                autoComplete="one-time-code"
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
