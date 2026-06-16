# Getting Started

## Deploy with Nitro

This project uses Nitro as a generic server adapter, so it can run on any Node-compatible host.

```bash
npm run build
node dist/server/index.mjs
```

The build output is a self-contained Node server. To deploy, push the `dist/` directory to your host (Render, Fly.io, your own VPS, etc.) and run the server command above.

For host-specific presets (Vercel, Netlify, Cloudflare, AWS Lambda, etc.) and tuning, see <https://v3.nitro.build/deploy>.

## Strapi CMS Integration

This add-on integrates Strapi CMS with your TanStack Start application using the official Strapi Client SDK.

### Features

- Article listing with search and pagination
- Article detail pages with dynamic block rendering
- Rich text, quotes, media, and image slider blocks
- Markdown content rendering with GitHub Flavored Markdown
- Responsive image handling with error fallbacks
- URL-based search and pagination (shareable/bookmarkable)
- Graceful error handling with helpful setup instructions

### Project Structure

```
parent/
├── client/                 # TanStack Start frontend (your project name)
│   ├── src/
│   │   ├── components/
│   │   │   ├── blocks/     # Block rendering components
│   │   │   ├── markdown-content.tsx
│   │   │   ├── pagination.tsx
│   │   │   ├── search.tsx
│   │   │   └── strapi-image.tsx
│   │   ├── data/
│   │   │   ├── loaders/    # Server functions
│   │   │   └── strapi-sdk.ts
│   │   ├── lib/
│   │   │   └── strapi-utils.ts
│   │   ├── routes/demo/
│   │   │   ├── strapi.tsx              # Articles list
│   │   │   └── strapi.$articleId.tsx   # Article detail
│   │   └── types/
│   │       └── strapi.ts
│   ├── .env.local
│   └── package.json
└── server/                 # Strapi CMS backend (create manually or use hosted Strapi)
    ├── src/api/            # Content types
    ├── config/             # Strapi configuration
    └── package.json
```

### Quick Start

Create your Strapi project separately (or use an existing hosted Strapi instance), then point this app to it with `VITE_STRAPI_URL`.

**1. Set up Strapi:**

Follow the Strapi quick-start guide to create a local project, or use your existing Strapi deployment:

- <https://docs.strapi.io/dev-docs/quick-start>

If you created a local Strapi project in a sibling `server` directory, continue with:

```bash
cd ../server
npm install    # or pnpm install / yarn install
```

**2. Start the Strapi server:**

```bash
npm run develop    # Starts at http://localhost:1337
```

**3. Create an admin account:**

Open <http://localhost:1337/admin> and create your first admin user.

**4. Create content:**

In the Strapi admin panel, go to Content Manager > Article and create some articles.

**5. Start your TanStack app (in another terminal):**

```bash
cd ../client   # or your project name
npm run dev    # Starts at http://localhost:3000
```

**6. View the demo:**

Navigate to <http://localhost:3000/demo/strapi> to see your articles.

### Environment Variables

The following environment variable is pre-configured in `.env.local`:

```bash
VITE_STRAPI_URL="http://localhost:1337"
```

For production, update this to your deployed Strapi URL.

### Demo Pages

| URL                       | Description                              |
| ------------------------- | ---------------------------------------- |
| `/demo/strapi`            | Articles list with search and pagination |
| `/demo/strapi/:articleId` | Article detail with block rendering      |

### Search and Pagination

- **Search**: Type in the search box to filter articles by title or description
- **Pagination**: Navigate between pages using the pagination controls
- **URL State**: Search and page are stored in the URL (`?query=term&page=2`)

### Block Types Supported

| Block              | Component | Description            |
| ------------------ | --------- | ---------------------- |
| `shared.rich-text` | RichText  | Markdown content       |
| `shared.quote`     | Quote     | Blockquote with author |
| `shared.media`     | Media     | Single image/video     |
| `shared.slider`    | Slider    | Image gallery grid     |

### Dependencies

| Package          | Purpose                  |
| ---------------- | ------------------------ |
| `@strapi/client` | Official Strapi SDK      |
| `react-markdown` | Markdown rendering       |
| `remark-gfm`     | GitHub Flavored Markdown |
| `use-debounce`   | Debounced search input   |

### Running Both Servers

Open two terminal windows from the parent directory:

**Terminal 1 - Strapi:**

```bash
cd server && npm run develop
```

**Terminal 2 - TanStack Start:**

```bash
cd client && npm run dev   # or your project name
```

### Customization

**Change page size:**
Edit `src/data/loaders/articles.ts` and modify `PAGE_SIZE`.

**Add new block types:**

1. Create component in `src/components/blocks/`
2. Export from `src/components/blocks/index.ts`
3. Add case to `block-renderer.tsx` switch statement
4. Update populate in articles loader

**Add new content types:**

1. Add types to `src/types/strapi.ts`
2. Create loader in `src/data/loaders/`
3. Create route in `src/routes/demo/`

### Learn More

- [Strapi Documentation](https://docs.strapi.io/)
- [Strapi Client SDK](https://www.npmjs.com/package/@strapi/client)
- [Strapi Cloud Template Blog](https://github.com/strapi/strapi-cloud-template-blog)
- [TanStack Start Documentation](https://tanstack.com/start/latest)
- [TanStack Router Search Params](https://tanstack.com/router/latest/docs/framework/react/guide/search-params)

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "My App" },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
});
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from "@tanstack/react-start";

const getServerTime = createServerFn({
  method: "GET",
}).handler(async () => {
  return new Date().toISOString();
});

// Use in a component
function MyComponent() {
  const [time, setTime] = useState("");

  useEffect(() => {
    getServerTime().then(setTime);
  }, []);

  return <div>Server time: {time}</div>;
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";

export const Route = createFileRoute("/api/hello")({
  server: {
    handlers: {
      GET: () => json({ message: "Hello, World!" }),
    },
  },
});
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/people")({
  loader: async () => {
    const response = await fetch("https://swapi.dev/api/people");
    return response.json();
  },
  component: PeopleComponent,
});

function PeopleComponent() {
  const data = Route.useLoaderData();
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  );
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

## Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

## Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
