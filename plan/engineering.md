# Engineering plan

Owner: engineering. Product decisions live in [product.md](product.md); this is
how they are built. Every Hyperswitch claim here was verified against the v1
OpenAPI spec, the router source, or the docs.

---

## 1. Stack and endpoints

Vite · React 19 · TypeScript · Tailwind v4 · Vercel Functions (standard
Request/Response).

| Endpoint | Does | Secrets |
| --- | --- | --- |
| `POST /api/checkout` | Validates listings, confirms one seller, checks availability, computes the amount **server-side**, creates the intent | secret key |
| `GET /api/payment?id=` | The authoritative status read. Returns a projection, never the raw body | secret key |
| `POST /api/order-state` | Records **mark as shipped / received / disputed** into the payment's metadata | secret key |
| `POST /api/refund` | Full or partial refund against a payment | secret key |
| `GET /api/orders` | Buyer orders, or seller sales (see read model) | secret key |

**No catalogue, cart or auth endpoint.** The catalogue is a shared TypeScript
constant — the client renders from it, the server prices from it. The cart is
listing ids in `localStorage`, and a list of ids is not money. Sign-in is a
mocked role switcher.

---

## 2. Sequence of a successful payment

1. Buyer clicks Pay. The browser generates `attemptId` and stores it **before**
   the fetch.
2. → `POST /api/checkout` with listing ids, quantities, ship-to. **No amount.**
3. Server validates availability, confirms one seller, computes
   `Σ(price × qty) + shipping + tax`. Unknown id → 400.
4. Server → Hyperswitch `POST /payments` with `payment_id: attemptId`,
   `capture_method: "automatic"`, `confirm: false`, `metadata: { sellerId,
   listingIds }`.
5. → browser: `{ paymentId, clientSecret, publishableKey, amount }`. The
   browser learns the amount from the server, never the reverse.
6. SDK mounts; PAN and CVV stay inside its iframe. The SDK confirms directly
   with Hyperswitch, redirecting for 3DS.
7. Browser lands on confirmation holding the `attemptId`. It does **not** use
   the SDK's client-side retrieve to decide anything.
8. → `GET /api/payment` → server → Hyperswitch → mapped order state. Only
   `paid` clears the cart group.

---

## 3. Fulfilment state — inside Hyperswitch, not a database

Shipped, received and disputed are *our* state; Hyperswitch knows only
`succeeded` and `refunded`. We keep them in the payment's own metadata rather
than in a database or `localStorage`, so there is one source of truth and
nothing to reconcile.

**`POST /payments/{payment_id}/update_metadata`**, secret key, body
`{ "metadata": { "fulfilment": "shipped" } }`. Verified in the router source:
its status allow-list names `Succeeded` explicitly, alongside `Failed`,
`RequiresCapture` and the `PartiallyCaptured` pair. The general
`POST /payments/{id}` update is pre-confirmation only — it is the dedicated
metadata route that escapes that guard. Metadata comes back on
`GET /payments/{id}`, so the loop closes.

Two constraints that shape the schema:

- **The merge is shallow** — a top-level key extend, so nested objects are
  overwritten wholesale. Fulfilment flags stay **flat top-level keys**
  (`fulfilment`, `shippedAt`, `disputedAt`), never a nested object.
- Limits are 50 keys, 40-char names, 500-char values. We use five.

```
paid ──seller──► shipped ──buyer──► received
                    │
                    └──buyer──► disputed ──admin──► refunded
```

`shipped` is what makes the seller's balance `available`; the balance is
derived from this flag plus the payment status, never stored separately.

### Verified against the live sandbox, and it needs a workaround

Probed on a real `succeeded` payment (`paypal_test` connector). The write
**always lands**, and the shallow merge behaves as documented — `fulfilment`
moved `shipped → received` and `receivedAt` was added while `sellerId` and
`listingIds` survived untouched. But the call returns:

```
HTTP 400  {"error":{"type":"connector","code":"CE_00",
           "message":"IR_20: Update metadata is not implemented for this connector",
           "connector":"paypal_test"}}
```

Hyperswitch merges metadata into its own payment intent **first**, then tries
to propagate it to the processor. The dummy connector does not implement that
second step, so the call reports failure after the part we depend on has
already succeeded.

Every connector in the build is simulated, so expect this on all of them. (A
real Stripe connector implements metadata update and would not return it.)

**So: write, then verify by reading.** `POST /update_metadata`, treat
`CE_00` / `IR_20` as non-fatal, then `GET /payments/{id}` and confirm the value
actually landed before reporting success to the UI. Any other error is fatal.

