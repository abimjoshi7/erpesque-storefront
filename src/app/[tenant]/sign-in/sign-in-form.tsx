"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useShopper } from "@/components/shopper-provider";
import { Turnstile } from "@/components/turnstile";
import { Button, Field, Icon, Input, Notice, Text, cx } from "@/design-system";
import type { LoginIdentifier, SignInChannel } from "@/lib/erp";
import { safeNext } from "@/lib/next-path";

/**
 * Reads the clock through a module function rather than inline: the purity
 * rule cannot tell an async submit handler from render, and a bare `Date.now`
 * in the component body reads as an impure call during render.
 */
function nowMs(): number {
  return Date.now();
}

/**
 * Two steps: a phone number, then the code.
 *
 * Which buttons are offered is the ERP's answer, not this form's: `channels`
 * is the shop's `signInWith`, the channels the server can deliver a code on
 * right now. Text sends the code immediately. WhatsApp and Telegram hand back
 * a link the shopper opens; the code arrives as the reply, after they message
 * the shop from that same number. The page renders no form at all when the
 * list is empty.
 *
 * The step is local state rather than a URL segment because a reload has to
 * start over anyway — the code is verified against the number, and a URL that
 * looked resumable but was not would be worse than one that plainly is not.
 *
 * There is no challenge handle to carry: the ERP keeps one live code per phone
 * number, so the one the shopper typed is what step two submits alongside the
 * digits.
 *
 * Nothing here reveals whether the number is known to the shop. The server
 * answers a stranger and a regular identically, and this form moves to the code
 * step either way, with the same sentence.
 *
 * `next` has already been vetted by the page, and is vetted again here because
 * it is about to become a navigation and this is the component that makes it —
 * a prop is only as trustworthy as whoever renders the component next.
 */
type Step =
  | { name: "identify" }
  | {
      name: "code";
      identifier: LoginIdentifier;
      channel: SignInChannel;
      sentTo: string;
      openUrl?: string;
      sandbox?: boolean;
      sandboxText?: string;
      resendAt: number;
    };

const CHANNEL_COPY: Record<
  SignInChannel,
  { button: string; open: string; sent: string }
