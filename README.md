# Slabbed — a collectibles marketplace on Hyperswitch

A peer-to-peer marketplace for US coins and trading cards that takes a buyer
from browsing to a **real, completed payment in the Hyperswitch sandbox**, and
then on through shipping, disputes and refunds.

> **Status:** payment path and marketplace screens built; sandbox configured
> and verified on 2026-09-16. **Proven in a real browser against the live
> sandbox:** 11 Playwright tests pass: card payment, hard decline, PayPal,
> ship → receive, dispute → full refund, the ambiguous "don't pay again" state,
> and the reviewer security checks.
> [PLAN.md](PLAN.md) holds the full reasoning, and this file is the summary.
> Everything under "Not built" is written up with an approach instead.
>
> **Live demo:** _URL to be added when this branch merges to `main` (not
> deployed yet)._

---

## The marketplace

Individuals list, individuals buy, buy-it-now only. Any account can be buyer
and seller, which is how collectors behave. Prices run from a $20 raw card to a
$6,000 graded coin in the same catalogue, and that spread shapes most of the
payment decisions below.

```
Buyer ──pays──> Slabbed ──holds──> (seller ships directly) ──releases──> Seller
                   │                                                       │
                   ├── commission ──> Slabbed          payout ────────────┘
                   └── sales tax ───> State            to PayPal / bank
```

## What payments have to get right here

1. **We hold a stranger's money until another stranger ships.** Capture
   timing, refunds and release are one question about who carries risk in
   that gap.
2. **The payment method decides who carries the risk.** PayPal's buyer
   protection covers "not authentic" and "misrepresented condition", but its
   *seller* protection excludes not-as-described, and as merchant of record the
   dispute names us. Cards follow network rules we can predict.
3. **Retry safety beats conversion.** Retrying an ambiguous payment can charge
   one collector twice for another collector's coin. A double charge between
   two individuals can't be fixed by apologising.
4. **More than one provider is structural.** Buyers expect cards and PayPal;
   sellers want payouts to a bank or PayPal; high-value buyers will want
   financing. No single provider does all of it, which is why we use an
   orchestrator.

---

## Architecture

No database and no custom backend server. The browser talks to a handful of
Vercel functions, and those are the only code holding the secret key.
Hyperswitch is the record of truth for payments, and even fulfilment state
(shipped, received, disputed) lives in the payment's own metadata.

```mermaid
flowchart LR
  subgraph Browser["Browser (Vite + React)"]
    UI["Storefront, seller and admin pages"]
    SDK["Hyperswitch Unified Checkout<br/>(card form + PayPal button, in an iframe)"]
  end

  subgraph Vercel["Vercel Functions — api/"]
    CO["POST /api/checkout<br/>prices the order, creates the payment"]
    PAY["GET /api/payment<br/>authoritative status read"]
    OS["POST /api/order-state<br/>shipped / received / disputed"]
    REF["POST /api/refund<br/>admin, refunds one seller's order"]
    ORD["GET /api/orders"]
  end

  subgraph HS["Hyperswitch sandbox"]
    API["Payments API"]
    RT{"Routing rule"}
  end

  subgraph Proc["Simulated processors"]
    ST["stripe_test"]
    FP["fauxpay"]
    PP["paypal_test"]
  end

  UI -- "listing ids, ship-to (no amount)" --> CO
  CO -- "secret api-key" --> API
  CO -- "client_secret + publishable key" --> SDK
  SDK -- "card data / PayPal redirect" --> API
  UI --> PAY & OS & REF & ORD
  PAY & OS & REF & ORD -- "secret api-key" --> API
  API --> RT
  RT -- "card" --> ST & FP
  RT -- "PayPal wallet" --> PP
```

**Security boundaries**
- The secret key (`JUSPAY_API_TEST_KEY`) is read only inside `api/` and never
  has a `VITE_` prefix, since Vite would inline it into the bundle.
- **The server sets the amount** from its own catalogue. The checkout request
  type has no `amount` field at all. One demo simplification: a listing a
  collector creates in the browser (`usr_…`) isn't in the server catalogue, so
  its price comes from the client.
- Card numbers only ever enter Hyperswitch's iframe, so they stay out of our
  code and our PCI scope.

---

