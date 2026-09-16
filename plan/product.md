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
   Detail in §4. **The build offers card and PayPal**, both through the
   sandbox's simulated processors; bank debit, Affirm and payouts shape the
   argument, not the build.

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

6. **More than one payment provider is structural, not optional.** Buyers
   expect cards, bank debit and PayPal; sellers need payouts to a bank or to
   PayPal; high-value orders will want financing. No single provider covers all
   of it (§4). That is the reason for an orchestrator: see *Why Hyperswitch*.

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
*demonstrable* rather than described. **One payment for the whole cart, split
per seller on our side** (changed 2026-09-16 from one payment per seller). US
collectors buy from several sellers in one sitting, and eBay and Etsy both take a
mixed cart in one payment; paying seller by seller means entering the card, or
doing the PayPal redirect, once per seller. One payment also removes the worst
state of the old model, a cart half paid because one seller's charge declined.
Each seller's share is recorded on the payment, ships and pays out on its own,
and is refunded on its own as a partial refund, so one seller's fake slab never
refunds another seller's sale.

### What Hyperswitch must visibly do

This is the grade:

- ✅ Payment creation, server-side; secret key never in the browser
- ✅ Successful payment — a real `succeeded` in the sandbox dashboard
- ✅ Failed payment — hard declines (declined, lost, stolen), each with its own message. The soft "try again" decline is handled in code but only occurs on `fauxpay` at random, so it is not demonstrated (engineering §10)
- ✅ PayPal — a redirect to PayPal and back, confirmed server-side like any other payment
- ✅ Routing — a $40 card and a $2,000 coin land on different connectors, visible per payment in the dashboard; the buyer sees only "Card" or "PayPal", never the processor
- ✅ Payment status — authoritative server-side read, never the redirect
- ✅ Refund — one seller's order in full (a partial refund of a multi-seller payment), reached through a buyer dispute
- ✅ Marketplace fee calculation — visible on the seller page
- ✅ Seller balance — `pending → available`, moved by the seller shipping
- ✅ Saved cards — a card saved at checkout is listed on the account page from Hyperswitch's customer payment methods, and can be removed (added 2026-09-16 at the user's request; repeat collectors buy on-session, so this is the card-on-file they expect)

### Out of scope

Accessibility conformance · **webhooks** (a stateless receiver on a rotating
preview URL cannot demonstrate what webhooks are for) · **concurrency** — no
locks, reservations or sold-out races · **hold timers** — money moves on
actions · per-state sales tax · seller onboarding and KYC · shipping and
tracking integration · messaging · reviews · auctions · offers · saving bank accounts or PayPal (cards are saved, see below) ·
Apple and Google Pay · **ACH bank debit** and **Affirm** (both approaches in
§4) · a real Stripe or PayPal account behind the connectors · Stripe Connect split
payments · real payouts · card-network dispute
handling (our "dispute" is an in-marketplace claim, not a chargeback) ·
authenticity guarantee · promoted listings · seller subscriptions · real auth ·
sign-up (the mocked sign-in covers it) · **3DS challenges** — not needed for this marketplace: 3DS only shifts stolen-card chargebacks, and our dominant dispute is not-as-described · **partial refunds of one order** — a refund is always one seller's whole order · handling a buyer who abandons PayPal (the message exists; it is not demonstrated or tested).

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

**Shipping is a seller-set price per listing, charged per item, and may be
free** (`shippingCents` of 0, shown as "Free shipping", never "$0.00"). It is not
taxed, carries no commission, and passes straight through to the seller. No
combined shipping and no carrier rates: nearly every listing is one-of-one, so
most orders are a single item. The known cost is that several items from one
seller pay shipping once per item. A production build would charge each seller
group once, using its highest shipping price.

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

**Why Hyperswitch at all, when we pick the processors ourselves.** Choosing
Stripe and PayPal is a business decision; Hyperswitch is what stops that
decision from being hard-coded. It earns its place in three layers, and only
the first is visible in a sandbox.

*Now, in the build:*
- **One integration for every provider.** One payment form and one API. Adding
  PayPal, Affirm or Adyen later is a dashboard change, not a second checkout.
- **One set of payment states.** Stripe and PayPal report outcomes and decline
  reasons differently; Hyperswitch normalises them, so our order and balance
  logic is written once, against one state machine (engineering §4).
- **Routing set in the dashboard, not in code.** Today a static rule.

*At launch:*
- **Saved cards not tied to one processor.** Hyperswitch stores the card, so
  moving volume off Stripe does not mean asking collectors to re-enter cards.
  Repeat buyers are the core of this market, so that is fee negotiating power.
- **Refunds and reconciliation in one place**, whichever rail took the money.

*At volume, where Hyperswitch decides and we don't:*
- **Routing by approval rate.** Hyperswitch learns which processor approves
  more and shifts traffic before the attempt, not by retrying. At a ~$6,000
  top price, one declined payment is a lost sale of that size, so a point of
  approval rate is worth more here than in a low-ticket shop. It starts scoring
  after about 25 finished payments per connector and keeps 20% of traffic on
  the other connector to stay current.
