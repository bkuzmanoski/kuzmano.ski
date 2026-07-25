import { Link } from "@tanstack/react-router";

import { Window } from "#/ui/window";

export function Home() {
  return (
    <Window id="home" title="Macintosh HD">
      <nav>
        <ul>
          <li>
            <Link to="/writing">Writing</Link>
          </li>
          <li>
            <Link to="/projects">Projects</Link>
          </li>
        </ul>
      </nav>
    </Window>
  );
}
