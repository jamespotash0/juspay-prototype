# Product plan

Owner: product. The user signs this off. Sections 1–4 are the argument;
[engineering.md](engineering.md) and [design.md](design.md) are how it gets
built.

---

## 1. Framing

### Vertical

**Slabbed** — a peer-to-peer marketplace for US coins and trading cards. eBay
and Facebook Marketplace, scoped down. Buy-it-now only. Prices from $20 to
$6,000 in the same catalogue.

**A buyer and a seller are two different people, but any account can be
either.** Most active collectors do both. There is no separate seller account.

### How money moves

```
Buyer ──pays──> Slabbed ──holds──> (seller ships directly) ──releases──> Seller
                   │                                                       │
                   ├── commission ──> Slabbed          payout ────────────┘
                   └── sales tax ───> State            to PayPal / bank
```

The buyer pays us. We hold the funds. The seller ships directly to the buyer.
Funds release to the seller when they mark the item shipped, minus commission. Proceeds leave to
an **external payout instrument** — there is no spendable platform wallet, so a
dual-role user buying something pays by card like anyone else.

### What payments have to get right here

1. **We hold the money between the buyer paying and the seller shipping, and
   that hold is the product.** A stranger pays for an item they cannot see; the
   seller is paid only once they act. Capture timing, refund policy and payout
   timing are one question about who carries risk in that gap. Everything
   structural descends from it.

2. **The payment method decides who carries the risk, not just the fee.** The
   protections buyers value most are asymmetric against a marketplace that is
   merchant of record — the claims they cover are the ones we cannot recover.
   Detail in §4. **The build runs cards through Stripe test mode**, with bank
   debit as a stretch; PayPal and payouts shape the argument, not the build.

3. **Inventory is one-of-one.** There is exactly one of each item, so a
   marketplace here is a race by nature and a production build needs
   reservations or an optimistic guard at intent creation. **Concurrency
   handling is out of scope** — the race is not observable in a single-browser
   prototype, so building it would mean code no one can exercise.

4. **Retry safety outranks the conversion it costs.** An ambiguous payment
   retried automatically can charge one individual twice for another
   individual's coin.

5. **Authenticity is real, and it is a fulfilment problem.** The industry answer
   is eBay's Authenticity Guarantee — a third-party authenticator in the
   shipping path. **Out of scope.** Its one payments consequence: it would turn
   our release trigger from a seller's action into an authenticator's verdict.

---

## 2. Scope

Seeded with **~10 sellers and ~30 listings**. Three role views behind a
dropdown — a demo device, not auth.

### Build

| Role | Screens |
| --- | --- |
| **Buyer** | Catalogue + search · listing detail · cart · checkout · confirmation · orders, with **mark as received** and **dispute** |
| **Seller** | One page: my listings, my sales, and balance (gross → commission → net) · **mark as shipped** · create a listing |
| **Admin** | Transactions table · payment detail · dispute queue · refund |

The three role actions — **mark as shipped**, **mark as received**, **dispute**
— are what move money. There is no timer.

**Create a listing** is deliberately minimal: one form, coin/card toggle,
photos, title, price, and a graded toggle revealing service + cert + grade. No
drafts, no edit-after-publish. It earns its place because without it the
dual-role premise is an assertion rather than something you can do, and
"you haven't listed anything yet" has nothing behind it.

**The cart earns its place too**, despite being the largest block of
non-payment complexity: it is the only place the per-seller split is
*demonstrable* rather than described, and N-intents-not-one-split-intent is the
most interesting money decision in the build.

### What Hyperswitch must visibly do

This is the grade:

- ✅ Payment creation, server-side; secret key never in the browser
- ✅ Successful payment — a real `succeeded` in the sandbox dashboard
- ✅ Failed payment — hard and soft declines with Stripe's real decline codes
- ✅ 3DS — `requires_customer_action` as its own state, via Stripe's challenge card
- ✅ Routing — Stripe primary, `paypal_test` as fallback, visible per payment in the dashboard
- ◻️ Stretch: ACH bank debit held in `processing`, with payout waiting on it
- ✅ Payment status — authoritative server-side read, never the redirect
- ✅ Refund — full and partial, reached through a buyer dispute
- ✅ Marketplace fee calculation — visible on the seller page
- ✅ Seller balance — `pending → available`, moved by the seller shipping

### Out of scope

Accessibility conformance · **webhooks** (a stateless receiver on a rotating
preview URL cannot demonstrate what webhooks are for) · **concurrency** — no
locks, reservations or sold-out races · **hold timers** — money moves on
actions · per-state sales tax · seller onboarding and KYC · shipping and
tracking integration · messaging · reviews · auctions · offers · saved cards ·
wallets and PayPal as live methods (approach in §4) · Stripe Connect split
payments · real payouts · card-network dispute
handling (our "dispute" is an in-marketplace claim, not a chargeback) ·
authenticity guarantee · promoted listings · seller subscriptions · real auth ·
sign-up (the mocked sign-in covers it).

---

## 3. The money model

**The buyer is charged** — one amount, one payment intent:

