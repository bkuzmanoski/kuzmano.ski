import { describe, expect, test } from "vitest";

import { estimatedTokenCountIn, estimatedTokenCountsOf } from "./token-count.ts";

describe("estimatedTokenCountIn", () => {
  test("counts an empty string as zero tokens", () => {
    expect(estimatedTokenCountIn("")).toBe(0);
  });

  test("counts whitespace alone as zero tokens", () => {
    expect(estimatedTokenCountIn(" \n\t")).toBe(0);
  });

  test("counts a word of three characters as one token", () => {
    expect(estimatedTokenCountIn("the")).toBe(1);
  });

  test("counts a word of eleven characters as three tokens", () => {
    expect(estimatedTokenCountIn("negotiation")).toBe(3);
  });

  test("counts each punctuation and symbol character as its own token", () => {
    expect(estimatedTokenCountIn("## Heading")).toBe(4);
  });

  test("counts a longer document as more tokens than a shorter one", () => {
    expect(estimatedTokenCountIn("A sentence of prose.")).toBeGreaterThan(estimatedTokenCountIn("A sentence."));
  });
});

describe("estimatedTokenCountsOf", () => {
  test("returns the estimated token count of the Markdown in each file, keyed by its path", () => {
    const entryMarkdown = `
      # Entry

      A paragraph.
    `;
    const collectionMarkdown = `
      # Collection

      - [Entry](/collection/entry.md) (2026-07-19)
    `;

    expect(
      estimatedTokenCountsOf(
        new Map([
          ["/collection/entry.md", entryMarkdown],
          ["/collection.md", collectionMarkdown],
        ]),
      ),
    ).toStrictEqual({
      "/collection/entry.md": estimatedTokenCountIn(entryMarkdown),
      "/collection.md": estimatedTokenCountIn(collectionMarkdown),
    });
  });
});
