# Juspay Prototype

A prototype built for a Juspay interview take-home. Optimized for fast iteration
and a clean, reviewable repo — not for production hardening.

## Stack

- **Vite** + **React 19** + **TypeScript** — static SPA, no server runtime
- **Tailwind CSS v4** — imported in `src/index.css` via `@import 'tailwindcss'`;
  there is no `tailwind.config.js`, v4 is configured in CSS
- **oxlint** for linting
- **Netlify** for deploys (`netlify.toml`, publishes `dist/`)

## Commands

```bash
npm run dev        # dev server at http://localhost:5173
npm run build      # typecheck + production build to dist/
npm run typecheck  # types only, no emit
npm run lint       # oxlint
npm run preview    # serve the production build locally
```

Before pushing, run `npm run build` — it runs `tsc -b` first, so it catches
type errors and Netlify build failures in one shot.

## Layout

```
src/
  main.tsx     # React root, imports index.css
  App.tsx      # top-level component — the prototype lives here and below
  index.css    # Tailwind import + any global styles
public/        # static assets served at /
netlify.toml   # build command + SPA redirect
```

## Conventions

- Keep components in `src/`; colocate a component's files next to it once a
  feature grows past a single file.
- Style with Tailwind utility classes. Reach for a CSS file only when utilities
  genuinely can't express it.
- No test framework is set up yet. If tests become useful, add Vitest — it
  shares Vite's config and is the lowest-friction option here.
- This is a prototype: prefer the direct, readable solution over an abstracted
  one. Don't add dependencies without a concrete reason.

## Deploying

Netlify auto-detects `netlify.toml`. Connect the GitHub repo in the Netlify UI
and it builds on every push. The SPA redirect is already configured, so
client-side routes won't 404 on refresh.
