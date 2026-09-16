# Plan

Product owns this document. Design and engineering propose; product decides;
the user signs off.

Status: **Framing — awaiting sign-off on sections 1–4.**

The brief: build a minimal storefront for one industry that takes a user from
the purchase journey through to a real, completed payment in the Hyperswitch
sandbox. The goal is to make it obvious that Hyperswitch is doing something
meaningful, not to build Etsy.

> **Scope note.** `CLAUDE.md` says "core flow only". The user has since widened
> scope to include refunds, webhooks, a seller dashboard and an admin view, so
> that the marketplace payment model is demonstrable end to end. That direction
> supersedes the rule, and section 2 is the authority on what gets built.

---

## 1. Framing

### Vertical

A **peer-to-peer marketplace for US coins and trading cards** — eBay and
Facebook Marketplace, scoped down. Buy-it-now only. Prices from $20 to $6,000
in the same catalogue.

**A buyer and a seller are two different people, but any user can be either.**
The same account lists and buys. There is no separate seller account type.

### How money moves

```
Buyer ──pays──> Marketplace ──holds──> (ships directly) ──releases──> Seller
                     │                                                   │
                     └── commission ──> Marketplace      payout ─────────┘
                     └── sales tax ───> State            to PayPal / bank
```

The buyer pays us. We hold the funds. The **seller ships directly to the
buyer**. Funds release to the seller after an inspection window, minus our
commission. Sale proceeds leave the platform to an **external payout
instrument** — PayPal or a bank account. There is no spendable platform wallet,
so a dual-role user buying something pays by card like anyone else.

### What payments have to get right here

1. **The money is held across a post-ship inspection window, and that window is
   the product.** Buyer pays, item ships, buyer gets time to check it, seller
   gets paid. Capture timing, refund policy and payout timing are one question
   about who carries risk across that window. Everything structural below
   descends from it — capturing immediately, escrow as a ledger, refunds as the
   reversal tool, and holding funds as the only enforcement lever we have.

2. **The payment method decides who carries the risk, so the mix is a risk
   choice.** PayPal's buyer protection names counterfeit and misrepresented
   condition — which is why buyers want it, and why it would cost us most
   (§4). Bank debit has a 60-day consumer reversal window. Wallets carry no
   protection of their own.

3. **Inventory is one-of-one, so availability is real-time.** Two buyers on one
   listing is normal, not an edge case. One of them loses; the only question is
   whether they lose before or after entering card details.

4. **One checkout serves a $20 and a $6,000 decision.** Below a few hundred
   dollars friction reads as suspicion; above it the buyer *wants* to slow
   down. Same guarantee, different weight — a threshold in the price data.

5. **Retry safety outranks the conversion it costs.** An ambiguous payment
   retried automatically can charge one individual twice for another
   individual's coin. We trade recovered conversion for never creating a
   duplicate charge we cannot cleanly reverse.

6. **Authenticity is real, and it is a fulfilment problem.** The industry answer
   is eBay's Authenticity Guarantee — a third-party authenticator in the
   shipping path. **Out of scope.** Its one payments consequence, worth noting:
   it would convert our release trigger from a timer into a verdict.

---

## 2. What we build

Seeded with **~10 sellers and ~30 listings**. Three role views behind a
dropdown — a demo device, not auth.

### Buyer

| Piece | Contents |
| --- | --- |
| **Home / listings** | Grid of listings, search. Price, photo, seller, grade |
| **Product page** | Photos, price, seller, grade + cert number, quantity, **Buy now** (primary) / Add to cart |
| **Cart** | Items grouped by seller, subtotal, tax, total |
| **Checkout** | Customer info, Hyperswitch Unified Checkout SDK, order summary |
| **Order confirmation** | Status, order id, amount, escrow timeline |
| **Orders** | Past orders with payment status and any refund |

### Seller

| Piece | Contents |
| --- | --- |
| **Dashboard** | Orders, gross revenue, commission, net, amount pending |
| **Order detail** | Sale, fee, net, balance state, mark as shipped |
| **Payouts** | Balance state and payout status — read-only, no money moves |

