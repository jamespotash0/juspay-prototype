# Juspay Prototype

A prototype built for Juspay.

## Getting started

Requires Node 22+.

```bash
npm install
npm run dev
```

The dev server runs at http://localhost:5173.

## Scripts

| Command             | What it does                         |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the dev server with hot reload |
| `npm run build`     | Typecheck and build to `dist/`       |
| `npm run typecheck` | Typecheck only                       |
| `npm run lint`      | Lint with oxlint                     |
| `npm run format`    | Format with Prettier                 |
| `npm run preview`   | Serve the production build locally   |

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 (configured in `src/index.css`, no config file)
- oxlint + Prettier
- Vercel: static front end plus server functions in `api/`

## Deploying to Vercel

`vercel.json` sends every path except `/api/*` to the SPA, so client-side
routes survive a refresh.

1. Go to [Vercel](https://vercel.com/new) and import this GitHub repository
2. Vercel detects Vite. Accept the defaults and add the Hyperswitch keys under
   **Environment Variables**
3. Deploy

Every push to the connected branch triggers a new deploy. Locally, run
`npx vercel dev` to serve the front end and the `api/` functions together.

## Working on this with Claude Code

This repo is set up for [Claude Code](https://claude.com/claude-code):

- `CLAUDE.md` gives Claude the project's stack, commands, layout, and conventions
- `.claude/settings.json` pre-approves the routine commands (build, lint, git status)
  so you get fewer permission prompts
- `.vscode/extensions.json` recommends the Claude Code extension

To use it in VS Code:

1. Clone the repo and open the folder in VS Code
2. Accept the recommended extensions prompt, or install **Claude Code** from the
   Extensions panel
3. Open the Claude Code panel and run `/login` if you haven't authenticated

Claude picks up `CLAUDE.md` automatically when the repo is the workspace root.
