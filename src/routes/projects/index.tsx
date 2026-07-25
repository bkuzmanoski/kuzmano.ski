import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { projects } from "#/content";
import { indexRoute } from "#/content/routes";
import { Window } from "#/ui/window";

export const Route = createFileRoute("/projects/")({
  ...indexRoute(projects, "Projects"),
  component: ProjectsIndex,
});

function ProjectsIndex() {
  const entries = Route.useLoaderData();
  const navigate = useNavigate();

  return (
    <Window id="projects" title="Projects" onClose={() => navigate({ to: "/" })}>
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
    </Window>
  );
}