### Admin

| Piece | Contents |
| --- | --- |
| **Transactions** | Every payment, status, seller, amount, fee |
| **Payment detail** | Full status, attempts, decline reason, raw-ish view |
| **Refund** | Issue a full or partial refund against a payment |

### What Hyperswitch must visibly do

The prototype is judged on these being demonstrable:

- ✅ **Payment creation** — server-side, secret key never in the browser
- ✅ **Successful payment** — real `succeeded` in the sandbox dashboard
- ✅ **Failed payment** — hard and soft declines, with normalised reasons
- ✅ **Payment status** — authoritative server-side read, never the redirect
- ✅ **Refund** — full and partial, from the admin view
- ✅ **Webhook** — signature-verified, updating the order
- ✅ **Marketplace fee calculation** — visible on the seller dashboard
- ✅ **Seller balance and payout state** — pending → available → paid out

### Out of scope

Seller onboarding, KYC, shipping and tracking integration, messaging, reviews,
auctions, offers, saved cards, wallets and PayPal as live methods, real
payouts, disputes, ACH, promoted listings, seller subscriptions, real auth.

Each of the payments-relevant ones has a written approach in §4 or §6.

---

## 3. The money model

### Two sums, computed separately

**The buyer is charged** — one amount, one payment intent:

```
  item price        $1,800.00    seller sets it, server reads it
+ shipping             $12.00
+ sales tax            $XX.XX    destination state, we collect and remit
= charged          $1,8XX.XX     sent to Hyperswitch, in cents
```

**The seller is credited** — separately, and later:

```
  item price        $1,800.00
+ shipping             $12.00
− commission          −$90.00    taken at release, not at capture
= net              $1,722.00     queued for payout
```

The buyer never sees the commission; the seller never sees the tax. Three
destinations, not two: seller net, our commission, and tax to a state. **Tax is
never inside the commission base** — we do not take a cut of tax.

All three are computed **server-side from the server's own price data**. The
client sends listing ids and a destination; never a price, a tax figure or a fee.

### Seller balance states

```
pending ──window closes──> available ──payout──> paid_out
   │                            │
   └──claim opened──> held      └──refund after payout──> negative
```

`paid_out` is the point of no return — the money is in someone's bank. Every
state upstream of it we control, which is why **holding funds is the only
enforcement lever that works**, and why the release trigger matters more than
the payout mechanics.

The commission is deducted at the `pending → available` transition, as its own
ledger entry. A sale refunded before release therefore never charges a fee at
all, and refunding a released sale reverses **two** entries — the seller's net
and our fee — or we quietly keep commission on a sale that unwound.

---

## 4. Decisions and trade-offs

Each: the call, the reason, and what would change our mind.

### Integration

**Unified Checkout SDK**, not Payment Links or a raw card form. Card data never
touches our code or PCI scope, and payment methods become a business-profile
setting rather than a code change — which is the honest argument for using an
orchestrator at all. Payment Links would hand the buyer to an unfamiliar domain
at the exact moment trust matters most. *Changes our mind:* nothing at this
scope.

**Dummy connector, cards only.** Wallets and PayPal cannot be demoed — the
dummy connector cannot mint wallet session tokens. Chasing a real connector
would cost an Apple Developer enrolment, a verified domain and a Google
test-user group before a single payment succeeded. *Changes our mind:* see the
connector ranking in §6 — Stripe sandbox is a 30-minute change if we want it.

### Money movement

**Capture immediately; escrow is a ledger, not an authorisation hold.** The
textbook answer for delayed fulfilment is auth-now-capture-on-ship. It is wrong
here: card auths decay in roughly 7 days and an individual seller ships when
they reach the post office, so auths would routinely expire before the item
moved — turning "slow seller" into "the buyer's payment silently died". We
capture and hold against a balance we control, and the reversal tool is a
refund, not a void. *Changes our mind:* professional sellers with SLA'd
dispatch.

