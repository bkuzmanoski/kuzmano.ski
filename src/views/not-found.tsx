import { Link } from "@tanstack/react-router";

import { documentTitle } from "#/config/site";

export function NotFound() {
  return (
    <main>
      <title>{documentTitle("Page not found")}</title>
      <h1>Page not found</h1>
      <p>
        This page doesn&rsquo;t exist. <Link to="/">Go back home</Link>.
      </p>
    </main>
  );
}
