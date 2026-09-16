# Juspay Prototype — a collectibles marketplace

A minimal storefront that takes a buyer from browsing to a real, completed
payment in the Hyperswitch sandbox.

> **Status:** framing and planning complete, build not yet started.
> [PLAN.md](PLAN.md) is the full reasoning; this file is the summary.

## The industry we picked

**A peer-to-peer marketplace for US coins and trading cards** — a scoped-down
mix of eBay and Facebook Marketplace. Individuals list, individuals buy,
buy-it-now only. A buyer and a seller are two different people, but any account
can be either — which is how collectors actually behave.

```
Buyer ──pays──> Marketplace ──holds──> (seller ships directly) ──releases──> Seller
                     │                                                          │
                     ├── commission ──> Marketplace           payout ───────────┘
                     └── sales tax ───> State                 to PayPal / bank
```

The buyer pays us, we hold the funds, the **seller ships directly** on their
own schedule, and the money releases after an inspection window, minus our
commission. We never see the item. Proceeds leave to an external payout
instrument — there's no spendable platform wallet.

Prices run from a $20 raw card to a $6,000 graded coin. That spread is the
category, not an edge case.

## What it demonstrates

Three role views behind a dropdown — **buyer**, **seller**, **admin** — seeded
with ~10 sellers and ~30 listings, so the marketplace payment model is visible
end to end without building a real marketplace:

| | |
| --- | --- |
| **Payment creation** | Server-side; the secret key never reaches the browser |
| **Successful payment** | A real `succeeded` in the Hyperswitch sandbox dashboard |
| **Failed payment** | Hard and soft declines with normalised reasons |
| **Payment status** | Authoritative server-side read — never the redirect |
| **Refund** | Full and partial, from the admin view |
| **Webhook** | Signature-verified, updating the order |
| **Marketplace fee** | Calculated and shown on the seller dashboard |
| **Seller balance** | pending → available → paid out |

## Why this industry makes payments interesting

**The money is held across a post-ship inspection window, and that window is
the product.** It's the mechanism every established marketplace runs: the buyer
pays, the item ships, the buyer gets a period to check it, and only then does
the seller get paid. Capture timing, refund policy and payout timing aren't
three questions — they're one question about who carries risk across that
window. Everything structural here descends from it.

**Authenticity is a real dispute driver, and it's a fulfilment problem.** Coins
and cards fail in a way ordinary retail doesn't: the item arrives exactly as
pictured and is fake or misgraded. The industry answer isn't a payments feature
— it's eBay's Authenticity Guarantee, routing high-ticket items through a
third-party authenticator in the middle of the shipping path. Out of scope
here, and noted because a payments design claiming to solve it would be
over-reaching.

**The payment method a buyer picks decides who carries the risk.** PayPal is
what buyers want here — its Purchase Protection names *"advertised as authentic
but is not authentic"* — and it's simultaneously where we'd carry the most
exposure, because PayPal's *Seller* Protection excludes not-as-described
entirely, and as merchant of record the dispute names our account, not the
individual shipper's. Bank debit runs the other way: a consumer can return an
ACH debit as unauthorised for 60 days, which is the one window a hold could
realistically outrun. Wallets are card presentment and add no protection of
their own. So the method mix is a risk decision, not a convenience one.

**One checkout serves a $20 and a $6,000 decision.** Under a few hundred
dollars, friction reads as suspicion. Above it, the buyer *wants* to slow down
and read what's covered. Same guarantee, different weight — a threshold in the
price data, not a second checkout.

## The decisions that follow from that

| Decision | Why |
| --- | --- |
| **Unified Checkout SDK**, not Payment Links or our own card form | Card data stays out of our PCI scope, and payment methods become a business-profile setting rather than a code change. That second property is the argument for using an orchestrator at all. |
| **Capture immediately**, no authorise-then-capture-on-ship | The textbook answer for delayed fulfilment fails here: card auths decay in ~7 days and an individual seller ships when they get to the post office, so auths would routinely expire before the item moved. Escrow here is a **ledger** concept, not an auth hold — funds are captured and held against a seller balance, and the reversal tool is a refund, not a void. |
| **Our own idempotency**, via a client-generated attempt id used as the `payment_id` | Hyperswitch has no idempotency header on `POST /payments`; the documented mechanism is the client-supplied `payment_id`, and a duplicate returns an `HE_01` error rather than replaying. We generate one id per checkout attempt and treat `HE_01` as "go read the existing payment". The server still sets the amount, always. |
| **Never auto-retry an ambiguous payment** — "Check again", not "Pay again" | A double charge between two individuals cannot be fixed with an apology, and is worse than a lost sale. The only action available re-reads status server-side and can never create a second charge. |
| **Cart may hold several sellers; checkout runs per seller group** | One basket must become N obligations to N strangers. A single split intent cannot represent partial failure, and partial failure is the normal case. eBay's combined cart creates separate orders for the same reason. |
| **Sign-in is mocked** (Google / Apple / email buttons, no real OAuth) | Real auth would spend the budget on the least payments-interesting part of the product. It still creates a real Hyperswitch `customer`, which keeps saved cards credible as a deferred flow. |
| **The seller pays the commission, deducted at release** | Nothing is added to the buyer's total — a fee appearing after someone decided on a $1,800 item is the worst moment in the funnel. Taking it at release also makes refunds clean: a sale refunded before release simply never charges a fee. Matches eBay and Depop's final-value fees. |
| **No database — Hyperswitch is the read model** | Orders and refund state are derived by querying Hyperswitch rather than duplicated into our own tables, so there's no reconciliation story to explain. One real limit, verified: `metadata` isn't filterable anywhere in the v1 API, so seller-scoped queries page through payments and filter in memory. Fine at demo volume, and the upgrade path (a KV store holding *only* an id mapping, never amounts) is written down. |