**One payment intent per seller, never one split intent.** A split intent
cannot represent partial failure, and partial failure is the normal case.
More fundamentally, **processor-level splitting is incompatible with escrow**:
if the processor routes the seller's share at capture, there is nothing left to
hold. You can have the split or the hold, not both. eBay's combined cart
creates separate orders for the same reason. *Changes our mind:* if we stopped
holding funds entirely.

**Commission is paid by the seller, deducted at release.** The buyer is charged
the listing price plus tax — nothing added at checkout, because a fee appearing
after someone decided on a $1,800 item is the highest-abandonment moment in the
funnel, and it is the same mistake as surcharging (§6). Taking it at release
also makes refunds clean: a refund before release simply never charges it.
Matches how eBay and Depop treat final-value fees.

**Sales tax is computed server-side and sits outside the commission base.**
Marketplace-facilitator rules make us the collecting party. Flat rate per
destination state from a constant table; a real build uses Avalara or TaxJar.

**Hold length is a fraud-and-friction trade-off, not a hedge.** Our 14-day
window covers no reversal window that matters — 60 calendar days for an
unauthorised consumer ACH return, months for card disputes. We say so plainly
rather than implying the hold makes us safe. It is also the argument for
holding longer on a $6,000 coin than on a $20 card.

**A negative balance blocks payouts, not selling or buying.** Selling is how
they repay. The balance is a queue of money waiting to leave, not a wallet, so
the only lever is intercepting proceeds before they leave: recover from the
next sale's `pending`, disclosed on the order line. We deliberately do **not**
net a selling debt against their next purchase — that makes us an involuntary
creditor, and it isn't even mechanically available, since a buyer's card and a
seller's payout destination never meet. Uncollectable if they never sell again;
the real answers (payout holds on linked accounts, collections, KYC at first
payout) are out of scope.

### Correctness

**Idempotency via a client-generated attempt id used as the `payment_id`.**
Hyperswitch has **no idempotency header** on `POST /payments`; the documented
mechanism is the merchant-supplied `payment_id` (≤30 chars), and a duplicate
returns an `HE_01` **error**, not a replay. The browser generates one id per
seller group and stores it *before* the fetch; `HE_01` means "go read the
existing payment". Mechanism in §5.

**Never auto-retry an ambiguous payment — "Check again", not "Pay again".** A
timeout is not a failure; it is `unknown`, and `unknown` resolves by reading. A
double charge between two individuals is unrecoverable by reassurance and is
worse than a lost sale.

**Availability is real-time and optimistic, not reserved.** A 1–2 minute
checkout lock would genuinely be better — it covers the 30–90 second window
where the race actually hurts — but it needs durable shared state, and Vercel
functions are stateless and multi-instance. An in-memory lock would work in
development and fail silently across instances in production, which is worse
than no lock. So: a **hard server-side guard at intent creation** (the real
guarantee), revalidation at cart-open, checkout-open and pre-create, the
listing leaving active inventory the instant a payment succeeds, and a designed
"sold — removed" state rather than an error. Nobody is ever charged for a sold
item. *Changes our mind:* a database.

**No database — Hyperswitch is the read model.** Orders, seller sales and
refund state are derived by querying Hyperswitch rather than duplicated into
our own tables, so there is no reconciliation problem to explain. The seeded
demo's entire payment volume fits in a single 100-item page. See §5 for the
verified limits and the honest ceiling.

### Method mix, if we were choosing for production

**PayPal, then bank debit; wallets last.** PayPal is what buyers want here —
Purchase Protection names *"advertised as authentic but is not authentic"* and
*"the condition of the item was misrepresented"*. It is also where we would
carry the most risk, for exactly the same reason: **PayPal's Seller Protection
covers unauthorised and item-not-received claims only, and excludes
not-as-described entirely.** As merchant of record *we* are the seller in
PayPal's eyes — the buyer pays our account, the dispute names our account, the
individual shipper is invisible. So the dispute class this vertical generates
most is the one where we have no cover. It is also a **parallel dispute channel
that outranks our own**: a buyer need not exhaust our process, PayPal holds the
funds during investigation and decides in its sole discretion. Worth accepting
for conversion — knowingly, not by accident.