## A payment, end to end

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant F as Vercel function
  participant H as Hyperswitch
  participant P as Processor

  B->>B: generate attempt id, store it before the request
  B->>F: POST /api/checkout (listing ids, ship-to)
  F->>F: amount = price + shipping + tax, from server data
  F->>H: POST /payments (payment_id = attempt id, amount, metadata)
  H-->>F: client_secret
  F-->>B: client_secret, publishable key, price breakdown
  B->>H: SDK confirmPayment (card, or PayPal)
  H->>H: routing rule picks the processor
  H->>P: authorise
  alt PayPal
    H-->>B: redirect to PayPal
    B->>B: buyer returns to /order/:paymentId
  else no redirect needed
    H-->>B: result
  end
  B->>F: GET /api/payment?id=
  F->>H: GET /payments/{id}
  H-->>F: status
  F-->>B: mapped order state
  Note over B,F: Success is shown only after this server read. A redirect never proves payment.
```

**Idempotency.** Hyperswitch has no idempotency header on `POST /payments`,
so the browser's attempt id doubles as the `payment_id`. A duplicate submit,
refresh or second tab re-sends the same id. Hyperswitch rejects it with
`HE_01`, and the server reads the existing payment instead of creating a
second one: it resumes it if it's still unattempted and the amount matches,
and otherwise sends the buyer to the order page.

**Every Hyperswitch status is mapped**, all 17 of them, not only the four in
the quickstart. `requires_customer_action` and `processing` are their own
states, never failures. The order page polls the server for about 30 seconds
while a payment is in flight or its status is unrecognised (`unknown`), then
shows "Don't pay again yet" and a **Check again** button that only re-reads.

---

## Payment methods and routing

**The buyer chooses a payment method. Hyperswitch chooses the processor.** The
buyer only ever sees "Card" or "PayPal", and processors stay out of sight.

| Buyer chooses | Goes to | Why, for this marketplace |
| --- | --- | --- |
| **PayPal** | `paypal_test` | The buyer's choice, not a routing decision: it's the only connector with the PayPal wallet. Offered at every price, because collectors come from eBay and expect it |
| **Card, $500 or more** | `stripe_test` | The primary processor, every time. With retries refused there is no second attempt, so high-value slabs aren't used for experiments |
| **Card, under $500** | 80% `stripe_test` / 20% `fauxpay` | A challenger processor trialled against the incumbent, on orders where a failure costs a $40 sale rather than a one-of-one coin |
| No rule matches | `stripe_test` → `fauxpay` → `paypal_test` | Default fallback. `paypal_test` is last so a card payment never shows up as "PayPal" |

```mermaid
flowchart TD
  A["Buyer pays"] --> M{"Payment method?"}
  M -- "PayPal" --> PP["paypal_test<br/>(only eligible connector)"]
  M -- "Card" --> AMT{"amount in cents"}
  AMT -- "> 49999 ($500+)" --> ST["stripe_test"]
  AMT -- "< 50000" --> SPLIT{"volume split"}
  SPLIT -- "80%" --> ST
  SPLIT -- "20%" --> FP["fauxpay"]
```

**Why split small card payments at all.** A marketplace adds a second
processor for lower fees, negotiating leverage and outage cover, but it can't
judge one without sending it real traffic. The approval rate on *our* buyers
is the number that matters. The split gathers that data, and it's the first
step towards Auth Rate Based routing, which needs about 25 finished payments
per processor before it can score anything. Our prices decide where to run
the trial: most orders are small and most money sits in the few large ones,
so orders under $500 produce data quickly at little risk. We chose 80/20 over
50/50 because the point is to measure a challenger against the incumbent,
starting small.

**This is routing before an attempt, not retrying after one.** Auto Retries
was on by default (max 3). We switched it off, because re-sending a timed-out
$6,000 payment to a second processor can charge the buyer twice. Hyperswitch
reconciles the two attempts afterwards but can't un-charge the card.

**Verified against the live sandbox (2026-09-16):**

| Test | Result |
| --- | --- |
| $900 card, $500.00 card | `stripe_test` |
| 20 × $40 card | 12 `stripe_test`, 8 `fauxpay` |
| PayPal at $40 and at $900 | `paypal_test`, `requires_customer_action` with a redirect |
| `is_auto_retries_enabled` | `false` |

**What the sandbox can't show.** The processors are simulated and approve and
decline identically, so the build shows the routing *mechanism* but not one
processor genuinely out-approving another. Decline messages come from a
simulator, not a card issuer.

---

## Order and money lifecycle

Money moves when someone acts, not on a timer, so every transition is
something a reviewer can click.

```mermaid
stateDiagram-v2
  [*] --> Paid: payment succeeded
  Paid --> Shipped: seller marks shipped
  Shipped --> Received: buyer marks received
  Received --> [*]
  Shipped --> Disputed: buyer disputes
  Received --> Disputed: buyer disputes
  Disputed --> Refunded: admin refunds in full (real Hyperswitch refund)
  Refunded --> [*]

  note right of Paid
    seller balance: pending
  end note
  note right of Shipped
    seller balance: available,
    commission deducted
  end note
  note right of Refunded
    balance and commission reversed
  end note
