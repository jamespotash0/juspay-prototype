# Tickets

The build, broken into tickets by owner. Plans are the *why*
([product](product.md) · [engineering](engineering.md) · [design](design.md));
this file is the *what, who and in which order*.

Branch: `build/prototype`.

---

## How the agents work together

**Contract first.** [`src/shared/types.ts`](../src/shared/types.ts) is frozen
before anyone starts: domain types, the metadata keys, every API request and
response shape, and the business constants. Agents code against that file, not
against each other's half-finished work — which is what lets them run in
parallel. Changing it needs product sign-off.

**Strict file ownership.** Parallel agents only ever write files they own. If a
ticket needs a change in someone else's file, it says so in its handback
instead of editing it.

| Owner | Owns |
| --- | --- |
| **Engineering** | `package.json` + lockfile · `vite.config.ts` · `tsconfig*.json` · test runner config · `api/**` · `src/shared/{money,orderState,attempt}.ts` · `src/lib/**` · `src/checkout/**` · `src/App.tsx` · `src/main.tsx` |
| **Design** | `index.html` · `src/index.css` · `src/ui/**` · `src/pages/**` *(from W2; engineering stubs them in W1)* |
| **Product** | `src/shared/seed.ts` · `src/shared/copy.ts` |
| **QA** | `tests/**` · `e2e/**` |
| **Frozen** | `src/shared/types.ts` |

**Only engineering installs dependencies, and only in ENG-1.** No other ticket
touches `package.json`.

**Three workflows, run in sequence**, each read before the next starts:

| Workflow | Goal | Tickets |
| --- | --- | --- |
| **W1 — Foundation & the payment path** | A real payment created and read through our own API | ENG-1, DES-1, PROD-1 → ENG-2, QA-1 → QA-2 |
| **W2 — The marketplace** | Every screen and every post-payment action | ENG-3, DES-2, DES-3, DES-4, QA-3 |
| **W3 — Integrate & verify** | One working app, tested end to end, reviewed | ENG-4, QA-4, PROD-2, DES-5 |

---

## Sections

| | Section | Tickets |
| --- | --- | --- |
| A | Foundations | ENG-1 · DES-1 · PROD-1 |
| B | Payment path — *the grade* | ENG-2 · QA-2 |
| C | Payment states | DES-2 |
| D | Buyer storefront | DES-3 |
| E | Post-payment actions | ENG-3 · QA-3 |
| F | Seller & listing creation | DES-4 |
| G | Admin & refunds | DES-4 |
| H | Shell & integration | ENG-4 |
| I | Testing | QA-1 · QA-2 · QA-3 · QA-4 |
| J | Acceptance & design review | PROD-2 · DES-5 |

---

## W1 — Foundation & the payment path

### ENG-1 · Toolchain and server plumbing
*Section A · Engineering · depends on: nothing*

- Install, once, everything the build needs: the Hyperswitch web SDK (**verify
  the package name and props with context7 `/juspay/hyperswitch-docs` first**),
  Vitest, Playwright (`npx playwright install chromium`).
- `npm run dev` serves the front end **and** `api/*.ts` together, via a Vite
  dev-server plugin that loads each `api/<name>.ts` and calls its exported
  `GET` / `POST(request: Request): Promise<Response>`. No Vercel CLI needed
  locally or in tests. Env comes from `.env`: `JUSPAY_API_TEST_KEY`,
  `JUSPAY_API_PUBLISHABLE_KEY`.
- `api/_lib/hyperswitch.ts`: base URL `https://sandbox.hyperswitch.io`,
  `api-key` header, error normalisation to `ApiError`. (Vercel ignores
  `_`-prefixed paths as routes.)
- `src/shared/money.ts`: `breakdown(lines, listings)` and
  `sellerLedger(breakdown, fulfilment, refunded)`, integer cents, using
  `TAX_RATE_BPS` / `COMMISSION_BPS`. Used by **both** server and client.
- `src/shared/orderState.ts`: all 17 Hyperswitch statuses → `PaymentState`,
  unrecognised → `unknown`.
