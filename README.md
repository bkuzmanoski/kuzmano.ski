# kuzmano.ski

## Get started

This project needs the Node version in `.nvmrc`.

```bash
npm install
npm run dev # Starts the dev server on http://localhost:3000
```

## Content

Content files are in `src/content/<collection>/*.mdx`. At build time,
`src/content/schema.ts` validates their frontmatter.

```mdx
---
title: Post Title
description: The listings and the meta description show this text.
date: 2026-07-19
draft: false # Optional. The dev server renders a draft. The build omits it.
---
```

`src/content/mdx-components.tsx` maps HTML elements in the MDX files to app
components.

`build/content.ts` makes a list of pages to prerender from the content
directory. A new post needs no configuration.

The routes are dynamic (`src/routes/$segment/`), so a collection needs no route
files of its own. To add a collection:

1. Make a subfolder in `src/content`
2. Add it to `DESTINATIONS` and `DESTINATION_ORDER` in
   `src/config/navigation.ts`.

## Deploy

`.github/workflows/ci.yml` deploys `main` after the verify job passes.

To deploy manually, first run `wrangler login`.

```bash
npm run build
npx wrangler deploy
```

The build makes two things:

- Prerendered pages, which Cloudflare sends as static assets
- `dist/server/server.js`, the TanStack Start SSR handler

If a matching asset exists, Cloudflare sends that asset. If no asset matches,
Cloudflare calls the Worker.

## Tests

`npm test` renders real routes through the router. A post can render correctly
alone but still fail in the app. This happens because the router resolves an MDX
module through a path but the path works only after a loader runs.

`vitest.config.ts` uses the same MDX pipeline as the build through
`build/mdx.ts`, but without syntax highlighting for speed.
