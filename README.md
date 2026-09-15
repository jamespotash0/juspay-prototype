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
- Deployed as a static site on Netlify

## Deploying to Netlify

`netlify.toml` is already set up — build command `npm run build`, publish
directory `dist`, with an SPA redirect so client-side routes survive a refresh.

1. Go to [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Connect GitHub and pick this repository
3. Netlify reads `netlify.toml`, so accept the detected settings and deploy

Every push to the connected branch triggers a new deploy.

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