- `src/shared/attempt.ts`: `newAttemptId()` → `cka_` + 22 hex (26 chars).
- `src/lib/`: a tiny `pushState` router (**no router dependency**) for the ten
  routes in design.md §3 · `session.ts` (active persona in `localStorage`) ·
  `cart.ts` · `api.ts` (typed fetch client for every endpoint in the contract).
- `src/App.tsx`: the route table, rendering **stub** page components in
  `src/pages/` for all ten routes.
- Add `api` to a tsconfig `include`.

**Done when:** `npm run build`, `npm run typecheck` and `npm run lint` pass;
`npm run dev` serves a stub page and a hello-world `api/` function.

### DES-1 · Design system
*Section A · Design · depends on: nothing · runs parallel with ENG-1 and PROD-1*

- Tokens in `src/index.css` (Tailwind v4 `@theme`) from design.md §2 and the
  direction contract `.impeccable/surfaces/src-app-tsx.md`: bone ground,
  near-black ink, one cobalt accent **only on actionable elements**, semantic
  state colours reserved for state, 4px radii, hairline rules.
- Archivo + Archivo Expanded via Google Fonts in `index.html`; tabular figures
  on every amount.
- Primitives in `src/ui/`: `TopBar` (wordmark, search, persona switcher, cart
  badge — props only, no data fetching), `Button`, `Money` (formats `Cents`),
  `StatusPill` (encodes state **structurally**, not by colour alone),
  `ListingTile`, `EmptyState`, `Notice` (for decline / ambiguous / error
  messages), `ConfirmDialog`.
- Primitives take props only; they never import `src/lib`.

**Done when:** every primitive typechecks and renders on a scratch route or
story page; no page wiring yet.

### PROD-1 · Seed data and copy
*Section A · Product · depends on: nothing · runs parallel with ENG-1 and DES-1*

- `src/shared/seed.ts`: the three personas; ~10 sellers **including `alex`
  (zero listings, to exercise empty states) and `mike` (several listings)**;
  ~30 listings, coins and cards, $20–$6,000, realistic grading vocabulary
  (PCGS / NGC / PSA / BGS / CGC, real grade formats, plausible cert numbers),
  most graded, a few raw. Stable image URLs that resolve. All clearly
  synthetic — no real people.
- `src/shared/copy.ts`: every user-facing string that carries meaning — empty
  states, decline messages keyed by reason, the ambiguous-payment copy, the
  hold promise, action failures — taken from design.md §4–§6 and PRODUCT.md
  voice. One source, so wording stays consistent.

**Done when:** both files typecheck against `types.ts`.

### ENG-2 · Create and read a payment
*Section B · Engineering · depends on: ENG-1*

- `POST /api/checkout` exactly per engineering.md §2 and §5: validate listing
  ids against the seed (accept `usr_…` listings from `userListings`), **one
  seller per request**, refuse buying your own listing, compute the amount
  server-side with `money.ts`, create the intent with `payment_id: attemptId`,
  `capture_method: automatic`, `confirm: false`, and every `META` key.
  **`HE_01` → read the existing payment**; 409 on amount mismatch or a spent
  intent.
- `GET /api/payment?id=` → `OrderView`: status via `orderState.ts`, fulfilment
  from metadata, refund state from `/refunds/list`, ledger via `money.ts`,
  normalised decline from `unified_code` / `error_details`.
- `src/checkout/HyperCheckout.tsx`: mount the Unified Checkout from
  `clientSecret` + `publishableKey`, `return_url` = `/order/:paymentId`,
  handle both the redirect and the no-redirect path. **Never** use the SDK's
  client-side retrieve to decide an outcome.
- Functional (unstyled) `src/pages/Checkout.tsx` and `src/pages/Order.tsx` so
  the path can be exercised in a browser. Attempt id generated and stored in
  `localStorage` **before** the fetch; reused on retransmission; regenerated
  after a terminal failure or cart change.

**Done when:** a real payment can be created through `/api/checkout` and read
back through `/api/payment` against the sandbox; build is green.

### QA-1 · Unit tests
*Section I · QA · depends on: ENG-1 · runs parallel with ENG-2*