```
  item price        $1,800.00    seller sets it, server reads it
+ shipping             $12.00
+ sales tax           $144.00    flat rate, we collect and remit
= charged          $1,956.00
```

**Flat tax rate, not per-state.** Marketplace-facilitator rules make us the
collecting party; a fifty-state table would be fifty invented numbers proving
nothing the concept doesn't, and every one of them checkable and wrong. One
rate, labelled as standing in for Avalara or TaxJar. Per-state rates and nexus
tracking are out of scope.

**The seller is credited** — separately, and later:

```
  item price        $1,800.00
+ shipping             $12.00
− commission          −$90.00    taken at release, not at capture
= net              $1,722.00     queued for payout
```

The buyer never sees the commission; the seller never sees the tax. Three
destinations, not two. **Tax is never inside the commission base.**

### Seller balance states

**There is no hold timer.** Money moves on explicit actions, not on a clock.
Every state change is something a person does and a reviewer can click.

```
                  seller taps            buyer taps
  PAID ─────────► SHIPPED ─────────────► RECEIVED ──► complete
  pending          available               │
                                           │ buyer disputes
                                           ▼
                                       DISPUTED ──► admin refunds ──► REFUNDED
                                                    (reverses the balance)
```

Seller balance is `pending` while the item is unshipped and `available` once
the seller marks it shipped. A refund reverses that entry. `paid_out`, `held`
and `negative` need real payouts, which the sandbox cannot do — they stay
written up, not built. We show only money state that an actual payment or
refund produced; fabricating the rest would undercut the one thing this
prototype has going for it.

**The known gap, chosen knowingly:** releasing on a seller-controlled event is
the obvious fraud — mark shipped, never ship, funds gone. Real marketplaces
gate release on carrier delivery confirmation. We take the simple version
because the state machine is the point here, not the fraud model.

Commission is deducted at `pending → available`, as its own ledger entry. A
sale refunded before release therefore never charges a fee; refunding a
released sale reverses **two** entries, or we quietly keep commission on a sale
that unwound.

---

## 4. Decisions

Product owns these. Mechanisms are in [engineering.md](engineering.md).

**Vertical — US coins and cards, dual-role accounts, buy-it-now.** The category
where the payments questions are about money rather than checkout polish.

**Capture immediately; escrow is a ledger, not an authorisation hold.** Card
auths decay in ~7 days and an individual seller ships when they reach the post
office, so auths would routinely expire before the item moved. The reversal
tool is a refund, not a void. *Changes our mind:* professional sellers with
SLA'd dispatch.

**Commission is paid by the seller, deducted at release.** Nothing is added to
the buyer's total — a fee appearing after someone decided on an $1,800 item is
the worst moment in the funnel. Matches eBay and Depop's final-value fees.

**Sales tax is server-computed and sits outside the commission base.**
Marketplace-facilitator rules make us the collecting party. Flat rate per state
from a constant table; a real build uses Avalara or TaxJar.

**Money moves on actions, not a timer.** No inspection window, no hold clock —
out of scope. The seller marking an item shipped releases the funds to their
balance; the buyer marking it received completes the order. Both are explicit
acts, which makes every state transition demonstrable rather than something a
reviewer has to wait fourteen days to see. *Known gap:* release on a
seller-controlled event is the obvious fraud, and a real build gates it on
carrier delivery confirmation.

**Refunds are reached through a buyer dispute, not only an admin god-button.**
The buyer disputes from their own order, it lands in an admin queue, and the
admin issues a real Hyperswitch refund that reverses the seller's balance. This
is what a marketplace holding funds is *for* — someone adjudicates — and it
closes the circuit with real money: real payment in, real refund out.

**A negative balance blocks payouts, not selling or buying.** Documented only,
since nothing reaches `paid_out` in the sandbox. Selling is how they repay, so
we recover from the next sale's `pending`, disclosed on the order line. We do
**not** net a selling debt against their next purchase — that makes us an
involuntary creditor, and it isn't mechanically available anyway.

**Never auto-retry an ambiguous payment.** A double charge between two
individuals is unrecoverable by reassurance and worse than a lost sale.

**Providers — Stripe and PayPal, nothing else.** **Stripe is in the build**
(test mode, connected to the Hyperswitch sandbox); PayPal and all payouts are
production reasoning. `paypal_test` stays on the profile as a fallback, and is
a simulated card processor, not PayPal.

A marketplace needs two jobs done: **take money from buyers** and **pay money
to sellers**. We picked the fewest providers that cover both without overlap.

| Job | Stripe | PayPal |
| --- | --- | --- |
| Buyer pays by card | ✅ primary | — |
| Buyer pays by bank account (ACH) | ✅ (through Hyperswitch: typed account numbers + microdeposits) | — |
| Buyer pays with PayPal / Venmo balance | — | ✅ only PayPal can |
| Seller onboarding, KYC, 1099-K | ✅ Connect hosted form | — |
| Seller payout to bank | ✅ Connect | — |
| Seller payout to PayPal / Venmo | — | ✅ only PayPal can |

**Where each sits in the flow:**

