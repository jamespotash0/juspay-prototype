# Plan

**Slabbed** — a peer-to-peer marketplace for US coins and trading cards, taking
a buyer from browsing through to a real, completed payment in the Hyperswitch
sandbox.

Status: **Signed off — ready for execution.** All twelve sections approved
(1, 2, 4 and 9 re-approved 2026-09-16 after the switch to simulated processors,
PayPal and 80/20 routing). Sandbox verified end to end.

| File | Owner | Holds |
| --- | --- | --- |
| [plan/product.md](plan/product.md) | Product | Framing, scope, the money model, decisions |
| [plan/engineering.md](plan/engineering.md) | Engineering | Endpoints, payment sequence, state machine, idempotency, read model, Hyperswitch surface |
| [plan/design.md](plan/design.md) | Design | Direction, system, screens, checkout states, edge and empty states |
| [PRODUCT.md](PRODUCT.md) | Product | Durable product truth (Impeccable's record) |

> **Scope note.** `CLAUDE.md` says "core flow only". The user widened scope to
> include refunds, a seller page and an admin view so the marketplace payment
> model is demonstrable end to end. (Webhooks were in that widening and have
> since moved out of scope.) That direction
> supersedes the rule; `plan/product.md` §2 is the authority on what gets built.

---

## Sign-off log

Each section is approved, changed, or moved out of scope before any code.

| # | Section | Status |
| --- | --- | --- |
| 1 | Product — Framing | ✅ approved 2026-09-16 — point 6 added: multiple providers are structural, which is why we use an orchestrator. |
| 2 | Product — Scope | ✅ approved 2026-09-16 — **Simulated processors replace real Stripe** (`stripe_test`, `fauxpay`, `paypal_test`). **PayPal wallet added to build.** ACH and **Affirm deferred** with written approaches. |
| 3 | Product — Money model | ✅ approved — flat tax (per-state out of scope); build `pending → available` only, `held`/`negative` documented |
| 4 | Product — Decisions | ✅ approved 2026-09-16 — Stripe + PayPal stays the *production* provider choice; build uses simulated processors. **Routing:** PayPal → `paypal_test`; card ≥ $500 → `stripe_test`; card < $500 → 80/20 `stripe_test`/`fauxpay` (challenger trial); fallback `stripe_test`, `fauxpay`, `paypal_test`; PayPal is buyer choice, not routing. Affirm deferral written up. |
| 5 | Engineering — Endpoints & sequence | ✅ approved — six endpoints; fulfilment state in payment metadata via `/update_metadata` |
| 6 | Engineering — State machine & idempotency | ✅ approved — all 17 statuses kept; "operator alert" replaced with what the code does |
| 7 | Engineering — Availability & read model | ✅ approved — **concurrency out of scope**; no locks, guards or revalidation; read model unchanged |
| 8 | Engineering — Webhooks & security | ✅ approved — **webhooks out of scope**, approach documented; security boundaries unchanged |
| 9 | Engineering — Hyperswitch surface (§10) | ✅ approved 2026-09-16 — PayPal wallet Build, Affirm Defer; connector setup and test cards **verified against the sandbox 2026-09-16**; routing live and verified; Auto Retries off. |
| 10 | Design — Direction & system | ✅ approved — top bar + grid, every screen a page; system tokens approved |
| 11 | Design — Screens | ✅ approved — ten screens; confirmation = order detail; disputes = a transactions filter |
| 12 | Design — States, edge cases, empty states | ✅ approved — stale hold copy fixed; added "action didn't save" and "refund failed" |
| 13 | Product — Multi-seller cart | ✅ requested by the user 2026-09-16 — **one payment for the whole cart**, split per seller in metadata; refunds are one seller's order in full (partial against the payment). Replaces one payment per seller. Server side built and sandbox-verified; pages follow the restyle commit. |

---

## Execution order

Thinnest path to a real payment first:

0. ~~Control center: routing rule, Affirm off, Auto Retries off~~ — done and verified 2026-09-16
1. Catalogue constant, seeded with ~10 sellers and ~30 listings
2. `POST /api/checkout` → SDK mount → `GET /api/payment` → confirmation
   *(this is the whole grade; everything else is around it)*
3. Failure, pending and ambiguous states, using the simulated processors' test cards
3b. PayPal redirect and return
4. Catalogue, search, listing detail, cart
5. Seller page — mark as shipped, fee calculation, balance
6. Buyer order actions — mark as received, dispute
7. Admin — transactions, dispute queue, refund
8. Listing creation form
9. Role switcher, empty states, polish

**Sandbox verified.** Three simulated processors on the profile; PayPal wallet
on `paypal_test`. First real completed payment: **`vfy1789575028`** — `succeeded`,
$1,900.00. Decline, 3DS, PayPal redirect and routing verified 2026-09-16. `/update_metadata` confirmed working, with a write-then-verify
workaround for a connector-layer 400 (engineering §3).

## Definition of done

A payment id showing `succeeded` in the Hyperswitch sandbox dashboard · a
PayPal payment `succeeded` after the redirect · a failed payment showing its
decline reason ·
the routing rule visible in the control center, with a small and a large card
payment on different connectors · the ambiguous-outcome state
handled · a buyer dispute reaching admin and producing a real refund of that seller's
order in full · the commission and seller balance visible and moved by the
seller marking an item shipped · the statuses in engineering §4 mapped ·
README written · deployed on Vercel.