We are not trusting the 400 — we are trusting the read-back, which is the same
principle this build already applies everywhere else: *a redirect does not
prove payment, and neither does a 2xx.* Cost is one extra GET per action.

For the record: the general `POST /payments/{id}` is hard-blocked post-success
with `IR_16 — you cannot update this payment because it has status succeeded`,
so `/update_metadata` really is the only door.

---

## 4. Payment state machine

`IntentStatus` has **17 values, not the four the quickstart shows.** All are
mapped; an unrecognised value maps to `unknown`, never to failure.

| Hyperswitch | Our state | Terminal |
| --- | --- | --- |
| `requires_payment_method`, `requires_confirmation` | `awaiting_payment` | no |
| `requires_customer_action` | `action_required` — render `next_action` | no |
| `processing` | `pending` | no |
| `succeeded` | `paid` | yes |
| `failed` | `failed` | yes |
| `cancelled` / `cancelled_post_capture` | `cancelled` / `refunded` | yes |
| `requires_capture` | `authorized_unexpected` — we never set manual capture, so this means config drift | no |
| the four `partially_*` | `paid_partial` — surfaced as review, order blocked, never auto-resolved | mixed |
| `requires_merchant_action`, `review`, `conflicted` | `review` — surfaced in admin, never auto-resolved | no |
| `expired` | `failed` | yes |

**Two traps.** A **fully refunded payment still reads `succeeded`** — refund
state must come from `/refunds/list`, never inferred from the payment. And the
dummy connector's capture accounting is documented as unfaithful, so we never
assert exact settled amounts from sandbox responses.

---

## 5. Idempotency

Hyperswitch has **no idempotency header** on `POST /payments`. The documented
mechanism is the merchant-supplied `payment_id` (≤30 chars), and a duplicate
returns an `HE_01` **error**, not a replay.

Generated in the browser on Pay, written to `localStorage` **before** the
fetch. Format `cka_` + 22 hex chars = 26 characters.

**Reused** for every retransmission of the same intent — duplicate submit,
timeout, refresh, second tab, back button. Two tabs converge because
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
response *replay*, so the recovery path is code we own. Clearing site data
mid-payment orphans the intent. Two devices, same cart, produce two charges.
A database closes all three; that is the upgrade path.

**Retry semantics.** We retry idempotent reads only, three attempts with
backoff. We never retry `POST /payments` on timeout — we re-send the same
`payment_id`, which is a resume, not a retry — and never blind-confirm twice.
A timeout is `unknown`, and `unknown` resolves by reading.

---

## 6. Availability

**Concurrency is out of scope.** No reservations, no locks, no revalidation
passes, and listings do not go out of stock. `/api/checkout` validates only
that every listing id exists — which it must do anyway to price the order.

The reasoning, for the record. A reservation is the right answer and needs
durable shared state; Vercel functions are stateless and multi-instance, so an
in-memory lock would work in development and fail silently across instances in
production. The alternative is an optimistic guard at intent creation. Either
way the two-buyer race is not observable in a single-browser prototype — an
item can only be bought out from under you by you — so building the machinery
would mean writing code no reviewer can exercise. A production build needs the
guard at minimum, and a reservation once there is a database.

---

## 7. The read model — Hyperswitch instead of a database

Verified: **`metadata` is not filterable anywhere in v1**, and the richer
`POST /payments/list` is JWT-only, so an api key cannot reach it. Aggregates
return status counts, never sums.

- **Buyer orders** — `GET /payments/list?customer_id=…` ✅
- **Refund state** — `POST /refunds/list { payment_id }` ✅
- **Seller sales** — ❌ no server-side filter. Page through payments (cursor,
  ≤100/page) and filter on `metadata.sellerId` in memory.

At demo volume the entire payment history fits in one page.

```
// ponytail: fetch-all-then-filter for seller sales — Hyperswitch cannot filter
// on metadata (v1). Fine at demo volume, O(all payments) per view beyond it.
// Upgrade: Vercel KV storing sellerId -> [payment_id] only, never amounts.
```

The upgrade stores **only** the id mapping, never money, so Hyperswitch stays
authoritative and there is no reconciliation story to explain.

---

## 8. Webhooks — out of scope

Cut, because a receiver we could build could not demonstrate what webhooks are
*for*. With no durable storage an event arriving while no browser is connected
is simply discarded, and delivery needs a stable public URL that a
per-push preview deployment does not have. We would have been verifying the
signature of an event nobody could watch arrive.

