import { compile } from "@mdx-js/mdx";
import { describe, expect, test } from "vitest";

import { mdxCompileOptionsFor } from "../mdx.ts";

import { elementNameOf, stringAttributeOf } from "./tree.ts";

import type { ContentNode, ContentParent } from "./tree.ts";

const NUMBER_ATTRIBUTE_NAMES = ["data-section-number", "data-figure-number", "data-table-number"];

async function numberedChildrenOf(source: string): Promise<Array<[string | null, string | null]>> {
  const compileOptions = mdxCompileOptionsFor({ syntaxHighlight: false });

  let transformedTree: ContentParent = { type: "root", children: [] };

  const capture = () => (tree: ContentParent) => {
    transformedTree = tree;
  };

  await compile(source, { ...compileOptions, rehypePlugins: [...(compileOptions.rehypePlugins ?? []), capture] });

  return transformedTree.children
    .filter((child: ContentNode) => elementNameOf(child) !== null)
    .map((child) => [
      elementNameOf(child),
      NUMBER_ATTRIBUTE_NAMES.map((name) => stringAttributeOf(child, name)).find((value) => value !== null) ?? null,
    ]);
}

describe("rehypeNumberedElements", () => {
  test("numbers sections, figures, and tables separately, each from 1", async () => {
    expect(
      await numberedChildrenOf(`
## First section

<figure>A figure.</figure>

<table><tr><td>Cell</td></tr></table>

## Second section

<figure>A figure.</figure>
`),
    ).toEqual([
      ["h2", "01"],
      ["figure", "1"],
      ["table", "1"],
      ["h2", "02"],
      ["figure", "2"],
    ]);
  });

  test("zero-pads a section number to two digits, and does not pad a number of two digits", async () => {
    const source = Array.from({ length: 10 }, (_, index) => `## Section ${index + 1}`).join("\n\n");
    const sectionNumbers = (await numberedChildrenOf(source)).map(([, number]) => number);

    expect(sectionNumbers.at(0)).toBe("01");
    expect(sectionNumbers.at(-1)).toBe("10");
  });

  test("numbers a pipe table and an authored `<table>` in one count", async () => {
    expect(
      await numberedChildrenOf(`
| Column |
| ------ |
| Cell   |

<table><tr><td>Cell</td></tr></table>
`),
    ).toEqual([
      ["table", "1"],
      ["table", "2"],
    ]);
  });

  test("does not number a figure marked `data-content-unnumbered`, or count it", async () => {
    expect(
      await numberedChildrenOf(`
<figure data-content-unnumbered>A figure.</figure>

<figure>A figure.</figure>
`),
    ).toEqual([
      ["figure", null],
      ["figure", "1"],
    ]);
  });

  test("does not number a table inside a figure, or count it", async () => {
    expect(
      await numberedChildrenOf(`
<figure>
  <table><tr><td>Cell</td></tr></table>
</figure>

<table><tr><td>Cell</td></tr></table>
`),
    ).toEqual([
      ["figure", "1"],
      ["table", "1"],
    ]);
  });

  test("does not number an `<h3>`, or an `<h2>` inside another element", async () => {
    expect(
      await numberedChildrenOf(`
### Subsection

<section>
  ## Nested section
</section>

## Section
`),
    ).toEqual([
      ["h3", null],
      ["section", null],
      ["h2", "01"],
    ]);
  });
});