> = {
  sms: {
    button: "Text me a code",
    open: "Open messages",
    sent: "We've sent a code by text to",
  },
  whatsapp: {
    button: "Get code on WhatsApp",
    open: "Open WhatsApp",
    sent: "Open WhatsApp and send the message from",
  },
  telegram: {
    button: "Get code on Telegram",
    open: "Open Telegram",
    sent: "Open Telegram and share your number from",
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
  const [step, setStep] = useState<Step>({ name: "identify" });
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Bumped after every code request, successful or not. Cloudflare issues a
  // single-use token, so the one that asked for the first code is spent; a
  // resend that re-sent it would fail as a replay rather than on anything the
  // shopper could see and fix.
  const [turnstileNonce, setTurnstileNonce] = useState(0);

  /**
   * Asking for a code is throttled per number, and the server tells us when it
   * will answer again. Counting down to that moment is kinder than a button
   * that looks live and returns an error.
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
   * the code step and reuses the number the first code went to.
   */
  async function sendCode(channel: SignInChannel, resend: boolean) {
    const identifier: LoginIdentifier =
      resend && step.name === "code" ? step.identifier : { phone: value.trim() };
    const sentTo = identifier.phone;
    const chosen = resend && step.name === "code" ? step.channel : channel;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/${tenant}/auth/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...identifier, channel: chosen, turnstileToken }),
      });
      const body = (await response.json()) as {
        data?: {
          resendAfterSeconds: number;
          openUrl?: string | null;
          sandbox?: boolean;
          sandboxText?: string | null;
        };
        error?: string;
      };
      if (!response.ok || !body.data) {
        setError(body.error ?? "Could not send a code. Try again.");
        return;
      }
      setStep({
        name: "code",
        identifier,
        channel: chosen,
        sentTo,
        openUrl: body.data.openUrl ?? undefined,
        sandbox: body.data.sandbox,
        sandboxText: body.data.sandboxText ?? undefined,
        resendAt: nowMs() + body.data.resendAfterSeconds * 1000,
      });
      if (resend) setCode("");
    } catch {
      setError("Could not reach the shop. Check your connection.");
    } finally {
      setTurnstileNonce((nonce) => nonce + 1);
      setSubmitting(false);
    }
  }

  async function deliverSandbox(phone: string, text: string) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/${tenant}/auth/whatsapp-sandbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, text }),
      });
      const body = (await response.json()) as { data?: { reply?: string }; error?: string };
      if (!response.ok || !body.data?.reply) {
        setError(body.error ?? "Sandbox could not deliver the code.");
        return;
      }
      const digits = body.data.reply.replace(/\D/g, "").slice(0, 6);
      if (digits.length === 6) setCode(digits);
      else setError(body.data.reply);
    } catch {
      setError("Could not reach the shop. Check your connection.");
    } finally {
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
          name: name.trim(),
          address: address.trim(),
          landmark: landmark.trim() || undefined,
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
          onSubmit={(event) => event.preventDefault()}
          className="flex flex-col gap-4"
        >
          <Field id="sign-in-phone" label="Phone number" hint="The number this shop can reach you on." required>
            {(control) => (
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
            )}
          </Field>
          <div className="flex flex-col gap-2">
            {channels.map((channel) => (
              <Button
                key={channel}
                type="submit"
                size="lg"
                variant={channel === channels[0] ? "primary" : "secondary"}
                loading={submitting}
                block
                onClick={() => void sendCode(channel, false)}
              >
                {submitting ? "Sending…" : CHANNEL_COPY[channel].button}
              </Button>
            ))}
          </div>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-4">
          {/* The same sentence for a number the shop has never seen: a
              different one would tell a stranger who shops here. */}
          <div className="flex gap-3 rounded-md bg-surface-subdued p-3">
            <Icon name="info" className="mt-px size-4 text-ink-muted" />
            <Text variant="bodySmall" tone="subdued" className="min-w-0 break-words">
              {step.sandbox && !step.openUrl ? (
                <>
                  Sandbox is on for{" "}
                  <span className="font-semibold text-ink-strong">{step.sentTo}</span>. No
                  WhatsApp test number is configured yet, so deliver the code here and then
                  sign in.
                </>
              ) : (
                <>
                  {CHANNEL_COPY[step.channel].sent}{" "}
                  <span className="font-semibold text-ink-strong">{step.sentTo}</span>
                  {step.openUrl ? ". The code comes back in that chat. Then enter it here." : "."}
                </>
              )}
            </Text>
          </div>

          {step.openUrl ? (
            <a
              href={step.openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[image:var(--primary-sheen)] px-4 text-body font-semibold text-on-primary shadow-sm"
            >
              {CHANNEL_COPY[step.channel].open}
            </a>
          ) : null}

          {step.sandbox && step.sandboxText ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              block
              disabled={submitting}
              onClick={() => void deliverSandbox(step.sentTo, step.sandboxText ?? "")}
            >
              Sandbox: deliver the code to this number
            </Button>
          ) : null}

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

          <Field id="sign-in-name" label="Your name" required>
            {(control) => (
              <Input
                {...control}
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            )}
          </Field>
          <Field
            id="sign-in-address"
            label="Delivery address"
            hint="Where the rider brings the order. Checkout will use this."
            required
          >
            {(control) => (
              <Input
                {...control}
                autoComplete="street-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                required
              />
            )}
          </Field>
          <Field
            id="sign-in-landmark"
            label="Landmark"
            hint="A shop or crossing the rider will know."
          >
            {(control) => (
              <Input
                {...control}
                value={landmark}
                onChange={(event) => setLandmark(event.target.value)}
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
              onClick={() => void sendCode(step.channel, true)}
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
