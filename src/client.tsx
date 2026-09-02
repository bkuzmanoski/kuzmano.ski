import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

import { resolveWindow } from "#/content/window-registry";

// Loads the article before hydration to prevent a Suspense boundary from replacing
// server-rendered content with its fallback while the compiled MDX loads.
async function loadInitialContent() {
  try {
    const target = resolveWindow(window.location.pathname);

    if (target?.id === "entry") {
      await target.contentIndex.load(target.slug);
    }
  } catch {
    // Hydration proceeds regardless: the Suspense boundary handles the failed load.
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
