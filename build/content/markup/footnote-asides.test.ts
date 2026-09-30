import { evaluate } from "@mdx-js/mdx";
import { createElement } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { fromContent } from "../../paths.ts";

import { remarkFootnoteAsides } from "./footnote-asides.ts";
import { remarkGfmSubset } from "./gfm.ts";

import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

const ENTRY_PATH = fromContent("collection", "entry.mdx");
const COMPONENTS: MDXComponents = {
  Rail: (props: ComponentProps<"aside">) => createElement("aside", props),
  Footnote: ({ number, ...props }: ComponentProps<"aside"> & { number: string }) =>
    createElement("aside", { ...props, "data-number": number }),
};

async function renderedMarkupOf(source: string) {
  const { default: MDXContent } = await evaluate(
    { path: ENTRY_PATH, value: source },
    {
      ...runtime,
      remarkPlugins: [remarkGfmSubset, remarkFootnoteAsides],
    },
  );
  return renderToStaticMarkup(createElement(MDXContent, { components: COMPONENTS }));
}

const referenceMarkup = (label: string, number: number, occurrence = 1) =>
  `<sup><a href="#fn-${label}" id="fnref-${label}${occurrence > 1 ? `-${occurrence}` : ""}" aria-label="Footnote ${number}" data-footnote-reference="">${number}</a></sup>`;
const backLinkMarkup = (label: string, number: number) =>
  `<a href="#fnref-${label}" aria-label="Back to reference ${number}">↩︎</a>`;

