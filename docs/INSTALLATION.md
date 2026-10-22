# Installation

This guide covers local setup, production build, and common troubleshooting.

## Prerequisites

- Node.js 20.19+ or 22.12+ (Node 24 is used in regression checks)
- npm 9+

Verify versions:

```bash
node -v
npm -v
```

## Local Setup

### Standard Setup

```bash
npm install
npm run dev
```

Default URL: `http://localhost:5173`

### First Run Checklist

- Ensure there are no terminal errors after `npm install`
- Open the URL and verify the Home screen loads
- Keep the dev server running while making changes

For a reproducible install, keep `package-lock.json` and run `npm ci`. Check the Node version and the reported installation error before changing dependencies.

If the app does not start correctly:

```bash
npm run dev -- --host
```

Use this when local network or host binding behavior causes startup issues.

## Build & Preview

```bash
npm run build
npm run preview
npm run lint
```

- `build` generates static assets in `dist/`
- `preview` serves the production build locally
- `lint` checks code style and common issues

## Deploy

This is a static Vite app. Deploy the `dist/` folder to any static host.

### Vercel / Netlify

- Build command: `npm run build`
- Output directory: `dist`

### GitHub Pages

The current manifest and service worker use root-relative paths. A subpath deployment needs those paths and the build asset URLs reviewed together; changing only `base` is insufficient. Keep an existing installation on its current origin to retain access to local data.

## PWA Notes

- Install prompt availability depends on browser support and engagement rules
- Updates activate after open copies close. Reopen online once, then verify offline use. Some browsers need up to 30 seconds before Retry can acquire the previous editing lock.

## Quick Troubleshooting

- Port conflict: `npm run dev -- --port 3000`
- Blank deploy: verify `base` config and hard refresh
- Offline cache issue: reconnect and close/reopen the app. **Do not clear site data or IndexedDB**: that deletes your habits. Preserve recovery downloads before troubleshooting.
- Missing local data: verify the same origin, browser/profile, and installed app. Keep all stored copies; inspect IndexedDB without deleting or resetting it. See [data safety](DATA_SAFETY.md).

For contribution workflow and PR expectations, see [CONTRIBUTING.md](CONTRIBUTING.md).
