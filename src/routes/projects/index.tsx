import { Link, createFileRoute } from "@tanstack/react-router";

import { projects } from "#/content";

export const Route = createFileRoute("/projects/")({
  loader: () => projects.list(),
  head: () => ({ meta: [{ title: "Projects — kuzmano.ski" }] }),
  component: ProjectsIndex,
});

function ProjectsIndex() {
  const entries = Route.useLoaderData();

  return (
    <main>
      <h1>Projects</h1>
      <ul>
        {entries.map((entry) => (
          <li key={entry.slug}>
            <Link params={{ slug: entry.slug }} to="/projects/$slug">
              {entry.title}
            </Link>
            <p>{entry.description}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