- **Routing around outages** (elimination routing): a failing processor drops
  down the list automatically.
- **Routing US debit over cheaper networks** (Star, Pulse, NYCE, Accel). On a
  $2,000 debit payment the network fee difference is real money; the sandbox
  only supports it through Adyen.

These need a second *real* processor and payment history. Hyperswitch's
routing simulator can draw the charts, but it works by sending decline cards
at failure rates we choose, and every simulated processor declines identically on
the same card, so any "learning" it shows is one we manufactured. We show the
rule-based foundation honestly and write up the path: rules → add Adyen once
volume justifies it (which also unlocks debit routing) → turn on approval-rate
and outage routing. None of those steps changes our
code. *Changes our mind:* if we only ever needed Stripe, we would integrate
Stripe directly and skip the orchestrator.

**Providers — Stripe and PayPal, nothing else.** This is the production
choice. **The build uses the sandbox's three simulated processors** instead
(below), so every provider argument here is reasoning, not something the build
proves.

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

**Why bank debit would be offered, with limits (deferred: no sandbox
connector we use supports it).** On that same $6,000 slab ACH
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
issuer for disputes. They come for free through Stripe later.

**Affirm is deferred, and why it's on the list at all.** Pay-later fits the top
of this market: a collector who wants a $6,000 slab today and pays over months.
Affirm pays the merchant up front and carries the credit risk, so it doesn't
change our hold. Deferred because it is a second redirect method with its own
pending and declined-application states for design to cover, and Affirm may
exclude bullion. *Approach:* enable Pay Later → Affirm on a connector, offer it
only above a price floor (say $500), and treat its return exactly like PayPal's:
confirm server-side, never trust the redirect. The sandbox's `stripe_test`
already offers it, so this is a dashboard toggle plus design states, not new
integration code.

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

**Why the build uses simulated processors, not real Stripe.** Real Stripe needs
a support ticket for raw card data access with unknown lead time. The sandbox's
simulated processors cover every state the core flow needs: distinct decline
reasons and a PayPal redirect (verified, engineering §10).
Three of them on one profile make routing something a reviewer can see. What
we give up: decline messages come from a simulator, not an issuer, and bank
debit's `processing` state has no connector, so ACH is deferred (approach
above). The README says plainly that the processors are simulated.

**Routing rule, and why.** The buyer picks a payment method; Hyperswitch picks
the processor. Set in the dashboard, no code:

| Buyer chooses | Goes to | Why |
| --- | --- | --- |
| PayPal | `paypal_test` | The only connector offering the PayPal wallet, so no rule is needed. The payment method decides this, not a routing choice |
| Card, $500 or more | `stripe_test` | High-value slabs go to the established primary processor, with 3DS liability shift on a stolen card |
| Card, under $500 | 80% `stripe_test` / 20% `fauxpay` | Trialling a challenger processor against the trusted one, on orders where a failure costs a $40 sale, not a one-of-one slab |
| Fallback | `stripe_test`, `fauxpay`, then `paypal_test` | If the chosen connector is unavailable. `paypal_test` is last so a card payment never shows up as "PayPal" |

The real routing decision is the card rows: three connectors can take a card,
so something has to choose.

**Why split small card payments, and why 80/20.** A marketplace adds a second
processor for fees, negotiating leverage and outage cover, but can't judge one
without sending it real traffic: approval rate on *our* buyers is the only
number that matters, and Auth Rate Based routing (deferred) needs ~25 finished
payments per connector before it can score anything. The split collects that
data. Our price range decides where: most orders are small, most money is in
the few large ones, so orders under $500 produce data fast while risking a $40
sale, not a $6,000 slab another collector may buy first. Above $500 the goal is
first-attempt approval, and with Smart Retries refused there is no second
attempt, so those always go to the proven processor. 80/20, not 50/50, because
the point is a challenger measured against the incumbent, starting small and
raising its share if the numbers hold. The sandbox processors approve and
decline identically, so the build shows the mechanism, not a real difference
in approval rate.

**PayPal is the buyer's choice, never routing.** Unified Checkout shows the
PayPal button; a buyer who clicks it goes to `paypal_test`, the only connector
with the wallet. `paypal_test` can also take cards, which is why it sits last
in fallback. We offer PayPal to every buyer at every price because collectors
expect it; limiting it by price or category (it doesn't protect gold coins) is
a later option. It shows orchestration, not optimisation: nothing
learns, and none of the processors is real. Failure states are tested
on listings of $500 or more, so they always hit one known connector. This is
**routing before an attempt, not retrying after one**. Smart Retries stays
refused (engineering §10): re-sending a timed-out $6,000 payment to a second
processor risks charging one collector twice for another collector's coin. In
production the fallback would be a second real processor (Adyen), chosen by
auth rate once volume justifies it.

**Sign-in is mocked and gated at checkout.** Browsing is the funnel; a wall
before it blocks the only thing that makes the site look real.