Category trap: there is **no** coins/cards exclusion, but the ineligible list
does exclude *gold in physical or exchange-traded form*, *investments of any
kind*, and *items intended for resale*. Gold coins are unprotected for the
buyer while remaining fully chargeable back to us.

**Bank debit** is the only rail where a hold can outrun the risk — a 60-day
unauthorised consumer return window, versus two banking days for insufficient
funds. Interchange also becomes a real cost line at $6,000. **Plaid verifies,
it does not move money**: Auth returns account and routing numbers for a
separate processor to originate the debit, so "pay with Plaid" is a misnomer.

**Wallets add speed, not safety.** Apple's own terms say it is not a financial
institution and that users look solely to their card issuer to resolve
disputes. A tokenised card charges back exactly like the plastic.

---

## 5. Architecture

### Endpoints

| Endpoint | Does | Secrets |
| --- | --- | --- |
| `POST /api/checkout` | Validates listings, confirms one seller, checks availability, computes amount **server-side**, creates the intent | secret key |
| `GET /api/payment?id=` | The authoritative status read, after the SDK and after redirect. Returns a projection, never the raw body | secret key |
| `POST /api/refund` | Full or partial refund against a payment, from the admin view | secret key |
| `GET /api/orders?…` | Buyer orders (by customer) or seller sales (see read model) | secret key |
| `POST /api/webhook` | Verifies `X-Webhook-Signature-512`, then triggers a re-read | hash key |

No catalogue, cart or auth endpoint. The catalogue is a shared TS constant —
the client renders from it, the server prices from it. The cart is listing ids
in `localStorage`, and a list of ids is not money. Sign-in is a mocked role
switcher.

### Sequence of a successful payment

1. Buyer clicks Pay. The browser generates `attemptId` and stores it **before**
   the fetch.
2. → `POST /api/checkout` with listing ids, quantities, ship-to. **No amount.**
3. Server validates availability, confirms one seller, computes
   `Σ(price × qty) + shipping + tax`. Unknown id → 400.
4. Server → Hyperswitch `POST /payments` with `payment_id: attemptId`,
   `capture_method: "automatic"`, `confirm: false`, and `metadata: { sellerId,
   listingIds }`.
5. → browser: `{ paymentId, clientSecret, publishableKey, amount }`. The
   browser learns the amount from the server, never the reverse.
6. SDK mounts; PAN and CVV stay inside its iframe. Buyer submits; the SDK
   confirms directly with Hyperswitch, redirecting for 3DS.
7. Browser lands on confirmation holding the `attemptId`. It does **not** use
   the SDK's client-side retrieve to decide anything.
8. → `GET /api/payment` → server → Hyperswitch → mapped order state. Only
   `paid` clears the cart group.

### Payment state machine

`IntentStatus` has **17 values, not the four the quickstart shows.** All are
mapped; an unrecognised value maps to `unknown`, never to failure.

| Hyperswitch | Our state | Terminal |
| --- | --- | --- |
| `requires_payment_method`, `requires_confirmation` | `awaiting_payment` | no |
| `requires_customer_action` | `action_required` — render `next_action`, never call it failed | no |
| `processing` | `pending` — "we'll email you", explicit permission to leave | no |
| `succeeded` | `paid` — write the ledger entry | yes |
| `failed` | `failed` — normalised decline copy | yes |
| `cancelled` / `cancelled_post_capture` | `cancelled` / `refunded` | yes |
| `requires_capture` | `authorized_unexpected` — we never set manual capture, so this is config drift | no |
| the four `partially_*` | `paid_partial` — operator alert, do not ship | mixed |
| `requires_merchant_action`, `review`, `conflicted` | `review` — never auto-resolve | no |
| `expired` | `failed` — new attempt id | yes |

**Two traps.** A **fully refunded payment still reads `succeeded`** — refund
state must come from `/refunds/list`, never inferred from the payment. And the
dummy connector's capture accounting is documented as unfaithful, so we never
assert exact settled amounts from sandbox responses.

