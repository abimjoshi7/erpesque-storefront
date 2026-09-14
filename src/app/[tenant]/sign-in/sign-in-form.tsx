"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useShopper } from "@/components/shopper-provider";
import { Turnstile } from "@/components/turnstile";
import { Button, Field, Icon, Input, Notice, Text, cx } from "@/design-system";
import type { LoginIdentifier, SignInChannel } from "@/lib/erp";
import { safeNext } from "@/lib/next-path";

/**
 * Two steps: an email address or a phone number, then the code sent to it.
 *
 * Which of the two is offered is the ERP's answer, not this form's: `channels`
 * is the shop's `signInWith`, the channels the server can deliver a code on
 * right now. Email comes first when both are there, because it is the one that
 * works today; the phone step is kept whole for when an SMS provider lands. The
 * page renders no form at all when the list is empty.
 *
 * The step is local state rather than a URL segment because a reload has to
 * start over anyway — the code is verified against the identifier, and a URL
 * that looked resumable but was not would be worse than one that plainly is not.
 *
 * There is no challenge handle to carry: the ERP keeps one live code per phone
 * number or address, so the one the shopper typed is what step two submits
 * alongside the digits. That is also what makes the send throttle countable,
 * since a resend updates the same row rather than creating a rival one.
 *
 * Nothing here reveals whether the address is known to the shop. The server
 * answers a stranger and a regular identically, and this form moves to the code
 * step either way, with the same sentence.
 *
 * `next` has already been vetted by the page, and is vetted again here because
 * it is about to become a navigation and this is the component that makes it —
 * a prop is only as trustworthy as whoever renders the component next.
 */
type Step =
  | { name: "identify" }
  | { name: "code"; identifier: LoginIdentifier; sentTo: string; resendAt: number };

const CHANNEL_COPY: Record<
  SignInChannel,
  { label: string; hint: string; switchTo: string; different: string }
> = {
  email: {
    label: "Email address",
    hint: "We will email you a six-digit code.",
    switchTo: "Use my email instead",
    different: "Use a different email",
  },
  phone: {
    label: "Phone number",
    hint: "The number the shop can reach you on. We will text you a code.",
    switchTo: "Use my phone number instead",
    different: "Use a different number",
  },
};

export function SignInForm({
  tenant,
  next,
  channels,
}: {
  tenant: string;
  next: string;
  /** Never empty; the page says so itself when the shop cannot send codes. */
  channels: SignInChannel[];
}) {
  const router = useRouter();
  const { refresh } = useShopper();
  const [channel, setChannel] = useState<SignInChannel>(
    channels.includes("email") ? "email" : "phone",
  );
  const [step, setStep] = useState<Step>({ name: "identify" });
  const [value, setValue] = useState("");
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

  const other = channels.find((entry) => entry !== channel);
  const copy = CHANNEL_COPY[channel];

  /**
   * Asking for a code costs the shop a message, so the server throttles it per
   * identifier and tells us when it will answer again. Counting down to that
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
   * the code step and reuses the identifier the first code went to: the code
   * they were sent first stops working, but making them retype the address to
   * get a second message would be a worse trade.
   */
  async function sendCode(resend: boolean) {
    const identifier: LoginIdentifier =
      resend && step.name === "code"
        ? step.identifier
        : channel === "email"
          ? { email: value.trim() }
          : { phone: value.trim() };
    const sentTo = identifier.email ?? identifier.phone ?? "";

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/${tenant}/auth/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...identifier, turnstileToken }),
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
        identifier,
        sentTo,
        resendAt: Date.now() + body.data.resendAfterSeconds * 1000,
      });
      if (resend) setCode("");
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
          ...step.identifier,
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
    <div>
      <Steps current={step.name === "identify" ? 1 : 2} />

      {error ? (
        <Notice tone="critical" className="mb-4">
          {error}
        </Notice>
      ) : null}

      {step.name === "identify" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode(false);
          }}
          className="flex flex-col gap-4"
        >
          {/* Keyed by channel so switching gives a fresh control: a phone
              number left in an email field would fail the browser's own check
              before the shopper had typed anything. */}
          <Field
            key={channel}
            id={`sign-in-${channel}`}
            label={copy.label}
            hint={copy.hint}
            required
          >
            {(control) =>
              channel === "email" ? (
                <Input
                  {...control}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  required
                />
              ) : (
                <Input
                  {...control}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  autoFocus
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  required
                />
              )
            }
          </Field>
          <Button type="submit" size="lg" loading={submitting} block>
            {submitting ? "Sending…" : "Send me a code"}
          </Button>

          {other ? (
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              className="self-start"
              disabled={submitting}
              onClick={() => {
                setChannel(other);
                setValue("");
                setError(null);
              }}
            >
              {CHANNEL_COPY[other].switchTo}
            </Button>
          ) : null}
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-4">
          {/* The same sentence for an address the shop has never seen: a
              different one would tell a stranger who shops here. */}
          <div className="flex gap-3 rounded-md bg-surface-subdued p-3">
            <Icon
              name={step.identifier.email ? "mail" : "info"}
              className="mt-px size-4 text-ink-muted"
            />
            <Text variant="bodySmall" tone="subdued" className="min-w-0 break-words">
              We&rsquo;ve sent a code to{" "}
              <span className="font-semibold text-ink-strong">{step.sentTo}</span>.
              {step.identifier.email ? " It can take a minute; check your spam folder too." : ""}
            </Text>
          </div>

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
                // Spaced out like the digits in the message, so a shopper
                // copying them across can check each one against its twin.
                className="py-2.5 text-center font-mono text-h3! tracking-[0.5em] tabular-nums"
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

          <Button type="submit" size="lg" loading={submitting} block>
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
                setStep({ name: "identify" });
                setCode("");
                setError(null);
              }}
            >
              {CHANNEL_COPY[step.identifier.email ? "email" : "phone"].different}
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

/**
 * Where the shopper is in the two steps. The bar is decoration; the sentence
 * under it is what a screen reader gets, and says the same thing.
 */
function Steps({ current }: { current: 1 | 2 }) {
  return (
    <div className="mb-6">
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2].map((index) => (
          <span
            key={index}
            className={cx(
              "h-1 flex-1 rounded-full transition-colors duration-(--duration-normal) ease-standard",
              index <= current ? "bg-primary" : "bg-line",
            )}
          />
        ))}
      </div>
      <Text variant="caption" tone="muted" className="mt-2">
        Step {current} of 2 · {current === 1 ? "Get a code" : "Enter the code"}
      </Text>
    </div>
  );
}
