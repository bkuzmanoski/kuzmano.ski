import { evaluate } from "@mdx-js/mdx";
import { createElement } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { fromContent } from "../../paths.ts";

import { rehypeRailAsides } from "./rail-asides.ts";
import { elementNameOf } from "./tree.ts";

import type { ContentParent } from "./tree.ts";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";
import type { PluggableList } from "unified";

const ENTRY_PATH = fromContent("collection", "entry.mdx");
const COMPONENTS: MDXComponents = {
  Rail: (props: ComponentProps<"aside">) => createElement("aside", props),
  Footnote: ({ number, ...props }: ComponentProps<"aside"> & { number: string }) =>
    createElement("aside", { "data-number": number, ...props }),
  Callout: (props: ComponentProps<"aside">) => createElement("aside", { className: "callout", ...props }),
  ContributionGraph: () => createElement("figure"),
};

async function renderedMarkupOf(source: string, rehypePlugins: PluggableList = [rehypeRailAsides]) {
  const { default: MDXContent } = await evaluate({ path: ENTRY_PATH, value: source }, { ...runtime, rehypePlugins });
  return renderToStaticMarkup(createElement(MDXContent, { components: COMPONENTS }));
}

const styleFirstParagraph = () => (tree: ContentParent) => {
  const paragraph = tree.children.find((child) => elementNameOf(child) === "p");
  paragraph!.properties = { style: "color: red;" };
};

describe("rehypeRailAsides", () => {
  test("wraps a `Rail` and the rail asides directly after it in a `<div>` with the `data-rail-asides` attribute, after the element they follow", async () => {
    expect(
      await renderedMarkupOf(`
A paragraph.

<Rail>First.</Rail>

<Rail>Second.</Rail>

A second paragraph.
`),
    ).toBe(`<p style="--content-body-rail-subject:--content-body-rail-subject-1">A paragraph.</p>
<div data-rail-asides="" style="--content-body-rail-subject:--content-body-rail-subject-1"><aside>First.</aside><aside>Second.</aside></div>
<p>A second paragraph.</p>`);
  });

  test("groups a `Footnote` with the `Rail` elements before it", async () => {
    const markup = await renderedMarkupOf(`
A paragraph.

<Rail>A note.</Rail>

<Footnote id="fn-1" number="1">A footnote.</Footnote>
`);
    expect(markup).toContain(
      '<div data-rail-asides="" style="--content-body-rail-subject:--content-body-rail-subject-1"><aside>A note.</aside><aside data-number="1" id="fn-1">A footnote.</aside></div>',
    );
  });

  test("names each rail subject with an anchor name unique within the entry", async () => {
    const markup = await renderedMarkupOf(`
A paragraph.

<Rail>First.</Rail>

A second paragraph.

<Rail>Second.</Rail>
`);

    expect(markup).toContain('<p style="--content-body-rail-subject:--content-body-rail-subject-1">A paragraph.</p>');
    expect(markup).toContain(
      '<p style="--content-body-rail-subject:--content-body-rail-subject-2">A second paragraph.</p>',
    );
    expect(markup).toContain(
      '<div data-rail-asides="" style="--content-body-rail-subject:--content-body-rail-subject-2">',
    );
  });

  test("passes the anchor name to a JSX element as a `style` object", async () => {
    const markup = await renderedMarkupOf(`
<figure>A figure.</figure>

<Rail>A note.</Rail>
`);
    expect(markup).toContain(
      '<figure style="--content-body-rail-subject:--content-body-rail-subject-1">A figure.</figure>',
    );
  });

  test("passes the anchor name to a component in `RAIL_SUBJECT_COMPONENT_NAMES` as its `style` prop", async () => {
    const markup = await renderedMarkupOf(`
<Callout>A callout.</Callout>

<Rail>A note.</Rail>
`);
    expect(markup).toContain(
      '<aside class="callout" style="--content-body-rail-subject:--content-body-rail-subject-1">A callout.</aside>',
    );
  });

  test("skips an MDX comment between a rail subject and a `Rail`", async () => {
    const markup = await renderedMarkupOf(`
A paragraph.

{/* A comment. */}

<Rail>A note.</Rail>
`);
    expect(markup).toContain('<p style="--content-body-rail-subject:--content-body-rail-subject-1">A paragraph.</p>');
  });

  test("throws for a `Rail` inside a sentence, naming the entry", async () => {
    await expect(renderedMarkupOf(`A sentence <Rail>with a note</Rail> inside it.`)).rejects.toThrow(
      '"content/collection/entry.mdx" renders a `Rail` inside a sentence.',
    );
  });

  test("throws for a `Rail` inside another element, naming the element", async () => {
    await expect(
      renderedMarkupOf(`
<figure>
  A figure.

  <Rail>A note.</Rail>
</figure>
`),
    ).rejects.toThrow("renders a `Rail` inside `<figure>`.");
  });
  test.each([
    ["at the start of the entry", "<Rail>A note.</Rail>"],
    [
      "after an import",
      `import { value } from "./entry.data.ts";

<Rail>A note.</Rail>`,
    ],
  ])("throws for a `Rail` %s, which does not follow an element", async (_label, source) => {
    await expect(renderedMarkupOf(source)).rejects.toThrow(
      '"content/collection/entry.mdx" renders a `Rail` that does not follow an element.',
    );
  });

  test("throws for a `Rail` after a component not in `RAIL_SUBJECT_COMPONENT_NAMES`, naming the component", async () => {
    await expect(
      renderedMarkupOf(`
<ContributionGraph />

<Rail>A note.</Rail>
`),
    ).rejects.toThrow(
      '"content/collection/entry.mdx" renders a `Rail` after `<ContributionGraph>`, which it cannot be placed beside. Expected an element or one of: Callout, ImageGrid, Waitlist.',
    );
  });

  test("throws for a `Footnote` after a component not in `RAIL_SUBJECT_COMPONENT_NAMES`, naming the footnote's ID and the component", async () => {
    await expect(
      renderedMarkupOf(`
<ContributionGraph />

<Footnote id="fn-1" number="1">A footnote.</Footnote>
`),
    ).rejects.toThrow(
      '"content/collection/entry.mdx" references the footnote with the ID "fn-1" inside `<ContributionGraph>`, which it cannot be placed beside.',
    );
  });

  test("throws for a `Rail` after a JSX element with a `style` attribute, naming the element", async () => {
    await expect(
      renderedMarkupOf(`
<figure style={{ color: "red" }}>A figure.</figure>

<Rail>A note.</Rail>
`),
    ).rejects.toThrow(
      '"content/collection/entry.mdx" renders a `Rail` after `<figure>` with a `style` attribute, which the build sets to place the aside.',
    );
  });

  test("throws for a `Rail` after a hast element with a `style` attribute, naming the element", async () => {
    await expect(
      renderedMarkupOf(
        `
A paragraph.

<Rail>A note.</Rail>
`,
        [styleFirstParagraph, rehypeRailAsides],
      ),
    ).rejects.toThrow(
      '"content/collection/entry.mdx" renders a `Rail` after `<p>` with a `style` attribute, which the build sets to place the aside.',
    );
  });

  test("throws for a `Rail` after a JSX element with a spread attribute, naming the element", async () => {
    await expect(
      renderedMarkupOf(`
<figure {...{ title: "A title" }}>A figure.</figure>

<Rail>A note.</Rail>
`),
    ).rejects.toThrow(
      '"content/collection/entry.mdx" renders a `Rail` after `<figure>` with a spread attribute, which can set the `style` attribute the build sets to place the aside.',
    );
  });
});