### Idempotency

Generated in the browser on Pay, written to `localStorage` **before** the
fetch. Format `cka_` + 22 hex chars = 26, inside the 30-char limit.

**Reused** for every retransmission of the same intent — duplicate submit,
network timeout, refresh, second tab, back button. Two tabs converge because
`localStorage` is shared per origin. **Regenerated** for a new seller group, a
cart edit, or any retry after terminal `failed`/`expired` — a failed intent
cannot be re-driven, so reusing the id there would lock the buyer out of that
cart permanently.

```
POST /api/checkout:
  amount = priceFromServerCatalogue(items)          # never from the client
  res = hyperswitch.createPayment({ payment_id: attemptId, amount, ... })
  if res.ok:  return { clientSecret: res.client_secret, ... }
  if res.error.code == "HE_01":                     # already exists
      existing = hyperswitch.getPayment(attemptId)
      if existing.amount != amount:   return 409    # cart changed under a live intent
      if isTerminal(existing.status): return 409 CONFLICT_SPENT
      return { clientSecret: existing.client_secret, ... }
  return 502
```

**What it does not protect against:** `HE_01` is duplicate *detection*, not
response *replay*, so the recovery path is code we own and can get wrong.
Clearing site data mid-payment orphans the intent. Two devices, same cart,
produce two ids and two charges. **A database closes all three** — a
server-owned attempt row keyed on (user, seller group, cart hash) would survive
the browser entirely. That is the upgrade path.

### The read model — Hyperswitch instead of a database

Verified against the v1 OpenAPI spec and the router source:

- **Buyer orders** — `GET /payments/list?customer_id=…` works with an api key.
- **Refund state** — `POST /refunds/list { payment_id }` works with an api key.
- **Seller sales** — **no.** `metadata` is not filterable *anywhere* in v1, and
  the richer `POST /payments/list` is JWT-only, so an api key cannot reach it.
  Aggregate endpoints return status counts only, never sums.

So seller-scoped queries page through payments (cursor, ≤100 per page) and
filter on `metadata.sellerId` **in memory**. For a demo seeded with 10 sellers
and 30 listings, the entire payment volume fits in one page.

```
// ponytail: fetch-all-then-filter for seller sales — Hyperswitch cannot filter
// on metadata (v1). Fine at demo volume, O(all payments) per view beyond it.
// Upgrade: Vercel KV storing sellerId -> [payment_id] only, never amounts.
```

The upgrade deliberately stores **only** the id mapping, never money.
Hyperswitch stays authoritative for status and amount, so there is no
reconciliation story to explain to a reviewer.

### Webhooks, statelessly

Read the raw body with `request.text()` — **never** `request.json()` first, or
the bytes hashed are not the bytes signed — then HMAC-SHA512 keyed on the
profile's `payment_response_hash_key`, compared in constant time against
`X-Webhook-Signature-512`.

With nothing stored, the webhook treats its payload as a **hint** and re-reads
`GET /payments/{id}`. Duplicate deliveries are harmless because the read is
idempotent. If no browser is connected the event is simply discarded and the
user sees the new state on next load — acceptable for a prototype, and the
honest limitation to state. We still verify the signature: an unverified
receiver is a free way to make our own server hammer Hyperswitch.

### Security boundaries

`HYPERSWITCH_API_KEY` lives in `.env` and Vercel settings, read only inside
`api/`, with **no `VITE_` prefix** — Vite inlines `VITE_*` into the bundle, so
the prefix is the whole attack.

**The amount is server-authoritative.** Trusted from the client: the attempt id
(an opaque selector — it chooses which intent, it cannot change what it costs),
listing ids, bounded quantity, shipping address. Never read from the body: any
amount, currency, `sellerId`, fee or discount.

**Reviewer checklist:** `grep -r "VITE_" api/` returns nothing; the secret key
does not appear in `dist/`; `/api/checkout`'s request type has no `amount`; no
card field name appears in `src/`; confirmation is driven by `GET /api/payment`,
not by the redirect query string.

