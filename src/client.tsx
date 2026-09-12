import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

import { resolveWindow } from "#/site/windows.ts";

// Loads the entry before hydration to prevent a Suspense boundary from replacing
// server-rendered content with its fallback while the compiled MDX loads.
async function loadInitialContent() {
  try {
    const windowTarget = resolveWindow(window.location.pathname);

    if (windowTarget?.id === "entry") {
      await windowTarget.contentIndex.load(windowTarget.slug);
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