**The approach, for the record.** `X-Webhook-Signature-512`: HMAC-SHA512 over
the **raw body**, keyed on the business profile's `payment_response_hash_key`,
compared in constant time. The trap is reading the body — `request.text()`
before parsing, never `request.json()` first, or the bytes hashed are not the
bytes that were signed, and it fails in a way that looks like a key problem.
The payload is a hint, not a source of truth: verify, then re-read
`GET /payments/{id}`. Duplicate deliveries are then harmless.

**What we lose by polling instead:** nothing for card payments, because the
flow is synchronous and the buyer is present for the whole of it. What breaks
is anything that resolves after the tab closes — ACH settling days later, a
`processing` payment that finishes later, refund completion, every dispute
event. All of those are already out of scope, which is why webhooks defer
cleanly with them rather than leaving a hole.

---

## 9. Security boundaries

`JUSPAY_API_TEST_KEY` in `.env` and Vercel settings, read only inside `api/`,
with **no `VITE_` prefix** — Vite inlines `VITE_*` into the bundle, so the
prefix is the whole attack.

**The amount is server-authoritative.** Trusted from the client: the attempt id
(an opaque selector — it chooses which intent, it cannot change what it costs),
listing ids, bounded quantity, shipping address. Never read from the body: any
amount, currency, `sellerId`, fee or discount.

**Reviewer checklist:** `grep -r "VITE_" api/` returns nothing; the secret key
does not appear in `dist/`; `/api/checkout`'s request type has no `amount`; no
card field name appears in `src/`; confirmation is driven by `GET /api/payment`,
not by the redirect query string.

---

## 10. What we take from Hyperswitch

| Capability | Verdict |
| --- | --- |
| **Unified Checkout SDK** | **Build.** Card data never touches our code; payment methods become a profile setting rather than a code change — the honest argument for an orchestrator |
| **SDK surface** | **Build.** `redirect` defaults to `if_required`, so the success path *sometimes* leaves the page. `retrievePaymentIntent()` is client-side; we call it never |
| **Refunds** | **Build.** `POST /refunds` with our own `refund_id` as the idempotency key |
| **Metadata update** | **Build.** `POST /payments/{id}/update_metadata` carries fulfilment state, so there is no database |
| **Webhooks** | **Defer.** Cannot demonstrate what they are for without durable storage and a stable URL — §8 |
| **3DS** | **Configure only.** Leave the `three_ds` default; the simulated processors' 3DS card `4000003800000446` exercises `requires_customer_action` |
| **Vault** | **Defer.** Pay-Then-Vault, `on_session` — Buy Now means the amount is known at intent time, so Vault-Then-Pay's advantage is inert |
| **Smart Retries** | **Refused.** See below. Auto Retries was on by default (max 3); turned off and verified `is_auto_retries_enabled: false` 2026-09-16 |
| **Routing** | **Configure (dashboard → Workflow → Routing, rule-based).** Rule 1: card AND amount < 50000 → volume split 80 `stripe_test` / 20 `fauxpay`. Rule 2: card AND amount > 49999 → priority `stripe_test` (the dashboard has no ≥). PayPal → `paypal_test` (only eligible connector, no rule). Default fallback, drag order: `stripe_test`, `fauxpay`, `paypal_test`. The `connector` field on each payment shows the choice. **Live and verified 2026-09-16** (`Marketplace-Proto-Routing`, `routing_Wuodl6r3z8u3uEXw8dVZ`): $900 → `stripe_test`; 20 × $40 → 12 `stripe_test` / 8 `fauxpay`; PayPal at $40 and $900 → `paypal_test`. Amounts in the rule are **cents**; a first attempt with `500` split at $5. Rule 2 is `> 49999`, so $500.00 matches it directly (verified). Conditions inside one rule are AND: a rule with both `> 50000` and `= 50000` never matches |
| **PayPal wallet** | **Build.** Enabled on `paypal_test`; the SDK shows the button with no code change. Redirect flow, confirmed by `GET /api/payment` on return |
| **Affirm (pay later)** | **Defer.** Offered by `stripe_test` today; turn it off in the dashboard until design covers its states (product §4) |
| **Auth-rate / elimination routing** | **Defer.** Picks before the attempt, so compatible with no-retries, but needs ~25 finished payments per connector and a second real processor. The simulator (hyperswitch-ten.vercel.app) fakes failure rates and sends the API key through a third-party proxy; throwaway key only, if at all |
| **Least-cost US debit routing** | **Defer.** Sandbox supports it through Adyen only |
| **Stripe split payments** | **Defer.** Only `direct` / `destination` charge types exist; we need separate charges and transfers (product §4) |
| **Payouts API** | **Defer.** Stripe supported in code; per-seller KYC accounts needed, hosted-sandbox support unverified |
| **FRM** | **Defer.** Needs a commercial Signifyd/Riskified contract |
| **Surcharge** | **Refused.** Capped by network rules, banned on debit, restricted in several US states — and we monetise by commission |