Vitest, no network: `money.ts` (the $1,800 → $1,956 / $1,722 worked example,
rounding, multi-item, tax and commission never compounding) · `orderState.ts`
(all 17 statuses, unknown fallback) · `attempt.ts` (format, length ≤30) ·
`cart.ts` grouping by seller.

### QA-2 · Sandbox tests: the payment path
*Section I · QA · depends on: ENG-2*

Vitest against the **live sandbox**, calling the `api/` handlers directly with
`Request` objects; skipped automatically when keys are absent. Confirm the
intent server-side with a test card and `authentication_type: no_three_ds`
(the SDK is browser-only).

- Success (`4242…`) → `OrderView.state === 'paid'`, correct breakdown, metadata present.
- Duplicate `attemptId` → `HE_01` recovery returns the **same** payment, no second intent.
- Amount is ignored if a client sends one; buying your own listing is refused.
- **Probe and record** which decline test cards the current connector
  (`paypal_test`) actually honours. Do not assume Stripe behaviour.
- A headless Playwright smoke: `/checkout/:seller` for a seeded listing mounts
  the SDK iframe. No card entry yet.

**Handback includes:** at least one real `succeeded` payment id.

---

## W1 result ✅

Build, typecheck, lint green; 37 unit tests and 11 live-sandbox tests passing.
**A real payment completed through the full browser flow** — catalogue data →
`/checkout/mike` → card typed into the Hyperswitch iframe → Pay → order page
read back `paid` (`cka_2e74f18baae19593e02e34`, confirmed directly against the
sandbox). All five decline cards genuinely decline on `paypal_test`, so failed
payments are demonstrable without Stripe. Decline reasons are matched on the
connector's message text, because `paypal_test` returns `UE_9000` for every
decline.

**Decisions carried into W2** (product):

1. **Tag every payment's source.** New contract key `META.source`: `app` for
   real orders, `test` when a request carries header `x-slabbed-source: test`.
   Buyer, seller and admin lists show `app` only — every sandbox test run
   creates eight payments on Alex, and they must not flood the demo. Existing
   untagged payments are hidden by the same rule.
2. **Ledger before shipping and after refund.** `pending` shows the *expected*
   commission and net. `reversed` shows commission **0** and net **0** — a
   refunded sale pays no fee.
3. **Order lists hide non-orders.** Buyer and seller lists exclude
   `awaiting_payment`, `failed`, `cancelled` and `unknown` — an abandoned or
   declined checkout is not an order. Admin sees every state.
4. **Coin photos are vendored** into `public/listings/`, so the demo does not
   depend on Wikimedia's rate limit.
5. On `HE_01` for a payment that is still in flight, return 409
   `IN_PROGRESS` with the payment id so the client goes to the order page,
   instead of a 502.

---

## W2 — The marketplace

### PROD-1b · Vendor listing images
*Section A · Product · owns `public/listings/**` and `src/shared/seed.ts`*

Download each coin photo into `public/listings/`, point `imageUrl` at the local
path, keep the card SVG placeholders as they are.

### ENG-3 · Post-payment endpoints, plus the W1 carry-overs
*Section E · Engineering · also implements decisions 1, 2, 3 and 5 above*

- `POST /api/order-state` — `ship` (seller, from `paid`+`unshipped`) ·
  `receive` (buyer, from `shipped`) · `dispute` (buyer, from `shipped` or
  `received`, not refunded). Invalid transition or wrong actor → 409.
  **Write-then-verify** per engineering.md §3: `CE_00` / `IR_20` is non-fatal,
  re-read and confirm the value landed, any other error is fatal.
- `POST /api/refund` — admin only, full or partial, our own `refund_id` as
  idempotency key, returns the updated `OrderView`.
- `GET /api/orders?buyer=|seller=|all=1` — page through payments and filter on
  metadata in memory, with the `ponytail:` ceiling comment from engineering.md
  §7. Ignore payments without our `sellerId` metadata.

### DES-2 · Checkout and order page, with every payment state
*Section C · Design · takes ownership of `Checkout.tsx` / `Order.tsx` from ENG-2*

