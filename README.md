# kuzmano.ski

## Getting started

Requires the Node version in `.nvmrc`.

```bash
npm install
npm run dev      # http://localhost:3000
```

## Content

Content lives in `src/content/<collection>/*.mdx`. Frontmatter is validated at build time by `src/content/schema.ts`.

```mdx
---
title: Post Title
description: Shown in listings and as the meta description.
date: 2026-07-19
draft: false # optional; drafts render in dev, are omitted from builds
---
```

Embedded HTML elements are mapped to app components in `src/ui/mdx-components.tsx`.

The list of pages to prerender is derived from the content directory by `build/content-pages.ts`, so a new post needs no configuration.

Adding a _collection_ means creating the folder, exporting one more `collection("name")` from `src/content/index.ts`, and adding two route files—both of which reuse `indexRoute`/`postRoute` from `src/content/routes.ts`.

## Deploying

`.github/workflows/ci.yml` deploys `main` after the verify job passes.

Manually, once `wrangler login` has been run:

```bash
npm run build
npx wrangler deploy
```

The build produces two things:

- Prerendered pages served as static assets
- `dist/server/server.js` (TanStack Start SSR handler)

Cloudflare serves a matching asset when one exists and only falls through to the Worker otherwise.

## Tests

`npm test` renders real routes through the router to ensure that a post that renders fine in isolation is still correct when its MDX module is resolved through a mechanism that only works if a loader happened to run first.

`vitest.config.ts` shares the MDX pipeline with the build via `build/mdx.ts`, minus syntax highlighting.