```
 CHECKOUT            HOLD                RELEASE              PAYOUT
 buyer picks ──────> money sits in ────> seller marks ──────> seller's chosen
 a method            Slabbed's balance   shipped              instrument
   │                   │                   │                    │
   ├ card ─┐           │                   │                    ├ bank ── Stripe Connect
   ├ bank ─┴ Stripe ───┤                   │                    └ PayPal ─ PayPal Payouts
   └ PayPal ─ PayPal ──┘                   │
                                   buyer disputes ──> refund on the rail
                                   the buyer paid with; reverse the seller
                                   transfer if already released
```

**Why Stripe is the primary processor.** One integration covers cards, bank
debit and seller payouts. Stripe Connect also carries the regulatory weight: holding
a buyer's money and passing it to an individual is money transmission, and
Connect's licences and hosted KYC keep that off us. Separate charges and
transfers fits our model: we charge at checkout and transfer to the seller
only when they mark the item shipped. Sellers never see Stripe, only an
onboarding form asking for identity and a bank account.

**Why cards are the default.** A US collector already trusts a card with a
$1,800 purchase, and card disputes follow network rules we can predict. The
cost is ~2.9% + 30¢: about $174 on a $6,000 slab.

**Why bank debit is offered, with limits.** On that same $6,000 slab ACH
costs ~$5 against ~$174, which matters at our top price band. Robinhood funds
accounts the same way. The risk is that a consumer can return a debit as
unauthorised for **60 days**, versus two banking days for insufficient funds.
Robinhood can live with that because the money never leaves them; ours goes to
a stranger who shipped a one-of-one coin. So: offered only to buyers with a
completed purchase, payout waits for the debit to clear (covering bounces,
not the 60-day return), and it sits as `processing` until then. Plaid is not
needed: Plaid's own money movement (Transfer) would sit outside Hyperswitch.
The honest cost is that Hyperswitch's Stripe ACH takes typed account and routing
numbers with microdeposit verification, not an instant bank login. Stripe's
Financial Connections (or Plaid) would fix that only by going around
Hyperswitch, so production accepts the slower verification or adds instant
verification as a separate step before checkout.

**Why PayPal is added, knowingly.** Collectors expect the button, and
Purchase Protection explicitly names "advertised as authentic but is not
authentic" and "the condition of the item was misrepresented". That is why
buyers reach for it. But **Seller Protection covers unauthorised and
item-not-received claims only, and excludes not-as-described entirely**. As
merchant of record *we* are the seller in PayPal's eyes, so the dispute names
our account and the individual shipper is invisible. The dispute class this
vertical generates most is the one where we have no cover. It is also a
parallel channel: the buyer need not use our claims process first, PayPal
holds the funds during investigation, and it decides at its sole discretion.
One more trap: PayPal's ineligible list excludes physical gold, so gold coins
are unprotected for the buyer while staying fully chargeable back to us.
On the payout side PayPal earns its place for the opposite reason: many
individual sellers already live in PayPal and would rather be paid there.

**Rejected.** *Adyen* does everything Stripe does; its only value is as a
second processor for Hyperswitch routing and failover, which pays at eBay's
volume, not ours. *Plaid* duplicates Financial Connections. *Wallets* (Apple
and Google Pay) add speed, not safety: Apple's terms send users to their card
issuer for disputes. They come for free through Stripe later. *Affirm* fits
the $6,000 end but may exclude bullion; deferred.

**Seller exposure after a lost dispute.** If a refund lands after the seller
was paid, we reverse the Stripe transfer. If their balance cannot cover it,
the loss is ours, which is why release waits for an explicit ship event.

**Payouts are the one place we'd step outside Hyperswitch.** Hyperswitch
passes Stripe Connect split settings at payment creation, but only as *direct*
or *destination* charges. Destination charges move money to the seller at
charge time, which breaks "transfer when the seller ships". Our model,
separate charges and transfers, means calling Stripe's transfer API ourselves
on the ship event. Hyperswitch's Payouts API does support Stripe in code, but
needs a Stripe account per seller with full KYC details, and hosted-sandbox
support is unverified. Both deferred; nothing in the build reaches `paid_out`.

**Why Stripe is in the build, not just the argument.** The dummy connector
could not show the states this vertical depends on: real decline reasons, a
3DS challenge on a $6,000 card payment, and a debit that sits in `processing`.
Stripe test mode shows all three, and implements `update_metadata` properly.
With two connectors on one profile, routing becomes something a reviewer can
see rather than a sentence.

**Routing rule, and why.** Stripe first for every payment; `paypal_test` only as
fallback when Stripe is unavailable. Bank debit can only go to Stripe. This is
**routing before an attempt, not retrying after one**. Smart Retries stays
refused (engineering §10): re-sending a timed-out $6,000 payment to a second
processor risks charging one collector twice for another collector's coin. In
production the fallback would be a second real processor (Adyen), chosen by
auth rate once volume justifies it.

**Sign-in is mocked and gated at checkout.** Browsing is the funnel; a wall
before it blocks the only thing that makes the site look real.
