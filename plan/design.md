# Design plan

Owner: design. Planned with `/impeccable`. Product truth is in
[PRODUCT.md](../PRODUCT.md); the direction contract is in
`.impeccable/surfaces/src-app-tsx.md`.

---

## 1. Direction

The roll assigned a themed world — the collector's album page, a grid of
punched windows where each listing is one slot. **We turned it down:** this is
a marketplace, and a heavy item-specific metaphor would make every screen argue
about coins when the job is catalogue → detail. The specificity belongs in the
content, not the chrome — which also means the design generalises.

**The category standard, executed at full fidelity.** Craft bar: eBay, Mercari
and Depop, *including their seller surfaces*, so the seller and admin views
stay in consumer-marketplace language rather than importing a dashboard idiom
mid-product.

**The point of view:** a marketplace that shows the data collectors buy on, and
shows the money plainly. It refuses the arrangement where specs hide behind a
hero photo and payment state hides behind a spinner.

### Composition

**Top bar + full-width grid, and every detail is its own page.** Wordmark,
search, role switcher and cart across the top; filter chips beneath; a grid of
listing tiles. A listing opens as a page with a back button, not a drawer.

The roll dealt a sidebar-with-drawer layout, a role-aware home and a
single-column feed. We took the plainest shape instead, because **every screen
being a page** is the cheapest thing to build, the easiest to deep-link and
reload, and the arrangement nobody needs explaining. The cost — comparing
listings means back-and-forth — is small at thirty items.

---

## 2. The system

| | |
| --- | --- |
| **Ground / ink** | Bone white, near-black. Light — this is a daylight browsing task, not a console |
| **Accent** | One saturated cobalt, **only where something can be pressed**. Never decorative |
| **State colour** | Reserved exclusively for state, so it never collides with the accent |
| **Type** | Archivo, Archivo Expanded for display. **Tabular figures everywhere money appears**, so price columns align and totals don't jitter |
| **Form** | 4px radii, hairline rules, no shadow above 1dp. Density over air |

Three rules kept from the directions we rejected, each fixing something the
conventional pattern is weak at:

1. **States are encoded structurally before colour** — dotted rule for held,
   struck rule for disabled. Nine payment and ledger states is more than colour
   carries; it is the difference between a status pill and a status vocabulary.
2. **The data field stays achromatic.** Colour at edges and in pills, never
   inside a column of prices and grades.
3. **Amounts change as visible events.** A balance moving from held to
   available gets a transition with weight, not a silent re-render.

---

## 3. Screens

Ten screens. Top bar on every one: wordmark, search, **role switcher**, cart.

| # | Route | Role | Contents | Primary action |
| --- | --- | --- | --- | --- |
| 1 | `/` | Buyer | Search, filter chips, listing grid — each tile shows photo, price, title, and a grade · cert · seller strip that stays visible | Open listing |
| 2 | `/listing/:id` | Buyer | Photos, price, grade · cert, seller, the hold promise beside the buy control | **Buy now** / Add to cart. Your own listing shows no buy button |
| 3 | `/cart` | Buyer | Items grouped by seller, subtotal per group | Check out one seller group |
| 4 | `/checkout/:seller` | Buyer | Sign-in gate (mocked Google / Apple / email) → ship-to → summary with tax → Hyperswitch SDK | **Pay** |
| 5 | `/order/:paymentId` | Buyer | Status, amounts, fulfilment timeline. **Also the confirmation page** | **Mark received** / **Dispute** |
| 6 | `/orders` | Buyer | Past orders with status | Open order |
| 7 | `/sell` | Seller | Your listings · your sales · balance (gross → commission → net) | **Mark shipped** |
| 8 | `/sell/new` | Seller | Create listing — coin/card toggle, graded toggle revealing service + cert + grade | Publish |
| 9 | `/admin` | Admin | Transactions table, filterable to disputes | Open payment |
| 10 | `/admin/payment/:id` | Admin | Full status, decline reason, fulfilment metadata, refunds | **Refund** (confirm dialog) |

Two merges baked in. **Confirmation and order detail are one page** — a
confirmation is an order seen for the first time. **The dispute queue is a
filter on transactions**, not its own screen.