### 3DS buys liability shift, and nothing else we face

SCA is a PSD2 mandate and does not apply to us. 3DS moves
*fraudulent-transaction* chargebacks to the issuer. It does **not** cover
not-as-described — the buyer who says the coin is cleaned authorised the
payment perfectly well. We keep the default because a stolen-card chargeback on
a $6,000 coin moving to the issuer is worth the friction, and we state plainly
that this build has **no dispute strategy** rather than dressing 3DS up as one.

### Smart Retries is the one feature we actively refuse

**Observed live, then switched off.** With `stripe_test` added alongside
`paypal_test`, the business profile retried a failed payment on the second
processor automatically. Payment `cka_37640e24372c6d7b55460d`, decline card
`…9995`:

```
attempt _1 · paypal_test · failure   "Internal Server Error from Connector"
attempt _2 · stripe_test · charged   1.3 seconds later
```

The retried failure was a *server error*, not a clean decline — precisely the
ambiguous category argued below — and the attempt ids carry the `_1` / `_2`
suffix, so neither processor could have recognised a duplicate. On the sandbox
it cost nothing; on a real processor it is the double charge. **Decision:
automatic retries off; amount-based routing between connectors stays on.** One
payment, one attempt, one processor.

It retries across connectors, keeping one `payment_id` but **appending the
attempt number before the processor sees it** — connector A gets `pay_x_1`,
connector B gets `pay_x_2`, so connector-side idempotency won't dedupe them
either. Retrying a hard decline is safe; retrying a **timeout** is not, and
"system malfunction" and "processing temporarily unavailable" are exactly that
category. Hyperswitch's "proper reconciliation despite multiple processor
attempts" is a **reconciliation** property, not network-level idempotency — it
can tell us afterwards that both charges belong to one payment; it cannot
un-charge the card.

### Connectors

**In the build: three simulated processors on one profile** — `stripe_test`,
`fauxpay`, `paypal_test` (`pretendpay` deactivated). All take credit and debit cards;
`paypal_test` also has the PayPal wallet. Control center setup done 2026-09-16: routing rule active, Affirm off, Auto
Retries off, Default Fallback `stripe_test`, `fauxpay`, `paypal_test`.

**Test cards, verified on 2026-09-16** with direct API calls (before routing
was live, so all on `paypal_test`):

| Case | Test data | Result |
| --- | --- | --- |
| Success | `4242424242424242` | `succeeded` |
| Hard decline | `4000000000000002` · `4000000000009987` · `4000000000009979` | `failed`, `DC_08`, "Card declined" / "Lost card" / "Stolen card" |
| Soft decline | `4000000000009995` | `failed`, `DC_08`, "Internal Server Error from Connector, Please try again later". The docs call it insufficient funds; the sandbox returns this |
| 3DS challenge | `4000003800000446` | `requires_customer_action` with a redirect |
| PayPal | wallet `paypal_redirect` | `requires_customer_action` with a redirect |

Any future date and CVC. All declines share `DC_08`, so the UI tells hard from
soft by `error_message`, not by code. Re-check the rows against their assigned
connectors once routing is live.

**Further connectors, if we went on:**

| Rank | Connector | Setup |
| --- | --- | --- |
| 1 | **Real Stripe test mode** — real issuer decline codes, ACH with sticky `processing` (`000000000009`). Needs the raw-card-data support ticket first | lead time unknown |
| 2 | **Real PayPal sandbox** — the same redirect path we already build, against real PayPal | ~1–2 h |
| 2 | **Google Pay** — same lifecycle, prettier button | ~2–3 h |
| 3 | **Apple Pay** — domain verification is fatal on rotating preview URLs | ~4–8 h |
| — | **Link** — **not supported.** Absent from Hyperswitch's payment-method and connector enums | — |

---

## 11. Risks

Decline messages come from
a simulator, not an issuer, and all share code `DC_08` · the simulated
processors' capture accounting is unfaithful · `/update_metadata` returns a
connector-layer 400 on every simulated connector even when the write lands, so
it must always be read back (§3) · no connector produces a sticky `processing`,
so that state is designed but can't be triggered.
