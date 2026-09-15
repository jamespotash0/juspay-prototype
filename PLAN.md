# Plan

The working plan for the prototype. Product owns this document. Design and
engineering add proposals, product makes the calls, and the user signs off
before any feature code is written.

Status: **Framing**. The vertical is not chosen yet.

---

## 1. Framing

_Fill in first. Everything below depends on it._

- **Vertical and customer:** who is buying, what they're buying, and on what
  device.
- **The business:** who gets paid, when they deliver, and what they'd lose on
  a bad payment.
- **What payments have to get right here (US market):** the 3–5 things that
  make this industry's payments different from generic retail. For example:
  when the money moves compared with when the service is delivered, how
  refunds and disputes happen, which payment methods customers expect, how
  much fraud there is, and whether money is split between parties.

## 2. Flow inventory

Every flow this industry needs goes here, even the ones we won't build. The
brief rewards naming the right flows and explaining the cut ones as much as
building them.

**We build the core flow only:** the purchase journey through to a completed
payment in the Hyperswitch sandbox, including the failure and pending states
that flow can actually hit. Everything else is documented, not built.

Status is one of **Build** (the core flow), **Defer** (matters here, out of
scope, approach written down) or **Skip** (not relevant, with a one-line
reason). Adding a second Build row means cutting something else or asking the
user first.

The rows are a starting list, not a verdict. Add, remove or rename them once
the framing is done.

| Flow | Why it matters in this industry | Status | Approach if deferred |
| --- | --- | --- | --- |
| Browse → cart → checkout → paid (**the core flow**) | | Build | — |
| Payment methods: cards | | | |
| Payment methods: Apple Pay / Google Pay | | | |
| Payment methods: PayPal, ACH, buy now pay later | | | |
| Declined or failed payment and retry | | | |
| Pending or needs-customer-action states (3DS, redirects) | | | |
| Authorise now, capture later | | | |
| Saved payment methods / returning customer | | | |
| Recurring or instalment billing | | | |
| Refunds (full and partial) | | | |
| Disputes and chargebacks | | | |
| Webhooks and order reconciliation | | | |
| Split payments or payouts to third parties | | | |
| Receipts, tax, confirmation comms | | | |

## 3. Trade-offs

Each open question lists its options, a recommendation with the reason, and
what would change our mind. Product closes it by moving it to Decisions.

### Hyperswitch integration approach

| Option | Gains | Costs |
| --- | --- | --- |
| Unified Checkout SDK (payment form embedded in our page) | Our own look and flow, card data stays out of our code, wallets included | Needs a server to create payments, and a status check after redirects |
| Payment Links (checkout hosted by Hyperswitch) | Fastest to build, almost no front-end work | Customer leaves our page, little control over the experience, weaker demo of our choices |
| Direct API only (our own payment form) | Full control | We'd handle card data ourselves (PCI scope), and it's a lot to build for a prototype |

Recommendation: _pending framing_

### Other open questions

- _Add as they come up: payment method mix, capture timing, whether customers
  need accounts, and so on._

## 4. Decisions

Newest last. Format: **decision**: reason.

- **No database:** the catalogue is a constant in the server code, and
  Hyperswitch holds the payment itself — the order status is read back from it
  by payment ID. A database only starts paying for itself with things we're
  not building (webhook handling, reconciliation, retry-safe order records),
  so it's a deferred flow, not a missing piece. Revisit if the framing needs
  state that outlives one checkout, such as subscriptions or a seller ledger.
- **Host on Vercel:** Hyperswitch payments must be created on a server with
  the secret key. Vercel runs files in `api/` as server functions next to the
  Vite front end, in one deploy.

## 5. Execution

_Fill in once sections 1–4 are signed off._

- **Scope for the build:** the core flow only. Anything not on that path is
  documented in section 2, not built.
- **Workstreams:** who owns what (design: screens and states; engineering:
  `api/` functions and the SDK integration; product: copy, review, README
  write-up), and what each one waits on.
- **Order of work:** the thinnest path to a real sandbox payment first, then
  everything around it.
- **Definition of done:** a payment ID that shows as succeeded in the
  Hyperswitch sandbox dashboard, failure and pending states handled, the
  README write-up done, and the site deployed on Vercel.
- **Risks:** what could block us (sandbox connector setup, wallet domain
  verification, and so on) and the fallback for each.
