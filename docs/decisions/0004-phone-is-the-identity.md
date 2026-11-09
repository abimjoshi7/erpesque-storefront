# 0004 — The phone number is the only identity

Status: accepted
Date: 2026-09-28

## What this decides

Decision `0003` delivered sign-in codes by email, because no SMS provider had
been chosen and a shop that required sign-in could not otherwise take an order.
That made a verified email the identity, and it left the phone number as
something a shopper typed. This document reverses that. The phone number is the
only identity. Every account, every session and every signed-in order is keyed
to a number that has been proved, and email is not a way in.

The proof has to be free of per-message API fees. Three channels do that, and
all three end at the same `/auth/verify` the storefront already had. Only the
way the code reaches the shopper changes.

## The three channels

**Text, from the merchant's own SIM.** `SMS_PROVIDER=sms_gate` posts the code
to SMS Gateway for Android. The gateway sends it from the phone the merchant
already owns. There is no SMS API bill. The cost is the SIM's own SMS pack, and
the phone has to stay on and online. Carriers throttle a SIM that sends in
bulk; the per-number send cap that already exists is what keeps a single number
from being used to run that up.

**WhatsApp, shopper messages first.** The shopper opens a `wa.me` link that
pre-fills a ref and sends it from their own WhatsApp account. The Cloud API
webhook receives that message together with the number WhatsApp has already
verified. The code is the reply, a free-form message inside the service window
the shopper just opened. It is not an authentication template, which is the
message type Meta charges for. Service-window replies are free under the
per-message pricing that began in July 2025; that is the term to re-check when
the number is set up, along with Meta's business verification. Nobody receives
a message unless they first sent one from the number being proved, so the
channel cannot be used to text a stranger or to run up a bill.

**Telegram, shopper messages first.** The shopper opens a `t.me` link. The bot
asks them to share the phone number on that Telegram account, and accepts the
contact only when `contact.user_id` is the sender. A contact picked from the
address book is refused. Nepal blocked Telegram in 2025, so this channel is
secondary: offered when the bot is configured, not relied on.

The code itself is never stored. For the two message-first channels the hash
written when the link is issued is a placeholder. The code the shopper will
type is minted when their message arrives and matches, and only the new hash is
kept. A copy of the database is not a pile of live codes or live links: the
ref is stored as a SHA-256 too.

## What happens to email

Email sign-in is removed. The request and verify routes refuse an email, and
the sign-in form does not offer one.

Accounts that existed only as an email are not merged onto a phone. Merging on
a number that was typed, and never proved, would hand that email's orders to
whoever typed it. That is the takeover `0002` was built to avoid. Those
shoppers sign in by phone and start a phone-keyed account. Their old orders
remain reachable by the status-token link each order already has. Sessions
whose customer has no phone are revoked, so a cookie from the email era cannot
keep acting as an identity.

Guest orders are unchanged in one respect: a number typed at checkout is still
just a number the rider can call. It becomes the account's identity only when a
code is received on it, which is the adoption that already runs at sign-in.

## What does not change

Guest checkout stays available. This server does not yet have the per-shop
`requireSignIn` switch `0003` describes, and the tenant object says so by
sending `false`. The storefront still reads the flag.

The session cookie, the attempt cap, the send throttle and `POST /auth/verify`
are the ones `0002` shipped. A channel is only a way to deliver the same code.
