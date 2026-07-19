import { Link, createFileRoute } from "@tanstack/react-router";

import { writing } from "#/content";

export const Route = createFileRoute("/writing/")({
  loader: () => writing.list(),
  head: () => ({ meta: [{ title: "Writing — kuzmano.ski" }] }),
  component: WritingIndex,
});

function WritingIndex() {
  const entries = Route.useLoaderData();

  return (
    <main>
      <h1>Writing</h1>
      <ul>
        {entries.map((entry) => (
          <li key={entry.slug}>
            <Link params={{ slug: entry.slug }} to="/writing/$slug">
              {entry.title}
            </Link>
            <p>{entry.description}</p>
            <time dateTime={entry.date}>{entry.date}</time>
          </li>
        ))}
      </ul>
    </main>
  );
}