## What we take from Hyperswitch

Hyperswitch is an orchestrator, so most of its value sits in things you
configure rather than build. The honest accounting:

- **Unified Checkout SDK** — built on. The only thing between our code and card
  data, and the reason payment methods are a dashboard setting rather than a
  code change.
- **3DS** — left at its `three_ds` default. SCA is an EU mandate and we're
  US-only, so 3DS buys us exactly one thing: liability shift on *fraudulent
  transaction* chargebacks. It does nothing for "not as described". We keep it
  because a stolen-card chargeback on a $6,000 coin moving to the issuer is
  worth the friction — and we say plainly that this build has no dispute
  strategy, rather than dressing 3DS up as one.
- **Vault** — Pay-Then-Vault with `setup_future_usage: "on_session"`, deferred
  but designed. Buy Now means the amount is known at intent time, so
  Vault-Then-Pay's advantage is inert. `off_session` would be claiming consent
  we never use.
- **Smart Retries** — **deliberately off.** Its deduplication is
  reconciliation-level, not network-level: it keeps one payment id but appends
  an attempt number before the processor sees it, so two connectors get two
  distinct ids and neither dedupes. Retrying a hard decline is safe; retrying a
  timeout is the double-charge we refuse to risk.
- **Intelligent Routing / FRM / Surcharge** — documented, not used. Routing and
  FRM need multiple connectors or a commercial contract. Surcharging is capped
  by network rules, banned on debit, restricted in several US states, and
  commercially backwards for a marketplace that monetises via seller commission.

**Connectors, if we went past the dummy connector:** Stripe sandbox first — the
only one that changes what the architecture can *prove* (real normalised
decline codes, real 3DS, faithful capture accounting). PayPal second, for a
genuinely different code path and because buyer trust matters disproportionately
here. Apple Pay last and probably never — domain verification is fatal on
rotating preview URLs. **Link is not supported by Hyperswitch**; it's absent
from the payment-method and connector enums, and the generic `link_wallet`
payment experience is a different thing.

## What we deliberately did not build

The brief asks for the purchase journey through to a completed payment, so
that is what gets built. Everything below is reasoned through in
[PLAN.md](PLAN.md) with a written approach, not implemented:

- **Wallets and PayPal** — the sandbox's dummy connector cannot mint wallet
  session tokens, and Apple Pay additionally needs Developer enrolment and a
  stable verified domain. Enabling them later is a dashboard change with no
  front-end code change, which is precisely why we chose the SDK.
- **Seller payouts and the release window** — needs a separately configured
  payout processor; `split_payments` is Stripe Connect underneath.
- **Authenticity guarantee / third-party authentication** — the industry answer
  to counterfeits on high-ticket collectibles, and a fulfilment programme
  rather than a payments feature. Its one payments consequence is worth stating:
  it converts the release trigger from a timer into an authentication verdict.
- **Disputes and chargebacks** — no dispute trigger exists on the dummy
  connector, and disputes arrive as inbound connector webhooks.
- **Real payouts** — the seller balance and its states are shown, but no money
  moves; payouts need a separately configured payout processor.
- **Seller onboarding, KYC, shipping and tracking, messaging, reviews,
  auctions, offers, saved cards.**
- **ACH, promoted listings, seller subscriptions.**

## Getting started

Requires Node 22+.

```bash
npm install
npm run dev
```

The dev server runs at http://localhost:5173.

## Scripts

| Command             | What it does                         |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the dev server with hot reload |
| `npm run build`     | Typecheck and build to `dist/`       |
| `npm run typecheck` | Typecheck only                       |
| `npm run lint`      | Lint with oxlint                     |
| `npm run format`    | Format with Prettier                 |
| `npm run preview`   | Serve the production build locally   |

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 (configured in `src/index.css`, no config file)
- oxlint + Prettier
- Vercel: static front end plus server functions in `api/`

## Deploying to Vercel

`vercel.json` sends every path except `/api/*` to the SPA, so client-side
routes survive a refresh.

1. Go to [Vercel](https://vercel.com/new) and import this GitHub repository
2. Vercel detects Vite. Accept the defaults and add the Hyperswitch keys under
   **Environment Variables**
3. Deploy

Every push to the connected branch triggers a new deploy. Locally, run
`npx vercel dev` to serve the front end and the `api/` functions together.

## Working on this with Claude Code

This repo is set up for [Claude Code](https://claude.com/claude-code):

- `CLAUDE.md` gives Claude the project's stack, commands, layout, and conventions
- `.claude/settings.json` pre-approves the routine commands (build, lint, git status)
  so you get fewer permission prompts
- `.vscode/extensions.json` recommends the Claude Code extension

To use it in VS Code:

1. Clone the repo and open the folder in VS Code
2. Accept the recommended extensions prompt, or install **Claude Code** from the
   Extensions panel
3. Open the Claude Code panel and run `/login` if you haven't authenticated

Claude picks up `CLAUDE.md` automatically when the repo is the workspace root.