---

## 6. What we take from Hyperswitch

| Capability | Verdict |
| --- | --- |
| **Unified Checkout SDK** | **Build.** `layout: "tabs"`, `appearance.variables` themed to the marketplace. Note what it does *not* render — line items, seller identity, grade — that context is our page, and it is what earns the click |
| **SDK surface** | **Build.** Three defaults need care: `redirect` defaults to `if_required`, so the success path *sometimes* leaves the page; `retrievePaymentIntent()` is client-side and we call it never; `authentication_type` defaults to `three_ds` server-side |
| **Webhooks** | **Build.** Signature-verified, stateless, triggers a re-read |
| **Refunds** | **Build.** `POST /refunds` with our own `refund_id` as the idempotency key; partials repeat until the original amount is exhausted |
| **3DS** | **Configure only.** Leave the `three_ds` default |
| **Vault** | **Defer.** Pay-Then-Vault, `on_session` |
| **Smart Retries** | **Refused.** See below |
| **Intelligent Routing** | **Defer.** Auth-rate routing genuinely pays at a $6,000 AOV, but every rule is a no-op with one connector |
| **FRM** | **Defer.** Post-auth Signifyd/Riskified with a `review` hold is the right shape; needs a commercial contract |
| **Surcharge** | **Refused.** Capped by network rules, banned on debit, restricted in several US states — and we monetise by commission, not by taxing the buyer at the worst moment |
| **Payment Experience / Workflows** | **Not relevant.** An enum the SDK consumes for us, and a docs umbrella over the five above |

### Pay-Then-Vault, not Vault-Then-Pay

Pay-Then-Vault charges first and stores the instrument as a side effect
(`setup_future_usage` + `customer_acceptance`, which the widget sends when the
shopper ticks save-card). Vault-Then-Pay stores first via a zero-amount
authorisation and charges later.

Buy Now means **the amount is known at intent time**, so vault-then-pay's whole
advantage is inert. `on_session`, never `off_session` — we never charge a buyer
who isn't present, and claiming consent we don't use is over-reach. One trap
our dual-role model creates: a seller's payout instrument must never be
conflated with a buyer's saved card, even though both hang off one identity.

### 3DS buys liability shift, and nothing else we face

SCA is a PSD2 mandate and does not apply to us. 3DS here means one thing:
fraudulent-transaction chargebacks — *"I didn't authorise this"* — move to the
issuer. It does **not** cover not-as-described. The buyer who says the coin is
cleaned authorised the payment perfectly well.

So we keep the default because a stolen-card chargeback on a $6,000 coin moving
to the issuer is worth the friction, and we state plainly that **this build has
no dispute strategy**, rather than dressing 3DS up as one.

### Smart Retries is the one feature we actively refuse

It retries across connectors, keeping one `payment_id` but **appending the
attempt number before the processor sees it** — so connector A gets `pay_x_1`
and connector B gets `pay_x_2`, two distinct ids, and connector-side idempotency
won't dedupe them either.

Retrying a hard decline is safe: the issuer said no, nothing moved. Retrying a
**timeout** is not, and "system malfunction" and "processing temporarily
unavailable" are exactly that category. Hyperswitch's claim of "proper
reconciliation despite multiple processor attempts" is a **reconciliation**
property, not network-level idempotency — it can tell us afterwards that both
charges belong to one payment; it cannot un-charge the card.

That is the same hazard our own rule names. We leave it off deliberately, and
say so.

### Connectors, ranked by value-per-hour

| Rank | Connector | Setup |
| --- | --- | --- |
| 1 | **Stripe sandbox (cards)** — the only one that changes what the architecture can *prove*: real normalised decline codes, real 3DS, faithful capture accounting | ~30 min |
| 2 | **PayPal sandbox** — a genuinely different code path (`redirect_to_url`), and buyer trust matters disproportionately here | ~1–2 h |
| 3 | **Google Pay** — same lifecycle, prettier button | ~2–3 h |
| 4 | **Apple Pay** — domain verification is fatal on rotating preview URLs | ~4–8 h + enrolment |
| — | **Link** — **not supported.** Absent from Hyperswitch's payment-method, connector and routable-connector enums; the generic `link_wallet` *experience* is a different thing | — |

