import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

import { contentIndexOf, resolveWindow } from "#/site/windows.ts";

// Preloads the entry before hydration so a Suspense boundary does not flash its fallback over SSR HTML.
async function loadInitialContent() {
  try {
    const windowTarget = resolveWindow(window.location.pathname);

    if (windowTarget?.id === "entry") {
      await contentIndexOf(windowTarget).load(windowTarget.slug);
    }
  } catch {
    // Hydration proceeds regardless; the Suspense boundary handles the failed load.
  }
}

function hydrate() {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });
}

void loadInitialContent().then(hydrate);