All eight checkout states and both post-payment failure states from design.md
§4, copy from `copy.ts`. The ambiguous state is unmissable and offers exactly
one action, **Check again**, which re-reads and can never charge. The order
page is also the confirmation page: status, breakdown, fulfilment timeline,
**Mark received** / **Dispute**. Nothing overlays checkout.

### DES-3 · Buyer storefront
*Section D · Design*

Catalogue with search and filter chips · listing detail (own listing shows no
buy button) · cart grouped by seller, one checkout per group · orders list.
Empty states from design.md §6. Top bar on every page.

**Free shipping:** a listing with `shippingCents === 0` reads **"Free
shipping"** on the tile, the detail page, the cart and the checkout breakdown,
never "$0.00". Applies to DES-2's breakdown too.

### DES-4 · Seller, listing creation, admin
*Sections F and G · Design*

`/sell`: your listings, your sales with **Mark shipped**, and the ledger (gross
→ commission → net, balance moving `pending → available`) · `/sell/new`: the
minimal form, saving `usr_…` listings to `localStorage` · `/admin`:
transactions filterable to disputes · `/admin/payment/:id`: full detail and
**Refund** behind `ConfirmDialog`.

### QA-3 · Sandbox tests: post-payment
*Section I · QA · depends on: ENG-3*

Full lifecycle on a real payment: ship → balance `available` → receive; and
ship → dispute → refund → balance `reversed`, `refund.state === 'succeeded'`.
Invalid transitions and wrong actors → 409. **Write-then-verify** proven: the
connector-layer 400 does not surface as a failure. `/api/orders` filters
correctly by buyer and seller.

---

## W2 result ✅

Committed and pushed as `48ecc01` (engine) and `9b645f1` (UI). Build, typecheck,
lint green; 38 unit tests pass; the post-payment lifecycle passes against the
live sandbox. Buyer → seller → admin flows all work: ship, receive, dispute,
refund, with the seller ledger reversing.

Since W2, in the control center: **routing live** (PayPal → `paypal_test`;
cards ≥ $500 → `stripe_test`; cards < $500 → 80/20 `stripe_test` / `fauxpay`),
**Auto Retries off** after we observed a failed `paypal_test` attempt retried
and charged on `stripe_test` 1.3 s later. PayPal wallet and the abandoned-PayPal
state are in (`f17944c`).

---

## W3 — Integrate & verify

Split in two so each half is committed and pushed before the next starts.

**Cut from scope on 2026-09-16, after W3a started:** 3DS challenges, partial
refunds (refunds are **full only**), and handling for a buyer who abandons
PayPal (its message stays in the code; it is not demonstrated or tested).
Decisions 1 and 2 below are therefore **superseded**. W3a built them because it
was already running; they were then removed before W3a was committed — the
contract has no refund amount, `/api/refund` always refunds the whole order and
returns 409 `ALREADY_REFUNDED` / `REFUND_PENDING` on a second attempt, and the
admin form is a single confirmed **Refund** action.

**Decisions for W3** (product, 2026-09-16) — already in `types.ts`:

