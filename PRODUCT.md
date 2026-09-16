# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Collectors of US coins and trading cards**, buying and selling with each
other. A buyer and a seller are two different people, but **any account can be
either** — most active collectors do both, and there is no separate seller
account type.

Two situations sit inside one product:

- **Buying:** browsing one-of-one inventory, deciding on a single item, and
  paying a stranger for something they cannot inspect first. Prices run from a
  $20 raw card to a $6,000 graded coin. Once it arrives, they mark it received
  — or dispute it.
- **Selling:** listing an item, shipping it directly to the buyer, marking it
  shipped, and seeing what they are owed.

A third, internal role — **admin** — reviews transactions and disputes, and
issues refunds.

**The prototype's actual audience is a Juspay reviewer** evaluating payments
judgement. That makes the payment machinery itself part of the subject matter:
states must be legible and inspectable rather than hidden behind a spinner.

## Product Purpose

Slabbed is a peer-to-peer marketplace where collectors buy and sell graded
coins and cards. The buyer pays Slabbed, Slabbed holds the funds, the seller
ships directly to the buyer, and the money is released to the seller when they
mark the item shipped, minus a commission.

This build is a **prototype** whose success is a real, completed payment in the
Hyperswitch sandbox, with the failure, pending and ambiguous states that flow
can actually hit made visible.

## Positioning

The hold is the product. Slabbed's promise is not that items are authentic — it
is that **the seller does not get paid until they ship, and a buyer who
disputes can get their money back**. That is what makes a stranger-to-stranger
purchase feel survivable, and it is a fact about the money rather than a badge.

## Operating Context

```
Buyer ──pays──> Slabbed ──holds──> (seller ships directly) ──releases──> Seller
                   │                                                       │
                   ├── commission ──> Slabbed          payout ────────────┘
                   └── sales tax ───> State            to PayPal / bank
```

Inventory is **one-of-one**: there is exactly one of each item. In production
that makes every listing a race; concurrency handling is out of scope for this
prototype.

Seller proceeds leave the platform to an **external payout instrument** (PayPal
or a bank account). There is no spendable platform wallet, so a dual-role user
buying something pays by card like anyone else.

Listings carry category vocabulary that must be shown accurately: grading
service (PCGS, PSA, NGC, BGS, CGC), certificate number, grade, and for coins
year and mint mark. A listing without a grade reads as fake to anyone in the
category.

## Capabilities and Constraints

**Built:** mocked sign-in (Google / Apple / continue with email); browse and
search; listing detail; cart; per-seller checkout on the Hyperswitch Unified
Checkout SDK; real sandbox payment; order page with **mark received** and
**dispute**; order list; seller page with listings, sales, **mark shipped**,
commission and balance; create-a-listing form; admin transactions, dispute
filter, payment detail and refund; a role-switcher dropdown between buyer,
seller and admin.

**Money moves on actions, not timers.** Seller marks shipped → funds become
available. Buyer disputes → admin refunds → the balance reverses. Fulfilment
state is stored in the Hyperswitch payment's own metadata.

**Seeded with mock data:** roughly 10 sellers and 30 listings.

**No database and no server state.** The catalogue, sellers and orders are mock
data held client-side. Thin serverless functions exist for one reason only: the
Hyperswitch secret key must never reach the browser, so payments are created
server-side. Hyperswitch itself is the authoritative record for payment status.

**Stack:** Vite, React 19, TypeScript, Tailwind CSS v4, serverless functions on
Vercel.

**Payments are real, not simulated.** Card payments complete against the
Hyperswitch sandbox. Wallets, PayPal and ACH cannot be demonstrated on the
sandbox's dummy connector and are documented rather than built.

**Explicitly out of scope:** accessibility conformance (no standard claimed or
audited); webhooks; concurrency and sold-out races; hold timers and inspection
windows; per-state sales tax; price-based reassurance; seller onboarding and
KYC; shipping and tracking integration; messaging; reviews; auctions; offers
and negotiation; saved cards; real payouts; card-network chargeback handling;
authenticity guarantee programmes; promoted listings; seller subscriptions;
real authentication.

## Brand Commitments

**Name: Slabbed** — collector slang for a graded item sealed in a tamper-proof
holder. The only fixed identity element; no logo, colours or typography have
been chosen.

**Structure is conventional by standing preference.** The user chose the
category-standard marketplace arrangement — catalogue → detail — over a themed
visual world, on the grounds that a marketplace should generalise and the
specificity belongs in the content rather than the chrome. Craft bar: eBay,
Mercari and Depop, including their seller surfaces. Identity stays restrained
but not anonymous: one committed type pairing, one accent, a real point of view
in density.

**Voice, established in the payments copy and binding on the rest:** plain,
specific, and never blaming the customer. Bank declines say "your bank"; our
own failures say "we" and lead with "nothing has been charged". Uncertainty is
stated outright rather than smoothed over — the ambiguous payment state reads
"We're not sure whether that went through. Don't pay again yet." Raw error
codes are never shown.

## Evidence on Hand

Real: a Hyperswitch sandbox integration, genuine payment and refund records,
and real decline reasons from sandbox test cards.

**Fabricated and must be labelled as such:** all sellers, listings, photos,
ratings, sales history and balances. Sign-in is mocked and creates no real
account. No real users, testimonials, transaction volumes or press exist, and
none may be invented.

## Product Principles

1. **The hold is the promise.** Say plainly that the seller is paid only once
   they ship; it is the most persuasive fact available, and hiding it trades
   the argument for nothing.
2. **Money moves on actions a person takes.** Shipped, received, disputed,
   refunded — every transition is something someone does and a reviewer can
   click, never a timer nobody watches fire.
3. **Make the payment machinery legible.** States, amounts and outcomes are the
   subject, not plumbing to hide. Uncertainty is shown, not smoothed.
4. **Never risk charging someone twice.** A lost sale is recoverable; a
   duplicate charge between two individuals is not.
5. **Show only money state that really happened.** No fabricated payouts or
   balances — if the sandbox cannot produce it, it is written up, not rendered.

## Accessibility & Inclusion

Out of scope for this prototype at the user's direction. No standard is claimed
or audited. Semantic markup and real controls come free with the component
choices; no conformance claim may be made in the README on that basis.
