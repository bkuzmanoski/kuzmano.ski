import { createProcessor } from "@mdx-js/mdx";
import { describe, expect, test } from "vitest";

import { fromContent } from "../../paths.ts";

import { rehypeContentSpans } from "./content-spans.ts";

import type { ContentParent } from "./tree.ts";

const ENTRY_PATH = fromContent("collection", "entry.mdx");

const compile = (source: string) =>
  createProcessor({ rehypePlugins: [rehypeContentSpans] }).process({ path: ENTRY_PATH, value: source });

describe("rehypeContentSpans", () => {
  test.each(["text", "rail", "wide", "pane"])(
    "accepts an element whose `data-content-span` attribute is `%s`",
    async (span) => {
      await expect(compile(`<figure data-content-span="${span}">A figure.</figure>`)).resolves.toBeDefined();
    },
  );

  test("accepts an element without the `data-content-span` attribute", async () => {
    await expect(compile(`<figure>A figure.</figure>`)).resolves.toBeDefined();
  });

  test("throws for an element with an unknown span, naming the entry, the element, and the span", async () => {
    await expect(compile(`<figure data-content-span="full">A figure.</figure>`)).rejects.toThrow(
      '"content/collection/entry.mdx" renders `<figure data-content-span="full">`. Expected one of: text, rail, wide, pane.',
    );
  });

  test("throws for a component with an unknown span", async () => {
    await expect(compile(`<Callout data-content-span="full">A note.</Callout>`)).rejects.toThrow(
      '`<Callout data-content-span="full">`',
    );
  });

  test("throws for an element inside a sentence with an unknown span", async () => {
    await expect(
      compile(`A sentence with <span data-content-span="full">an element</span> inside it.`),
    ).rejects.toThrow('`<span data-content-span="full">`');
  });

  test("throws for an element whose span is written as an expression", async () => {
    await expect(compile(`<figure data-content-span={"wide"}>A figure.</figure>`)).rejects.toThrow(
      "`<figure>` with a `data-content-span` attribute written as an expression",
    );
  });

  test("throws for an element whose `data-content-span` attribute has no value", async () => {
    await expect(compile(`<figure data-content-span>A figure.</figure>`)).rejects.toThrow(
      "`<figure>` with a `data-content-span` attribute without a value",
    );
  });

  test("throws for a hast element with an unknown span, such as the `<picture>` that wraps an authored `<img>`", () => {
    const tree: ContentParent = {
      type: "root",
      children: [{ type: "element", tagName: "picture", properties: { "data-content-span": "full" }, children: [] }],
    };
    expect(() => rehypeContentSpans()(tree, { path: ENTRY_PATH })).toThrow('`<picture data-content-span="full">`');
  });
});