Sign-in is an inline gate on checkout, not a page: browsing is the funnel, and
identity is first needed when there is an address to ship to.

**No drawers or overlays for navigation — every screen is a page.** One
exception: a **confirm dialog before a refund**, because it is the one
irreversible money action a click can trigger. Nothing ever overlays the
checkout page — a modal appearing over a live payment is a way to lose a
transaction.

---

## 4. Checkout states

Where the design work actually is — and what the prototype is judged on.

| State | Buyer sees | Money at risk |
| --- | --- | --- |
| Submitting | Form locked, no navigation | Not yet charged |
| 3DS in flight | "Your bank needs to confirm it's you. You'll come right back." | Not yet charged |
| PayPal in flight | The buyer is on PayPal's page; our tab shows nothing. On return, the same "Confirming your payment…" state as 3DS. A buyer who abandons PayPal leaves the payment in `requires_customer_action`. The order page reads `payment_method_type` and shows "You didn't finish paying on PayPal. Nothing has been charged." instead of the 3DS line (verified in the browser 2026-09-16) | Not yet charged |
| Returned, unconfirmed | "Confirming your payment…" while the **server** polls | Unknown to them, known to us |
| Processing | "Payment sent — waiting on your bank. You don't need to do anything." | Committed |
| Soft decline | Inline, everything retained except the card | No |
| Hard decline | Retry suppressed for that card, "try a different card" | No |
| **Unknown** | "We're not sure whether that went through. **Don't pay again yet.**" Copyable reference, then a **Check again** button that re-reads and can never create a second charge | Unknown |
| Succeeded | Order page with fulfilment timeline | Held until the seller ships |

Decline copy follows one shape: **what happened without blame → why, if useful
→ the one next action.** A deliberate asymmetry — bank declines say *"your
bank"* (true, and it moves blame off both the buyer and us); our failures say
*"we"* and lead with *"nothing has been charged"*. Owning our own failures is
what buys credibility when we say the bank did it. Raw codes are logged, never
printed.

### After payment: order actions and refunds

Every money-moving action has a failure path, not just a success path.

| State | Who | What they see |
| --- | --- | --- |
| **Action didn't save** | Seller or buyer (mark shipped / received / dispute) | The write-then-verify read-back didn't find the value. *"That didn't save — try again."* Safe to retry, because it is a metadata write, not money |
| **Refund failed** | Admin | *"No money has moved."* The dispute stays open and the refund can be retried |
| Refund succeeded | Admin, then buyer | Order shows *Refunded*; the seller's balance reverses on the same view |

---

## 5. Edge cases

| Case | What happens |
| --- | --- |
| **Buying your own listing** | No buy button; checked at render *and* at intent creation. Filtering it silently out of search would be worse — sellers look for their own listing to check it's live |
| Two tabs, same cart | Shared `localStorage` attempt id converges both on one intent |
| Refund before vs after the seller ships | Before: reverse the `pending` entry, no commission charged. After: the balance was already `available`, so the refund reverses that |
| Dispute on an order already refunded | Dispute action hidden once a refund exists against the payment |

**Out of scope:** concurrency — sold-out races, reservations, price-changed-
mid-checkout and listing-withdrawn-mid-checkout. Listings do not go out of
stock in this build.

---

## 6. Empty states

Each states a **fact about how this marketplace works** rather than an apology
— which is what stops them reading as placeholder text, and is free education
at the moment someone has attention and nothing to read.

| State | The fact | Action |
| --- | --- | --- |
| No search results | "Try searching by cert number." Real listings below — never a bare page | Clear filters |
| Empty cart | "Every listing here is one of one." | Browse |
| No listings yet | "Graded coins and slabbed cards sell fastest." | Create a listing |
| No orders yet | "The seller isn't paid until they ship." | Browse |
| No sales yet | "When someone buys, you ship directly — funds become available when you mark it shipped." | List an item |
| Zero balance | Strip: Sold → Shipped → Available. No withdraw button — payouts are out of scope | List an item |

---

## 7. Out of scope

Accessibility conformance, at the user's direction — no standard claimed or
audited, and no claim may be made in the README. Semantic markup and real
controls come free with the component choices.
