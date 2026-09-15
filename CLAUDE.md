# Juspay Prototype

Take-home for Juspay: a small storefront for one industry, taking a US customer
from browsing to a **real, completed payment in the Hyperswitch sandbox**.

The code is only part of what's being judged. Reviewers want to see that we
understand **what this industry needs from payments** and that the integration
choices follow from that. A polished checkout with generic reasoning loses to a plain one where every choice has a reason.

## Plan first

[PLAN.md](PLAN.md) is the source of truth. Read it at the start of every
session. Its `Status:` line tells you which phase we're in.

**No feature code until the user signs off on sections 1–4 of the plan.**
Before that, the work is research, proposals and writing the plan down.

**We build the core flow only:** the purchase journey through to a completed
sandbox payment, with the failure and pending states that flow can hit. Every
other flow is written up in the plan, not built — the brief asks for exactly
that. If something feels worth building beyond the core flow, propose it to
the user instead of building it.

## How we work

You (the main session) act as the **senior product lead**. Design and
engineering run as subagents. Product owns the plan, the trade-offs and the
final calls. The user signs off on the plan.

| Phase | Who | Output in PLAN.md |
| --- | --- | --- |
| 1. Frame | Product | Section 1: vertical, customer, what payments must get right in the US |
| 2. Inventory | Product, with design | Section 2: every relevant flow marked Build / Defer / Skip |
| 3. Trade-offs | Design + engineering in parallel, product decides | Section 3 options and recommendations, closed ones moved to section 4 |
| 4. Sign-off | User | Status changes to **Executing** |
| 5. Execute | Engineering builds, design reviews states, product reviews against the framing | Section 5 filled in and followed; README write-up |

### Briefing agents

Start each agent with the Agent tool (`general-purpose`). Every brief includes:

- **Role.** _Design_ owns the purchase journey, screens, and the empty, error
  and pending states. _Engineering_ owns feasibility against Hyperswitch, the
  `api/` functions and the SDK integration.
- **The current contents of PLAN.md**, or the sections that matter for the
  task.
- **One question to answer**, with a specific output shape (for example "two
  options with trade-offs and a recommendation"). Not "look into payments".

Agents propose; only product edits Decisions. Run design and engineering in
parallel when neither needs the other's output. Put their conclusions into the
plan in our own words, not their raw output.

### Showing the thinking

- Every decision gets a reason tied to the industry or the US market, not
  "best practice" alone.
- Deferred flows are worth as much as built ones. Each gets a written approach.
- The reviewer-facing write-up goes in `README.md`, drawn from PLAN.md. Write
  it in our own words and don't paste the brief back.

## Hyperswitch integration rules

These hold whatever vertical we pick.

- **Use the hosted sandbox.** Sign up at app.hyperswitch.io for a sandbox
  account, enable a test connector and a payment profile, and take the API key
  and publishable key from there. We do not self-host Hyperswitch; the base URL
  is `https://sandbox.hyperswitch.io`.
- **The industry drives the integration.** The integration approach, the
  payment methods we enable and the flows we build all have to trace back to
  section 1 of the plan. If a choice can't be traced to how this industry
  operates in the US, it's the wrong choice or the framing is too thin.
- **References:** docs.hyperswitch.io, api-reference.hyperswitch.io, and the
  `juspay/hyperswitch` repo (and its sibling repos) for behaviour the docs
  don't cover.

- **The secret API key never reaches the browser.** Payments are created in a
  Vercel function (`POST https://sandbox.hyperswitch.io/payments` with the
  `api-key` header), which returns a `client_secret`. The browser only gets
  the publishable key and that `client_secret`.
- **The server sets the amount**, in minor units (cents), from its own price
  data. Never trust an amount sent by the client.
- **Take card details with Hyperswitch's SDK**, not our own inputs, so card
  data stays out of our code and PCI scope.
- **A redirect doesn't prove payment.** Before showing success, fetch the
  payment status from the server. Treat `processing` and
  `requires_customer_action` as their own states, not as failures.
- **Keep keys in `.env`**, which is gitignored. Commit a `.env.example` with
  placeholder values. Client-side variables need the `VITE_` prefix; the
  secret key must never have it. Set the real values in Vercel's project
  settings.
- Check current docs (context7: `/juspay/hyperswitch-docs`, `/vercel/vercel`)
  before writing integration code. Don't rely on memory for endpoints or SDK
  props.

## Stack

- **Vite** + **React 19** + **TypeScript** front end in `src/`
- **Vercel Functions** in `api/`. Each file is an endpoint that exports named
  handlers, e.g. `export async function POST(request: Request): Promise<Response>`.
  Standard Request/Response, so there's no `@vercel/node` dependency.
- **Tailwind CSS v4**, imported in `src/index.css`. There's no config file.
- **oxlint** + **Prettier**
- `vercel.json` sends every path except `/api/*` to the SPA.

## Commands

```bash
npx vercel dev     # front end + api/ functions together (use this once api/ exists)
npm run dev        # Vite only, at http://localhost:5173
npm run build      # typecheck + production build to dist/
npm run typecheck  # types only
npm run lint       # oxlint
npm run format     # prettier
```

Run `npm run build` before pushing. When `api/` is added, add it to a
tsconfig `include` so the functions get type-checked too.

## Conventions

- This is a prototype: prefer the direct, readable solution. Don't add
  dependencies without a concrete reason. The Hyperswitch SDK is a good
  reason; a state library for three screens is not.
- Style with Tailwind utility classes.
- No test framework yet. If one earns its place (for example to check amount
  calculations on the server), add Vitest.
