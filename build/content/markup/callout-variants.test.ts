import { createProcessor } from "@mdx-js/mdx";
import { describe, expect, test } from "vitest";

import { fromContent } from "../../paths.ts";

import { rehypeCalloutVariants } from "./callout-variants.ts";

const ENTRY_PATH = fromContent("collection", "entry.mdx");

const compile = (source: string) =>
  createProcessor({ rehypePlugins: [rehypeCalloutVariants] }).process({ path: ENTRY_PATH, value: source });

describe("rehypeCalloutVariants", () => {
  test.each(["note", "warning"])("accepts a `Callout` with the variant `%s`", async (variant) => {
    await expect(compile(`<Callout variant="${variant}">A note.</Callout>`)).resolves.toBeDefined();
  });

  test("accepts a `Callout` without the `variant` attribute", async () => {
    await expect(compile(`<Callout>A note.</Callout>`)).resolves.toBeDefined();
  });

  test("throws for a `Callout` with an unknown variant, naming the entry and the variant", async () => {
    await expect(compile(`<Callout variant="warn">A note.</Callout>`)).rejects.toThrow(
      '"content/collection/entry.mdx" renders a `Callout` with the variant "warn". Expected one of: note, warning.',
    );
  });

  test("throws for a `Callout` inside a sentence with an unknown variant", async () => {
    await expect(compile(`A sentence with <Callout variant="warn">a note</Callout> inside it.`)).rejects.toThrow(
      'the variant "warn"',
    );
  });

  test("throws for a `Callout` whose variant is written as an expression", async () => {
    await expect(compile(`<Callout variant={"note"}>A note.</Callout>`)).rejects.toThrow(
      "a `variant` attribute written as an expression",
    );
  });

  test("throws for a `Callout` whose `variant` attribute has no value", async () => {
    await expect(compile(`<Callout variant>A note.</Callout>`)).rejects.toThrow(
      "a `variant` attribute without a value",
    );
  });

  test("accepts an element of another name with an unknown `variant` attribute", async () => {
    await expect(compile(`<Waitlist variant="warn" />`)).resolves.toBeDefined();
  });
});
