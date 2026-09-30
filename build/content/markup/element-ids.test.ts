import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import rehypeSlug from "rehype-slug";
import { describe, expect, test } from "vitest";

import { fromContent } from "../../paths.ts";

import { rehypeElementIds } from "./element-ids.ts";
import { remarkFootnoteAsides } from "./footnote-asides.ts";
import { remarkGfmSubset } from "./gfm.ts";

const ENTRY_PATH = fromContent("collection", "entry.mdx");

const compile = (source: string) =>
  evaluate(
    { path: ENTRY_PATH, value: source },
    {
      ...runtime,
      remarkPlugins: [remarkGfmSubset, remarkFootnoteAsides],
      rehypePlugins: [rehypeSlug, rehypeElementIds],
    },
  );

describe("rehypeElementIds", () => {
  test("accepts an entry whose elements each have an ID of their own", async () => {
    await expect(
      compile(`
## A heading

A sentence.[^1] Another sentence.[^1]

<figure id="figure">A figure.</figure>

[^1]: A footnote.
`),
    ).resolves.toBeDefined();
  });

  test("throws for a heading whose slug is the ID of a footnote, naming the entry and the ID", async () => {
    await expect(
      compile(`
## Fn 1

A sentence.[^1]

[^1]: A footnote.
`),
    ).rejects.toThrow('"content/collection/entry.mdx" has more than one element with the ID "fn-1".');
  });

  test("throws for the first reference to `[^label-2]` and the second reference to `[^label]`, which have the same ID", async () => {
    await expect(
      compile(`
A sentence.[^label] Another sentence.[^label] A third sentence.[^label-2]

[^label]: A footnote.

[^label-2]: Another footnote.
`),
    ).rejects.toThrow('has more than one element with the ID "fnref-label-2".');
  });

  test("throws for two JSX elements with the same `id` attribute", async () => {
    await expect(
      compile(`
<figure id="figure">A figure.</figure>

<figure id="figure">Another figure.</figure>
`),
    ).rejects.toThrow('has more than one element with the ID "figure".');
  });
});
