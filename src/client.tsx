import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

import { resolveWindow } from "#/content/window-registry";

// The client entry loads the content for the URL before hydrating the page.
//
// The server has already rendered the article into the HTML it sends. The article's compiled MDX
// is loaded separately, however, and the client may not have loaded it yet when hydration starts.
// If hydration needs that file, the article suspends while it loads. React then replaces the
// server-rendered article with the Suspense fallback, so the reader sees a spinner until the file
// arrives.
//
// Loading the file before hydration avoids that replacement. The article stays visible while the
// file loads, and hydration starts once the file is ready, so the page becomes interactive without
// first replacing its content with a spinner.
//
// This only applies to the initial page. A window opened later has no server-rendered content to
// replace, so showing its spinner while its content loads is the expected behaviour.
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
