import { evaluate } from "@mdx-js/mdx";
import { useMDXComponents } from "@mdx-js/react";
import { createElement } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { mdxCompileOptionsFor } from "./mdx.ts";

import type { MDXComponents } from "mdx/types";

async function renderedMarkupOf(source: string, components?: MDXComponents): Promise<string> {
  const { default: MDXContent } = await evaluate(source, {
    ...mdxCompileOptionsFor({ syntaxHighlight: false }),
    ...runtime,
    useMDXComponents,
  });

  return renderToStaticMarkup(createElement(MDXContent, { components }));
}

describe("mdxCompileOptionsFor", () => {
  test("compiles a pipe table to a numbered `<table>` with its first row in a `<thead>`", async () => {
    const markup = await renderedMarkupOf(`
| Column | Value |
| ------ | ----- |
| First  | 1     |
| Second | 2     |
`);

    expect(markup).toBe(
      [
        '<table data-table-number="1">',
        "<thead><tr><th>Column</th><th>Value</th></tr></thead>",
        "<tbody><tr><td>First</td><td>1</td></tr><tr><td>Second</td><td>2</td></tr></tbody>",
        "</table>",
      ].join(""),
    );
  });

  test("emits the alignment of a pipe table's columns as the `align` attribute of each cell", async () => {
    const markup = await renderedMarkupOf(`
| Start | Center | End | Unaligned |
| :---- | :----: | --: | --------- |
| 1     | 2      | 3   | 4         |
`);

    expect(markup).toContain('<th align="left">Start</th>');
    expect(markup).toContain('<th align="center">Center</th>');
    expect(markup).toContain('<th align="right">End</th>');
    expect(markup).toContain("<th>Unaligned</th>");
    expect(markup).toContain('<td align="center">2</td>');
    expect(markup).not.toContain("style=");
  });

  test("emits the number of a section as the `data-section-number` attribute of its `<h2>`", async () => {
    const markup = await renderedMarkupOf(`
## Section
`);
    expect(markup).toMatch(/^<h2 data-section-number="01" id="section">/);
  });

  test("appends to a heading an empty link to its fragment, marked with the `data-heading-link` attribute", async () => {
    expect(
      await renderedMarkupOf(`
### Subsection
`),
    ).toBe('<h3 id="subsection">Subsection<a data-heading-link="" href="#subsection"></a></h3>');
  });

  test("compiles a highlighted code block to a `<pre>` without the `style` attribute the highlighter emits", async () => {
    const { default: MDXContent } = await evaluate(
      `
\`\`\`ts
const value = 1;
\`\`\`
`,
      { ...mdxCompileOptionsFor(), ...runtime, useMDXComponents },
    );
    expect(renderToStaticMarkup(createElement(MDXContent))).toMatch(
      /^<pre class="shiki [^"]*" tabindex="0"><code class="language-ts">/,
    );
  });

  test("marks a highlighted code block before a `Rail` as its rail subject", async () => {
    const { default: MDXContent } = await evaluate(
      `
\`\`\`ts
const value = 1;
\`\`\`

<Rail>A note.</Rail>
`,
      { ...mdxCompileOptionsFor(), ...runtime, useMDXComponents },
    );
    const markup = renderToStaticMarkup(
      createElement(MDXContent, { components: { Rail: (properties) => createElement("aside", properties) } }),
    );

    expect(markup).toMatch(
      /^<pre class="shiki [^"]*" tabindex="0" style="--content-body-rail-subject:--content-body-rail-subject-1">/,
    );
  });

  test.each(["h2", "h3"])("marks an `<%s>` section heading before a `Rail` as its rail subject", async (tagName) => {
    const markup = await renderedMarkupOf(
      `
${tagName === "h2" ? "##" : "###"} A heading

<Rail>A note.</Rail>
`,
      { Rail: (properties) => createElement("aside", properties) },
    );
    expect(markup).toMatch(
      new RegExp(
        `^<${tagName} [^>]*style="--content-body-rail-subject:--content-body-rail-subject-1">A heading<a data-heading-link=""`,
      ),
    );
  });

  test("checks the ID emitted for each heading against the other IDs in the entry", async () => {
    await expect(
      renderedMarkupOf(`
## fn-1

A sentence.[^1]

[^1]: A note.
`),
    ).rejects.toThrow('has more than one element with the ID "fn-1".');
  });

  test("parses a line of pipes without a delimiter row as a paragraph", async () => {
    expect(
      await renderedMarkupOf(`
| Column | Value |
`),
    ).toBe("<p>| Column | Value |</p>");
  });

  test.each([
    ["a URL", "https://example.com/path", "https://example.com/path"],
    ["a `www.` domain", "www.example.com", "http://www.example.com"],
    ["an email address", "someone@example.com", "mailto:someone@example.com"],
  ])("compiles %s in prose to a link", async (_label, literal, href) => {
    expect(
      await renderedMarkupOf(`
See ${literal} for more.
`),
    ).toBe(`<p>See <a href="${href}">${literal}</a> for more.</p>`);
  });

  test("renders an autolinked URL with the `a` component the entry is given", async () => {
    const markup = await renderedMarkupOf(
      `
See https://example.com.
`,
      { a: (properties) => createElement("a", { ...properties, "data-component": "" }) },
    );

    expect(markup).toBe('<p>See <a href="https://example.com" data-component="">https://example.com</a>.</p>');
  });

  test("compiles text between double tildes to a `<del>`", async () => {
    expect(
      await renderedMarkupOf(`
A ~~removed~~ word.
`),
    ).toBe("<p>A <del>removed</del> word.</p>");
  });

  test("parses text between single tildes as prose", async () => {
    expect(
      await renderedMarkupOf(`
From ~1 to ~2, or ~one~.
`),
    ).toBe("<p>From ~1 to ~2, or ~one~.</p>");
  });

  test("compiles a footnote to a reference in its paragraph and a `Footnote` in the group of rail asides after it", async () => {
    const markup = await renderedMarkupOf(
      `
A sentence.[^1]

[^1]: A note.
`,
      { Footnote: ({ number: _number, ...properties }) => createElement("aside", properties) },
    );
    expect(markup)
      .toBe(`<p style="--content-body-rail-subject:--content-body-rail-subject-1">A sentence.<sup><a href="#fn-1" id="fnref-1" aria-label="Footnote 1" data-footnote-reference="">1</a></sup></p>
<div data-rail-asides="" style="--content-body-rail-subject:--content-body-rail-subject-1"><aside id="fn-1"><p>A note. <a href="#fnref-1" aria-label="Back to reference 1">↩︎</a></p></aside></div>`);
  });

  test("groups a footnote referenced inside a `Rail` with that `Rail`", async () => {
    const markup = await renderedMarkupOf(
      `
A paragraph.

<Rail>An aside.[^1]</Rail>

[^1]: A note.
`,
      {
        Rail: (properties) => createElement("aside", properties),
        Footnote: ({ number: _number, ...properties }) => createElement("aside", properties),
      },
    );
    expect(markup).toMatch(
      /<div data-rail-asides="" style="[^"]*"><aside>An aside\.<sup>.*<\/sup><\/aside><aside id="fn-1">.*<\/aside><\/div>$/,
    );
  });

  test("parses task list syntax as a list whose items begin with their brackets", async () => {
    expect(
      await renderedMarkupOf(`
- [ ] Open
- [x] Done
`),
    ).toBe(`<ul>
<li>[ ] Open</li>
<li>[x] Done</li>
</ul>`);
  });

  test("throws for a `Callout` with an unknown variant", async () => {
    await expect(renderedMarkupOf(`<Callout variant="warn">A note.</Callout>`)).rejects.toThrow('the variant "warn"');
  });
});
