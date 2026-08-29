# kuzmano.ski

## Get started

Requires the Node version in `.nvmrc`.

```bash
npm install
cp .env.example .env
npm run dev
```

## Content

Content is written in MDX. Frontmatter uses:

```yaml
title: Post Title
description: Collection entry lists and the meta description show this text.
date: 2026-07-19
draft: false # Optional. The dev server renders a draft. The build omits it.
```

Frontmatter is validated by `src/content/schema.ts`. MDX elements are mapped to
app components by `src/content/mdx-components.tsx`.

Content is located in:

- `src/content/_pages/*.mdx`: standalone pages
- `src/content/<collection>/*.mdx`: collection entries

File and folder names become URL segments and must be URL-safe.
`build/prerender/routes.ts` validates this and generates the prerender list and
sitemap data. A page uses its frontmatter date as `lastmod`; a collection uses
the newest date among its entries.

Routes are dynamic (`src/routes/$segment/`), so pages and collections do not
need route files.

### Pages

1. Add an MDX file to `src/content/_pages`.
2. Add its file name, without `.mdx`, to PAGE_SLUGS in `src/config/content.ts`.
3. Add it to DESTINATIONS and DESTINATION_GROUPS in `src/config/navigation.ts`.

Page titles come from frontmatter; the configuration only needs the file name.

### Collections

1. Create a subfolder in `src/content`.
2. Add its title and description to COLLECTIONS in `src/config/content.ts`,
   keyed by the folder name.
3. Add it to DESTINATIONS and DESTINATION_GROUPS in `src/config/navigation.ts`.

### Styling

All content shares `src/content/content.module.css`. To give a page or entry
styles of its own, add a CSS module that exports a `page` class beside its MDX
file under the same name (e.g., `about.mdx` and `about.module.css`).

## Contact form

Messages are sent through Cloudflare's `send_email` binding.

### Cloudflare Worker types

`src/server/cloudflare.d.ts` contains the minimal type declarations for the
Worker APIs used by the application. They are maintained manually because
`wrangler types` does not provide a usable declaration for `cloudflare:workers`.

If the Workers runtime or Wrangler version changes, check these declarations
against the generated types:

```bash
npx wrangler types /tmp/worker-configuration.d.ts
```

### Configuration

1. Enable
   [Email Sending](https://dash.cloudflare.com/?to=/:account/email-service/sending)
   for the domain.
2. Add and verify the inbox as a
   [destination address](https://dash.cloudflare.com/?to=/:account/email-service/routing/destination-addresses).
3. Set the destination address as the `CONTACT_EMAIL_ADDRESS` Worker secret:

   ```bash
   npm exec -- wrangler secret put CONTACT_EMAIL_ADDRESS
   ```

4. Put the same email address in `.env` as `CONTACT_EMAIL_ADDRESS` for local
   development.

The dev server uses the same Worker code path through Miniflare, but does not
send messages. Local messages are written to `.wrangler/tmp/email/`.

### Delivery failures

The browser only receives a status. Check the Worker logs for:

- `contact_binding_missing`: the required binding or secret is missing.
- `contact_delivery_failed`: Cloudflare rejected the message. The error code
  identifies the cause, such as `E_SENDER_NOT_VERIFIED`,
  `E_RECIPIENT_NOT_ALLOWED`, `E_DELIVERY_FAILED`, or a quota error.

## Rate limiting

- `/api/contact` uses two Workers rate limiting bindings declared in
  `wrangler.jsonc`, one for sending and one for reading the email address. They
  are deployed with the Worker and need no additional configuration.
- `/api/client-errors` uses a
  [Cloudflare rate limiting rule](https://dash.cloudflare.com/?to=/:account/:zone/security/security-rules).

  Expression:

  ```
  (http.request.method eq "POST" and http.request.uri.path eq "/api/client-errors")
  ```

## Deployment

`main` is deployed by `.github/workflows/ci.yml` after the verify job passes.

To deploy manually:

```bash
wrangler login
npm run build
npx wrangler deploy
```

The build produces:

- Prerendered pages as static assets
- `dist/server/server.js` as the TanStack Start SSR handler

Cloudflare serves a matching static asset; otherwise, it invokes the Worker.

## Testing

```bash
npm test
```

Tests render real routes through the router. This catches issues that isolated
MDX rendering can miss, such as routes that depend on a loader to resolve an MDX
module.

vitest.config.ts uses the same MDX pipeline as the build via build/mdx.ts, with
syntax highlighting disabled for speed.
