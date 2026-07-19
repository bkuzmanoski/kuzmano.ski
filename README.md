# kuzmano.ski

## Getting started

Requires the Node version in `.nvmrc`.

```bash
npm install
npm run dev      # http://localhost:3000
```

## Scripts

| Script               | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `npm run dev`        | Dev server on port 3000                   |
| `npm run build`      | Build and prerender to `dist/client`      |
| `npm run preview`    | Serve the production build locally        |
| `npm test`           | Run the test suite once                   |
| `npm run test:watch` | Run tests in watch mode                   |
| `npm run typecheck`  | `tsc --noEmit`                            |
| `npm run lint`       | Prettier, ESLint, Stylelint, markdownlint |
| `npm run lint:fix`   | Same, applying fixes                      |

`.github/workflows/ci.yml` runs lint, typecheck, test and build on every push
and pull request, then deploys on `main` only if all of that passed;
`lint-staged` runs the formatters on commit.

## Content

Content lives in `src/content/<collection>/*.mdx` and is picked up
automatically — there is no registration step. Frontmatter is validated at build
time by `src/content/schema.ts`; a malformed post fails the build rather than
reaching the site.

```mdx
---
title: Post Title
description: Shown in listings and as the meta description.
date: 2026-07-19
draft: false # optional; drafts render in dev, are omitted from builds
---
```

Because the files are MDX rather than plain Markdown, interactive components can
be dropped straight into prose. HTML elements are mapped to app components in
`src/ui/mdx-components.tsx`.

Code blocks are highlighted by Shiki at build time in both light and dark
themes; the dark values ride along as `--shiki-dark` custom properties that
`src/styles.css` swaps under `prefers-color-scheme`. No highlighter ships to the
client.

Collections are globbed lazily so each post becomes its own chunk. Listing pages
read frontmatter through a route loader, and because loaders run during
prerender their results are serialized into the HTML — an index page renders
without downloading any post chunks. To add a collection, export one more
`collection("name")` from `src/content/index.ts` and add matching routes.

## Deploying

Deploying is the second job of `.github/workflows/ci.yml`. It runs only on
`main` and only after the verify job passes, and it uploads the artifact that
job built rather than rebuilding — so what ships is what was tested. It needs
two repository secrets:

- `CLOUDFLARE_API_TOKEN` — a token with the **Workers Scripts: Edit** permission
- `CLOUDFLARE_ACCOUNT_ID`

Manually, once `wrangler login` has been run:

```bash
npm run build
npx wrangler deploy
```

`wrangler.jsonc` declares `dist/client` as a static asset directory with no
Worker script. `not_found_handling` is set to `404-page`, which is why the build
emits a flat `404.html` (configured under `pages` in `vite.config.ts`) — unknown
paths get a real 404 status rather than a 200.