---

## 7. States and edge cases

### Checkout states

| State | Buyer sees | Money at risk |
| --- | --- | --- |
| Submitting | Form locked, no navigation | Not yet charged |
| 3DS in flight | "Your bank needs to confirm it's you. You'll come right back." | Held |
| Returned, unconfirmed | "Confirming your payment…" while the **server** polls | Unknown to them, known to us |
| Processing | "Payment sent — waiting on your bank. You don't need to do anything." | Committed |
| Soft decline | Inline, everything retained except the card, focus on the named field | No |
| Hard decline | Retry suppressed for that card, "try a different card" | No |
| **Unknown** | "We're not sure whether that went through. **Don't pay again yet.**" Copyable reference, then a **Check again** button that re-reads and can never create a second charge | Unknown |
| Succeeded | Confirmation + escrow timeline | Held, protected |

Decline copy follows one shape: **what happened without blame → why, if useful
→ the one next action.** A deliberate asymmetry — bank declines say *"your
bank"* (true, and it moves blame off both the buyer and us); our failures say
*"we"* and lead with *"nothing has been charged"*. Owning our own failures is
what buys credibility when we say the bank did it. Raw codes are logged, never
printed.

### Edge cases

| Case | What happens |
| --- | --- |
| **Sold while they were looking** (the normal case) | Server refuses to create an intent for a sold listing. Line greys out, "Sold — removed", totals recalculate, similar items offered |
| Price changed | Server prices from its own data regardless; buyer must confirm the new price |
| Listing withdrawn mid-checkout | Cancel the intent if still open. If already `succeeded`, do **not** cancel — it is a paid order, route to refund. The race resolves in the buyer's favour |
| **Buying your own listing** | No buy button; checked at render *and* at intent creation. Filtering it silently out of search would be worse — sellers look for their own listing to check it's live |
| Two tabs, same cart | Shared `localStorage` attempt id converges both on one intent |
| Refund before vs after release | Before: reverse the ledger entry, no fee charged. After: refund anyway, balance goes negative |
| Signed out mid-checkout | Cart persists; any open intent is reconciled on return |

### Empty states

Each states a **fact about how this marketplace works** rather than an apology
— which is what stops them reading as placeholder text.

| State | The fact | Action |
| --- | --- | --- |
| No search results | "Try searching by cert number." Real listings shown below — never a bare page | Clear filters |
| Empty cart | "Every listing here is one of one." | Browse |
| No listings yet | "Graded coins and slabbed cards sell fastest." | Create a listing |
| No orders yet | "Your payment is held until you've received the item and checked it." | Browse |
| No sales yet | "When someone buys, you ship directly and we release funds after their inspection window." | List an item |
| Zero balance | Strip: Sold → Held → Available | List an item; Withdraw disabled |

---

## 8. Execution

**Order of work — thinnest path to a real payment first:**

1. Catalogue constant, seeded with 10 sellers and 30 listings
2. `POST /api/checkout` → SDK mount → `GET /api/payment` → confirmation
   *(this is the whole grade; everything else is around it)*
3. Failure, pending and ambiguous states
4. Browse, search, product page, cart
5. Seller dashboard — fee calculation and balance states
6. Admin — transactions and refund
7. Webhook receiver
8. Role switcher, empty states, polish

**Definition of done:** a payment id showing `succeeded` in the Hyperswitch
sandbox dashboard; a failed payment with a normalised decline reason; a refund
visible against that payment; a signature-verified webhook updating an order;
the fee and seller balance visible on the dashboard; the states in §5 handled;
README written; deployed on Vercel.

**Risks:** sandbox connector setup; the dummy connector's unfaithful capture
accounting; no verified test card that forces a sticky `processing`, so that
state may need exercising another way; webhook delivery to a preview URL.