```

The buyer is charged **item + shipping + sales tax** (a flat 8% on items) as
one payment. The seller is credited **item + shipping − commission** (5% of
items) later. The buyer never sees the commission and the seller never sees the
tax. A cart can span several sellers and is still **one payment**; each
seller's share is its own order. A refund returns **one seller's order in
full** (a partial refund of the payment), and that sale's commission and net
drop to zero.

---

## Decisions

| Decision | Why |
| --- | --- |
| **Unified Checkout SDK** | Card data never touches our code, and payment methods are a dashboard setting. Affirm was removed without a code change, and PayPal needed only a return URL passed to the SDK, which is the practical argument for an orchestrator |
| **Simulated processors, not real Stripe** | Real Stripe needs a support ticket for raw card data access, with unknown lead time. The simulators cover everything the core flow needs: distinct hard declines, a PayPal redirect, and three connectors to route between |
| **Capture immediately; the hold is a ledger, not an authorisation** | Card authorisations expire in about 7 days, and an individual seller ships when they reach the post office. The reversal tool is a refund, not a void |
| **Seller pays the commission, at release** | Nothing is added to a buyer's total after they've decided on a $1,800 item. A sale refunded before release never pays a fee |
| **Never auto-retry an ambiguous payment** | "Check again", not "Pay again". A double charge is worse than a lost sale |
| **One payment for a multi-seller cart, split per seller on our side** | Collectors buy from several sellers at once and expect to pay once, as on eBay and Etsy. One payment can't end half paid. Each seller's share ships, pays out and refunds on its own, so one seller's dispute never refunds another's sale |
| **No database; Hyperswitch is the read model** | No reconciliation story to explain. The limit: metadata isn't filterable in the v1 API, so order lists page through the last 90 days of payments (at most 2,000) and filter in memory. Measured: 1.3–2.0 s warm, 4.6–6.5 s on a cold first call. A KV index of order ids is the upgrade |
| **3DS out of scope for this build** | The dashboard default is untouched, but no challenge flow is built or tested. We're US-only, so it isn't a mandate. It would buy liability shift on stolen-card chargebacks, which matters on a $6,000 coin. It does nothing for "not as described" disputes, and we don't pretend it does |

### Hyperswitch features, and what we did with each

| Feature | Verdict |
| --- | --- |
| Unified Checkout, Payments, Refunds (one seller's order in full), Metadata update | **Built on** |
| Rule-based routing (amount + volume split) | **Configured**, verified |
| PayPal wallet | **Configured**, plus a return URL passed to the SDK |
| 3DS | **Out of scope**: dashboard default untouched, no challenge flow built or tested |
| Auto Retries / Smart Retries | **Turned off**, for the double-charge reason above |
| Auth Rate Based and elimination routing | **Deferred**: needs payment history and real processors |
| Least Cost (US debit) routing | **Deferred**: sandbox supports it through Adyen only |
| Webhooks | **Deferred**: nothing durable to write to and no stable URL, and every flow we build has the buyer present |
| Extended authorisation, overcapture, network tokenisation | **Off**: we capture straight away at a fixed amount and don't save cards |
| Surcharge | **Refused**: banned on debit, restricted in several states, and we earn through commission |

---

## Not built, with the approach

- **Affirm (pay later).** It fits the top of this market: a collector who
  wants a $6,000 slab now and pays over months. Affirm pays us up front and
  takes the credit risk, so our hold doesn't change. It's deferred because it
  adds a second redirect method with its own pending and declined-application
  states. *Approach:* enable Pay Later → Affirm on a connector (the sandbox's
  `stripe_test` already offers it), show it only above about $500, and confirm
  on the server exactly as for PayPal.
- **ACH bank debit.** It costs about $5 against about $174 in card fees on a
  $6,000 slab, but a consumer can return a debit as unauthorised for 60 days.
  *Approach:* only for buyers with a completed purchase, payout held until the
  debit clears, and the payment shown as `processing` meanwhile. Needs real
  Stripe.
- **Limiting PayPal where it hurts us.** Gold coins aren't covered by PayPal's
  buyer protection but can still be charged back to us. *Approach:* the server
  passes `allowed_payment_method_types` when it creates the payment (verified
  in the sandbox), so gold coins or large orders show cards only.
- **Real Stripe and real PayPal** behind the same routing rule. This changes
  dashboard configuration only, not code.
- **Auth Rate Based routing,** once about 25 real payments per processor
  exist. It's the next step after the 80/20 trial.
- **Apple and Google Pay.** They add speed, not protection, and Apple Pay
  needs a stable verified domain, which preview deployments don't have.
- **Seller payouts.** Stripe Connect separate charges and transfers, called
  when the seller ships. Hyperswitch's split payments only support
  direct/destination charges, which pay the seller too early.
- **3DS challenges, refunding part of one seller's order, soft declines on demand, and an
  abandoned PayPal payment** (the message exists; the flow isn't tested).
- **Webhooks, concurrency (two buyers racing for one item), carrier-confirmed
  release, authenticity checks, seller KYC, saved bank accounts and PayPal.**

**Known gaps in what is built**
- `update_metadata` returns a connector error (`IR_20`, seen on both
  `paypal_test` and `stripe_test`) even though the write lands, so every write
  is read back before the UI reports success.
- Order lists take 4.6–6.5 s on a cold first call (see the read-model decision
  above).

---

## Running it

Requires Node 20.19+ (Vite 8's minimum) and a Hyperswitch sandbox account with
the setup below.

```bash
npm install
cp .env.example .env   # secret key, publishable key, merchant id
npm run dev            # Vite serves the front end and api/ functions together
```

| Command | What it does |
| --- | --- |
| `npm run dev` | App and API functions locally (Vite middleware runs `api/`) |
| `npm run build` | Typecheck and production build |
| `npm run test:unit` | 39 money, cart, attempt-id and state-mapping tests. No keys needed |
| `npm run test:sandbox` | 21 tests that call the `api/` handlers against the live sandbox. Needs `.env`; skipped without the key. Creates real payments tagged `test` |
| `npm run e2e` | 11 Playwright tests in a real browser against the real sandbox. Needs `.env` and `npx playwright install chromium`; starts its own dev server on port 5190 |
| `npm run lint` / `npm run format` | oxlint / Prettier |

### Sandbox setup

1. **Connectors:** `stripe_test`, `fauxpay` and `paypal_test`, all with credit
   and debit cards. Enable Wallet → PayPal on `paypal_test` only.
2. **Default fallback order:** `stripe_test`, `fauxpay`, `paypal_test`.
3. **Workflow → Routing → Rule Based**, then activate it:
   - card AND amount < `50000` → volume split 80 `stripe_test` / 20 `fauxpay`
   - card AND amount > `49999` → priority `stripe_test`
   - Amounts are **cents**. There's no "greater than or equal", hence `49999`.
4. **Payment settings:** Auto Retries **off**, then save.

### Test cards

Any future expiry, any CVC. These cards behave the same on `stripe_test` and
`fauxpay`, so routing doesn't change the result.

| Case | Card | Buyer sees |
| --- | --- | --- |
| Success | `4242 4242 4242 4242` | Paid |
| Declined | `4000 0000 0000 0002` | "Your bank declined this payment." |
| Lost / stolen | `4000 0000 0000 9987` / `…9979` | "Your bank declined this card." |
| PayPal | PayPal button | Redirect to simulated PayPal, then back |

A soft decline (`4000 0000 0000 9995`) can't be shown on demand: it succeeds on
`stripe_test` and only fails on `fauxpay`, which routing reaches at random.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · Vercel Functions (standard
`Request`/`Response`) · `@juspay-tech/react-hyper-js` · Vitest · Playwright.
`vercel.json` sends every path except `/api/*` to the SPA. Set the same `.env`
keys in Vercel's project settings to deploy.
