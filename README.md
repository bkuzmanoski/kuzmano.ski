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
category: Notes # Optional. Groups an entry within its collection.
draft: false # Optional. The dev server renders a draft. The build omits it.
```

Content is located in:

- `/content/_pages/*.mdx`: standalone pages
- `/content/<collection>/*.mdx`: collection entries

File and folder names become URL segments and must be URL-safe.

### Standalone pages

1. Add an MDX file to `/content/_pages`.
2. Add its file name, without `.mdx`, to `PAGE_SLUGS` in
   `/src/config/content.ts`.
3. Add it to `DESTINATION_SPECS` and `DESTINATION_GROUPS` in
   `/src/config/navigation.ts`.

### Collections

1. Create a subfolder in `/content`.
2. Add its title and description to `COLLECTIONS` in `/src/config/content.ts`,
   keyed by the folder name.
3. Add it to `DESTINATION_SPECS` and `DESTINATION_GROUPS` in
   `/src/config/navigation.ts`.

A collection has no document of its own to carry frontmatter, so its title comes
from `COLLECTIONS`.

### Styling

Styles defined in `/src/features/content/content-body.module.css` apply to all
content. To define custom styles for a single entry, add a CSS module that
exports an `entry` class beside its MDX file under the same name (e.g.,
`entry.mdx` and `entry.module.css`).

### Markdown alternates

Markdown is generated for every published entry and every collection:

- `/<page>.md` or `/<collection>/<entry>.md`: a published page or collection
  entry as Markdown, including its frontmatter
- `/<collection>.md`: an index of the collection's published entries

React components in MDX are replaced by their children. Specify fallback
Markdown for a component in `/build/markdown.ts` (`COMPONENT_MARKDOWN`) when it
needs a different representation.

### Atom feeds

A feed is generated for the entire site as well as for each collection.
Standalone pages are not included. This is configurable via `FEEDS` in
`/src/site/feeds.ts`.

React components that should not appear in a feed can mark their rendered output
with `data-feed-omit`. Components that need a representation in a feed can use
`data-feed-text` to replace their rendered output with text.

## Contact form

Messages are sent through Cloudflare's `send_email` binding.

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

### Cloudflare Worker types

`/src/server/cloudflare.d.ts` contains the minimal type declarations for the
Worker APIs used by the application. They are maintained manually because
`wrangler types` does not provide a usable declaration for `cloudflare:workers`.

If the Workers runtime or Wrangler version changes, check these declarations
against the generated types:

```bash
npx wrangler types /tmp/worker-configuration.d.ts
```

## Waitlist

The `Waitlist` component can be added to an entry to register user interest.
When a user joins, it adds their email address to a Notion database.

### Configuration

1. Create a Notion database with these properties:

   | Property | Type  |
   | -------- | ----- |
   | `List`   | Text  |
   | `Email`  | Title |
   | `Source` | URL   |

   Optionally, add a `Created time` property of type `Created time` to record
   when each membership was added. Other properties are ignored.

2. Create a [connection](https://app.notion.com/developers/connections) with the
   `Read content` and `Insert content` capabilities and content access to the
   database created above, then set its access token as the `NOTION_TOKEN`
   Worker secret:

   ```bash
   npm exec -- wrangler secret put NOTION_TOKEN
   ```

3. Set the production data source ID (see below) as the
   `WAITLIST_DATA_SOURCE_ID` Worker secret:

   ```bash
   npm exec -- wrangler secret put WAITLIST_DATA_SOURCE_ID
   ```

4. Put the connection access token and the development data source ID in `.env`
   for local development.

To find the data source IDs for databases the connection can reach, run the
following command:

```bash
curl -s -X POST https://api.notion.com/v1/search \
  -H "Authorization: Bearer <NOTION_TOKEN>" \
  -H "Notion-Version: 2026-03-11" \
  -H "Content-Type: application/json" \
  -d '{"filter":{"property":"object","value":"data_source"}}' \
  | jq '.results[] | {id, name: .title[0].plain_text, database: .parent.database_id}'
```

The property names above and Notion API version are pinned in
`/src/server/waitlist.ts`.

### Join failures

The browser only receives a status. Check the Worker logs for:

- `waitlist_binding_missing`: the required secret is missing.
- `waitlist_lookup_failed`: the check for an existing membership failed. The
  membership is still written, at the risk of a duplicate row.
- `waitlist_join_failed`: Notion rejected the row. The status identifies the
  cause: `401` for a token that cannot reach the database, `400` for a property
  that no longer matches the schema above.

## Rate limits

`wrangler.jsonc` defines rate limit bindings for:

- reading the contact email address and sending messages (see `/api/contact`)
- joining a waitlist (see `/api/waitlist`)

These are deployed with the Worker and need no additional configuration.

`/api/client-errors` uses a
[Cloudflare rate limiting rule](https://dash.cloudflare.com/?to=/:account/:zone/security/security-rules)
with the expression:

```text
(http.request.method eq "POST" and http.request.uri.path eq "/api/client-errors")
```

## Image assets

### Favicon and app icons

The favicon and app icons in `/public` are generated from
`/src/assets/images/logo.svg` and the color palette defined in CSS (see
`/build/palette.ts`). To regenerate them, run:

```bash
npm run generate:icons
```

The build fails if the generated icons no longer match their inputs.

### Illustrations

The illustrations in `/src/assets/images` ship as an AVIF and WebP pair.
`scripts/compress-image.sh` encodes both from a source PNG:

```bash
scripts/compress-image.sh src/assets/images/macintosh-body.png
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
