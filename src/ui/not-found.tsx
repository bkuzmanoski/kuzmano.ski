import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <main>
      <title>Page not found—kuzmano.ski</title>
      <h1>Page not found</h1>
      <p>
        This page doesn&rsquo;t exist. <Link to="/">Go back home</Link>.
      </p>
    </main>
  );
}
