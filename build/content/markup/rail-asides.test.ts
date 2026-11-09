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
  Aside: (props: ComponentProps<"aside">) => createElement("aside", props),
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
  test("wraps an `Aside` and the rail asides directly after it in a `<div>` with the `data-rail-asides` attribute, after the element they follow", async () => {
    expect(
      await renderedMarkupOf(`
A paragraph.

<Aside>First.</Aside>

<Aside>Second.</Aside>

A second paragraph.
`),
    ).toBe(`<p style="--content-body-rail-subject:--content-body-rail-subject-1">A paragraph.</p>
<div data-rail-asides="" style="--content-body-rail-subject:--content-body-rail-subject-1"><aside>First.</aside><aside>Second.</aside></div>
<p>A second paragraph.</p>`);
  });

  test("groups a `Footnote` with the `Aside` elements before it", async () => {
    const markup = await renderedMarkupOf(`
A paragraph.

<Aside>A note.</Aside>

<Footnote id="fn-1" number="1">A footnote.</Footnote>
`);
    expect(markup).toContain(
      '<div data-rail-asides="" style="--content-body-rail-subject:--content-body-rail-subject-1"><aside>A note.</aside><aside data-number="1" id="fn-1">A footnote.</aside></div>',
    );
  });

  test("names each rail subject with an anchor name unique within the entry", async () => {
    const markup = await renderedMarkupOf(`
A paragraph.

<Aside>First.</Aside>

A second paragraph.

<Aside>Second.</Aside>
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

<Aside>A note.</Aside>
`);
    expect(markup).toContain(
      '<figure style="--content-body-rail-subject:--content-body-rail-subject-1">A figure.</figure>',
    );
  });

  test("passes the anchor name to a component in `RAIL_SUBJECT_COMPONENT_NAMES` as its `style` prop", async () => {
    const markup = await renderedMarkupOf(`
<Callout>A callout.</Callout>

<Aside>A note.</Aside>
`);
    expect(markup).toContain(
      '<aside class="callout" style="--content-body-rail-subject:--content-body-rail-subject-1">A callout.</aside>',
    );
  });

  test("skips an MDX comment between a rail subject and an `Aside`", async () => {
    const markup = await renderedMarkupOf(`
A paragraph.

{/* A comment. */}

<Aside>A note.</Aside>
`);
    expect(markup).toContain('<p style="--content-body-rail-subject:--content-body-rail-subject-1">A paragraph.</p>');
  });

  test("throws for an `Aside` inside a sentence, naming the entry", async () => {
    await expect(renderedMarkupOf(`A sentence <Aside>with a note</Aside> inside it.`)).rejects.toThrow(
      '"content/collection/entry.mdx" renders `Aside` inside a sentence.',
    );
  });

  test("throws for an `Aside` inside another element, naming the element", async () => {
    await expect(
      renderedMarkupOf(`
<figure>
  A figure.

  <Aside>A note.</Aside>
</figure>
`),
    ).rejects.toThrow("renders `Aside` inside `<figure>`.");
  });
  test.each([
    ["at the start of the entry", "<Aside>A note.</Aside>"],
    [
      "after an import",
      `import { value } from "./entry.data.ts";

<Aside>A note.</Aside>`,
    ],
  ])("throws for an `Aside` %s, which does not follow an element", async (_label, source) => {
    await expect(renderedMarkupOf(source)).rejects.toThrow(
      '"content/collection/entry.mdx" renders `Aside` without an element before it.',
    );
  });

  test("throws for an `Aside` after a component not in `RAIL_SUBJECT_COMPONENT_NAMES`, naming the component", async () => {
    await expect(
      renderedMarkupOf(`
<ContributionGraph />

<Aside>A note.</Aside>
`),
    ).rejects.toThrow(
      '"content/collection/entry.mdx" renders `Aside` after `<ContributionGraph>`, which it cannot be placed beside. Expected an element or one of: Callout, ImageGallery, ImageRow, Waitlist.',
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

  test("throws for an `Aside` after a JSX element with a `style` attribute, naming the element", async () => {
    await expect(
      renderedMarkupOf(`
<figure style={{ color: "red" }}>A figure.</figure>

<Aside>A note.</Aside>
`),
    ).rejects.toThrow(
      '"content/collection/entry.mdx" renders `Aside` after `<figure>` with the `style` attribute, which the build sets to place the aside.',
    );
  });

  test("throws for an `Aside` after a hast element with a `style` attribute, naming the element", async () => {
    await expect(
      renderedMarkupOf(
        `
A paragraph.

<Aside>A note.</Aside>
`,
        [styleFirstParagraph, rehypeRailAsides],
      ),
    ).rejects.toThrow(
      '"content/collection/entry.mdx" renders `Aside` after `<p>` with the `style` attribute, which the build sets to place the aside.',
    );
  });

  test("throws for an `Aside` after a JSX element with a spread attribute, naming the element", async () => {
    await expect(
      renderedMarkupOf(`
<figure {...{ title: "A title" }}>A figure.</figure>

<Aside>A note.</Aside>
`),
    ).rejects.toThrow(
      '"content/collection/entry.mdx" renders `Aside` after `<figure>` with a spread attribute, which can set the `style` attribute the build sets to place the aside.',
    );
  });
});
