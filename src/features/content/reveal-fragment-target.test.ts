import { afterEach, describe, expect, test, vi } from "vitest";

import { revealFragmentTarget } from "./reveal-fragment-target.ts";

const scrollIntoViewSilently = vi.hoisted(() => vi.fn());

vi.mock("#/lib/audio/scroll.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, { scrollIntoViewSilently }),
);

afterEach(() => {
  document.body.replaceChildren();
});

function articleWithHeading(id: string) {
  const article = document.createElement("article");
  const heading = document.createElement("h2");

  heading.id = id;
  heading.tabIndex = -1;
  article.append(heading);
  document.body.append(article);

  return { article, heading };
}

describe("revealFragmentTarget", () => {
  test("scrolls to and focuses the element with the decoded ID when the fragment is percent-encoded", () => {
    const { article, heading } = articleWithHeading("café");

    expect(revealFragmentTarget(article, "#caf%C3%A9")).toBe(true);
    expect(scrollIntoViewSilently).toHaveBeenCalledWith(heading, { block: "start" });
    expect(document.activeElement).toBe(heading);
  });

  test("scrolls to the element with the fragment's ID as authored when the fragment is not valid percent-encoding", () => {
    const { article, heading } = articleWithHeading("100%");

    expect(revealFragmentTarget(article, "#100%")).toBe(true);
    expect(scrollIntoViewSilently).toHaveBeenCalledWith(heading, { block: "start" });
  });
});
