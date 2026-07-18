import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>
        That page doesn&rsquo;t exist. <Link to="/">Go back home</Link>.
      </p>
    </main>
  );
}
