import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main>
      <h1>kuzmano.ski</h1>
      <nav>
        <Link to="/writing">Writing</Link>
        <Link to="/projects">Projects</Link>
      </nav>
    </main>
  );
}