describe("remarkFootnoteAsides", () => {
  test("replaces a footnote reference with a `<sup>` containing a link to its footnote, named by the footnote's number", async () => {
    const markup = await renderedMarkupOf(`
A sentence.[^note]

[^note]: A note.
`);
    expect(markup).toContain(`<p>A sentence.${referenceMarkup("note", 1)}</p>`);
  });

  test("numbers the footnotes in the order of their first references", async () => {
    const markup = await renderedMarkupOf(`
A sentence.[^second] Another sentence.[^first]

[^first]: The first note.

[^second]: The second note.
`);

    expect(markup).toContain(
      `A sentence.${referenceMarkup("second", 1)} Another sentence.${referenceMarkup("first", 2)}`,
    );
    expect(markup.indexOf('id="fn-second"')).toBeLessThan(markup.indexOf('id="fn-first"'));
  });

  test("gives each repeated reference the ID of the first with `-2`, `-3`, and so on appended, and the same number", async () => {
    const markup = await renderedMarkupOf(`
A sentence.[^note] Another.[^note] A third.[^note]

[^note]: A note.
`);
    expect(markup).toContain(
      `A sentence.${referenceMarkup("note", 1)} Another.${referenceMarkup("note", 1, 2)} A third.${referenceMarkup("note", 1, 3)}`,
    );
  });

  test("moves a definition into a `Footnote` with the footnote's ID and number after the block containing its first reference", async () => {
    expect(
      await renderedMarkupOf(`
A sentence.[^note]

A second paragraph.[^note]

[^note]: A note.
`),
    ).toBe(`<p>A sentence.${referenceMarkup("note", 1)}</p>
<aside id="fn-note" data-number="1"><p>A note. ${backLinkMarkup("note", 1)} <a href="#fnref-note-2" aria-label="Back to reference 1-2">↩︎<sup>2</sup></a></p></aside>
<p>A second paragraph.${referenceMarkup("note", 1, 2)}</p>`);
  });

  test("places a footnote after any `Rail` elements that follow the block containing its first reference", async () => {
    expect(
      await renderedMarkupOf(`
A sentence.[^note]

<Rail>An aside.</Rail>

A second paragraph.

[^note]: A note.
`),
    ).toBe(`<p>A sentence.${referenceMarkup("note", 1)}</p>
<aside>An aside.</aside>
<aside id="fn-note" data-number="1"><p>A note. ${backLinkMarkup("note", 1)}</p></aside>
<p>A second paragraph.</p>`);
  });

  test("places a footnote after a `Rail` that follows an MDX comment after the block containing its first reference", async () => {
    expect(
      await renderedMarkupOf(`
A sentence.[^note]

{/* A comment. */}

<Rail>An aside.</Rail>

A second paragraph.

[^note]: A note.
`),
    ).toBe(`<p>A sentence.${referenceMarkup("note", 1)}</p>

<aside>An aside.</aside>
<aside id="fn-note" data-number="1"><p>A note. ${backLinkMarkup("note", 1)}</p></aside>
<p>A second paragraph.</p>`);
  });

  test("places the footnotes first referenced in one block after it in the order of their numbers", async () => {
    const markup = await renderedMarkupOf(`
A sentence.[^first] Another.[^second]

[^second]: The second note.

[^first]: The first note.
`);
    expect(markup).toMatch(/<\/p>\n<aside id="fn-first".*<\/aside>\n<aside id="fn-second"/);
  });

  test("places the footnote for a reference inside a list after the list", async () => {
    expect(
      await renderedMarkupOf(`
- A list item.[^note]
- A second list item.

[^note]: A note.
`),
    ).toMatch(/<\/ul>\n<aside id="fn-note" data-number="1">/);
  });

  test("places a footnote referenced inside a `Rail` after that `Rail`", async () => {
    expect(
      await renderedMarkupOf(`
A paragraph.

<Rail>An aside.[^note]</Rail>

A second paragraph.

[^note]: A note.
`),
    ).toBe(`<p>A paragraph.</p>
<aside>An aside.${referenceMarkup("note", 1)}</aside>
<aside id="fn-note" data-number="1"><p>A note. ${backLinkMarkup("note", 1)}</p></aside>
<p>A second paragraph.</p>`);
  });

  test("appends a paragraph of back links to a footnote that does not end with a paragraph", async () => {
    const markup = await renderedMarkupOf(`
A sentence.[^note]

[^note]:
    - A list in a note.
`);
    expect(markup).toContain(`</ul><p>${backLinkMarkup("note", 1)}</p></aside>`);
  });

  test("replaces each run of characters other than ASCII letters, digits, hyphens, and underscores in a label with a hyphen in its IDs", async () => {
    const markup = await renderedMarkupOf(`
A sentence.[^A.Café]

[^A.Café]: A note.
`);

    expect(markup).toContain(referenceMarkup("a-caf-", 1));
    expect(markup).toContain('<aside id="fn-a-caf-"');
  });

  test("accepts an escaped `\\[^label]` as prose", async () => {
    expect(
      await renderedMarkupOf(String.raw`
A sentence about \[^label] syntax.
`),
    ).toBe("<p>A sentence about [^label] syntax.</p>");
  });

  test("throws for a reference without a definition, naming the entry and the label", async () => {
    await expect(
      renderedMarkupOf(`
A sentence.[^missing]
`),
    ).rejects.toThrow(
      String.raw`"content/collection/entry.mdx" references the footnote "[^missing]", which it does not define. Write "\[^missing]" for the text itself.`,
    );
  });

  test("throws for a reference without a definition inside a footnote, naming the label", async () => {
    await expect(
      renderedMarkupOf(`
A sentence.[^note]

[^note]: A note.[^missing]
`),
    ).rejects.toThrow('references the footnote "[^missing]", which it does not define.');
  });

  test("throws for a reference after an escaped backslash", async () => {
    await expect(
      renderedMarkupOf(String.raw`
A path such as C:\\[^missing].
`),
    ).rejects.toThrow('references the footnote "[^missing]"');
  });

  test("throws for a definition without a reference, naming the entry and the label", async () => {
    await expect(
      renderedMarkupOf(`
A sentence.

[^unused]: A note.
`),
    ).rejects.toThrow('"content/collection/entry.mdx" defines the footnote "[^unused]" without a reference to it.');
  });

  test.each([
    [
      "a referenced definition",
      `
A sentence.[^outer] Another sentence.[^inner]

[^outer]: A note.

    [^inner]: A nested note.
`,
    ],
    [
      "a definition without a reference",
      `
A sentence.[^outer]

[^outer]: A note.

    [^inner]: A nested note.
`,
    ],
  ])("throws for %s inside another definition, naming the entry and both labels", async (_label, source) => {
    await expect(renderedMarkupOf(source)).rejects.toThrow(
      '"content/collection/entry.mdx" defines the footnote "[^inner]" inside the footnote "[^outer]".',
    );
  });

  test.each([
    ["a blockquote", "> [^note]: A note.", "a blockquote"],
    ["a list item", "- [^note]: A note.", "a list item"],
    [
      "a JSX element",
      `<Rail>

[^note]: A note.

</Rail>`,
      "`<Rail>`",
    ],
  ])(
    "throws for a definition inside %s, naming the entry, the label, and the container",
    async (_label, block, container) => {
      await expect(
        renderedMarkupOf(`
A sentence.[^note]

${block}
`),
      ).rejects.toThrow(`"content/collection/entry.mdx" defines the footnote "[^note]" inside ${container}.`);
    },
  );

  test("throws for a label defined twice, naming the entry and the label", async () => {
    await expect(
      renderedMarkupOf(`
A sentence.[^note]

[^note]: A note.

[^note]: Another note.
`),
    ).rejects.toThrow('"content/collection/entry.mdx" defines the footnote "[^note]" twice.');
  });

  test("throws for a reference inside a footnote, naming the entry and both labels", async () => {
    await expect(
      renderedMarkupOf(`
A sentence.[^outer]

[^outer]: A note.[^inner]

[^inner]: Another note.
`),
    ).rejects.toThrow(
      '"content/collection/entry.mdx" references the footnote "[^inner]" inside the footnote "[^outer]".',
    );
  });

  test("throws for two labels with the same ID, naming the entry and both labels", async () => {
    await expect(
      renderedMarkupOf(`
A sentence.[^a.b] Another sentence.[^a-b]

[^a.b]: A note.

[^a-b]: Another note.
`),
    ).rejects.toThrow(
      '"content/collection/entry.mdx" defines the footnotes "[^a.b]" and "[^a-b]", which have the same ID "fn-a-b".',
    );
  });

  test.each([
    ["an inline link", "[A link[^note]](https://example.com)"],
    ["a reference link", "[A link[^note]][link]"],
    ["a JSX `<a>`", '<a href="https://example.com">A link[^note]</a>'],
  ])("throws for a reference inside %s, naming the entry and the label", async (_label, link) => {
    await expect(
      renderedMarkupOf(`
${link}

[link]: https://example.com

[^note]: A note.
`),
    ).rejects.toThrow('"content/collection/entry.mdx" references the footnote "[^note]" inside a link.');
  });

  test.each([
    ["a Markdown heading", "## A heading[^note]"],
    ["a JSX `<h2>`", "<h2>A heading[^note]</h2>"],
    ["a JSX `<h3>`", "<h3>A heading[^note]</h3>"],
  ])("throws for a reference inside %s, naming the entry and the label", async (_label, heading) => {
    await expect(
      renderedMarkupOf(`
${heading}

[^note]: A note.
`),
    ).rejects.toThrow('"content/collection/entry.mdx" references the footnote "[^note]" inside a heading.');
  });

  test("throws for a `Footnote` the entry renders itself, naming the entry", async () => {
    await expect(
      renderedMarkupOf(`
A sentence.

<Footnote id="fn-note" number="1">A note.</Footnote>
`),
    ).rejects.toThrow('"content/collection/entry.mdx" renders a `Footnote`, which the build emits for each footnote.');
  });
});