1. **Partial refunds come off the seller's net.** `netCents = gross −
   commission − refundedCents`, floored at 0; the balance state is unchanged.
   Only a **full** refund makes the balance `reversed` with fee and net 0.
   `SellerLedger` gains `refundedCents`.
2. **Minimum refund is 100 cents ($1.00)** — Hyperswitch rejects less. Enforced
   on the server (400 `INVALID_AMOUNT`) and in the admin form.
3. **`Decline.reason`** (a `DeclineReason`) — pages branch on it, never on
   message text.
4. **`OrderView.disputeReason`** and **`OrderView.fulfilledAt`** (shipped /
   received / disputed timestamps) — admin shows them.

### W3a — Close out W2's gaps

#### ENG-4 · Engineering carry-overs
Implement decisions 1–4 in `api/_lib/orderView.ts`, `src/shared/money.ts`,
`api/refund.ts`. A reactive query-string hook in `src/lib/router.tsx` (so
search stops relying on a `popstate` workaround). Render the SDK **Pay** button
with the `Button` primitive in `src/checkout/HyperCheckout.tsx`, and expose a
submitting callback so checkout can lock its form. Clear lint warnings in
engineering-owned files.

#### DES-5 · Design carry-overs
*Owns `copy.ts` for W3a as well as all of design's files.*
- **Mobile:** the top bar overflows at 390 px on every collector page — fix in
  `src/ui/TopBar.tsx`.
- **`ListingTile`:** grades render "PSA PSA 1"; add a shipping line so
  "Free shipping" no longer needs an overlay from the catalogue.
- **Copy:** move every page-local string into `COPY`. Fix: the soft-decline
  title repeating its body, `refundFailed` saying "the dispute is still open"
  when there was no dispute, and the insufficient-funds action saying "try a
  different card" on a retriable decline.
- **Order page:** branch on `decline.reason`, not message prefixes.
- **Admin payment:** show `disputeReason` and the `fulfilledAt` timestamps;
  validate refunds ≥ $1.00.
- **Seller balance:** animate pending → available (design.md §2 rule 3).
- Switch search to engineering's query hook once it exists; clear lint
  warnings in design-owned files.

#### QA-4a · Tests for the new routing
*Depends on ENG-4.* The decline tests assumed every card went to `paypal_test`;
routing broke that. Pin cards to **`stripe_test` with a listing ≥ $500**
(deterministic), assert `OrderView.connector` and `decline.reason`. Re-probe
the decline and 3DS cards on `stripe_test`, and probe `fauxpay` with bounded
small payments. Add a routing test (≥ $500 card → `stripe_test`). Update money
unit tests for partial refunds. Write the per-connector test-card results back
as a table in the handback, for engineering.md §10.

### W3b — Prove it

#### ENG-5 · A faster order list
Runs first.

**Faster `/api/orders`.** It pages through every sandbox payment and takes
7–11 s for admin, growing by ~14 payments per test run. Bound it with the list
endpoint's creation-date filter to recent payments (verify the exact parameter
name — `created.gte` vs `created_gte` — against the sandbox), keeping the
existing page cap. Record the window as a `ponytail:` ceiling.

#### QA-4 · Browser end-to-end
Playwright, real browser, real sandbox, against localhost (Vercel previews sit
behind a login):
1. Alex buys a **large** item with `4242` typed into the Hyperswitch iframe →
   order page `paid`, connector `stripe_test`.
2. Mike: `/sell` shows the sale → **Mark shipped** → ledger `available`.
3. Alex: **Mark received**.
4. Second purchase → shipped → Alex **disputes** → Admin **refunds** → order
   refunded, Mike's balance reversed.
5. A **decline** card → decline state with the right reason; the cart survives.
6. **PayPal** → redirect → back → `paid`.
7. The engineering.md §9 reviewer checklist as assertions: no `VITE_` in
   `api/`, secret key absent from `dist/`, no `amount` on the checkout request
   type.

#### DES-6 · Design review
Screenshot every screen and state at desktop and mobile, review against
design.md and the direction contract. Ranked findings only.

#### PROD-2 · Acceptance review
Walk the running app against product.md §2 and PLAN.md's definition of done,
using QA-4's and DES-6's evidence. Pass / fail per line.

#### One batched fix round
Engineering and design fix whatever QA-4, DES-6 and PROD-2 raised, in parallel
on their own files; QA-4 re-runs.

---

## Known constraints every ticket inherits

- **No real Stripe.** Three simulated processors (`stripe_test`, `fauxpay`,
  `paypal_test`); PayPal wallet on `paypal_test`; Affirm deferred.
  Connector choice is a dashboard setting, never code. Test cards: engineering §10.
- **Shipping is a seller-set price per listing, charged per item** — no
  combined shipping, no carrier rates. Untaxed and commission-free; it passes
  straight through to the seller. Known limitation: several items from one
  seller pay shipping once per item. Accepted because nearly every listing is
  one-of-one, so most orders are a single item.
- **Created listings trust the client price** — a deliberate demo
  simplification, scoped to `usr_…` listings only. Seeded listings are always
  priced server-side.
- Out of scope, do not build: webhooks, concurrency / reservations, hold
  timers, per-state tax, real payouts, real auth, accessibility conformance.
