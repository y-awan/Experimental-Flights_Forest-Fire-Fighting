# VIP Frontend

A [Next.js](https://nextjs.org) 16 application (App Router + Turbopack) for a mission operations console, with a MapLibre/Leaflet map, fleet rails, detection feed, and command dock.

## Prerequisites

You need two tools installed before you start:

| Tool | Version | Notes |
|------|---------|-------|
| [Node.js](https://nodejs.org) | 20 or newer (tested on 22.x) | Comes with `npm`. |
| [pnpm](https://pnpm.io) | 12.x (project pins `pnpm@12.3.4`) | This project uses pnpm, not npm or yarn. |

Check what you have:

```bash
node -v
pnpm -v
```

### Installing pnpm (if you don't have it)

The easiest way is Corepack, which ships with Node.js:

```bash
corepack enable
corepack prepare pnpm@12.3.4 --activate
```

Or install it globally:

```bash
npm install -g pnpm
```

## Get it running on localhost

From the project root (`VIP_Frontend/`):

```bash
# 1. Install dependencies (first time, or when package.json changes)
pnpm install

# 2. Start the dev server
pnpm dev
```

Then open **http://localhost:3000** in your browser.

> **Note on the port:** the dev server uses port `3000` by default. If `3000` is already in use, Next.js automatically picks the next free port (e.g. `3002`) and prints the real URL in the terminal. Always check the terminal output for the line that starts with `- Local:`.

To run on a specific port instead:

```bash
pnpm dev --port 4000
```

## Available scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Start the development server with hot reload (Turbopack). |
| `pnpm build` | Create an optimized production build. |
| `pnpm start` | Serve the production build (run `pnpm build` first). |

### Running a production build locally

```bash
pnpm build
pnpm start
```

This serves the compiled app, also on http://localhost:3000 by default.

## Project structure

```
VIP_Frontend/
├── app/                  # Next.js App Router (layout, pages, global styles)
├── components/
│   ├── ops/              # Mission ops console UI (map, fleet rail, feed, docks)
│   │   └── map/          # Map layers, controllers, tiles, state
│   └── ui/               # Shared UI primitives (button, etc.)
├── lib/
│   └── mission/          # Mission data, simulation, geo + derive helpers, types
├── public/               # Static assets (icons, images, maplibre worker bundles)
├── next.config.mjs       # Next.js config
├── package.json          # Scripts and dependencies
└── tsconfig.json         # TypeScript config
```

## Troubleshooting

- **`pnpm: command not found`** — pnpm isn't installed. See [Installing pnpm](#installing-pnpm-if-you-dont-have-it) above.
- **Port already in use** — Next.js will fall back to another port automatically. Read the `- Local:` line in the terminal for the actual URL, or pass `--port <number>`.
- **Dependency or build errors after a `git pull`** — re-run `pnpm install` to sync your `node_modules` with the latest lockfile.
- **Wiping and reinstalling** — if things get into a weird state:
  ```bash
  rm -rf node_modules .next
  pnpm install
  pnpm dev
  ```
- **TypeScript errors don't block the build** — `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so a `pnpm build` can succeed even with type errors. Run your editor's TypeScript checks to catch them.
