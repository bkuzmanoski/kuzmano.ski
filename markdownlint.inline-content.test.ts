// eslint-disable-next-line import/no-extraneous-dependencies -- Provided by `markdownlint-cli2`.
import { applyFixes } from "markdownlint";
// eslint-disable-next-line import/no-extraneous-dependencies -- Provided by `markdownlint-cli2`.
import { lint } from "markdownlint/promise";
import { describe, expect, test } from "vitest";

import inlineContentRule from "./markdownlint.inline-content.ts";

async function inlineContentErrorsIn(source: string) {
  const results = await lint({
    strings: { entry: source },
    config: { default: false, "inline-content": true },
    customRules: [inlineContentRule],
  });

  return results.entry ?? [];
}

async function fixed(source: string) {
  return applyFixes(source, await inlineContentErrorsIn(source));
}

describe("inline-content", () => {
  test("accepts inline elements and inline components inside a paragraph", async () => {
    expect(
      await inlineContentErrorsIn(`A sentence with <kbd>K</kbd>, a <my-element>custom element</my-element>, and an <AlertButton message="A message.">alert button</AlertButton>.

![An image](./image.png)
<sup>A note.</sup>
`),
    ).toEqual([]);
  });

  test("accepts a fragment of inline content inside a paragraph", async () => {
    expect(await inlineContentErrorsIn(`A sentence with <>a fragment</> inside it.\n`)).toEqual([]);
  });

  test("reports a block inside a fragment inside a paragraph", async () => {
    const errors = await inlineContentErrorsIn(`A sentence with <><div>a block</div></> inside it.\n`);
    expect(errors.map(({ lineNumber, errorDetail }) => ({ lineNumber, errorDetail }))).toEqual([
      { lineNumber: 1, errorDetail: "Expected a blank line between the paragraph and <div>" },
    ]);
  });

  test("accepts a block after a blank line, on lines of its own, and beside only JSX elements", async () => {
    // MDX parses an opening tag alone on its line as a block, and renders a paragraph of only JSX elements as blocks.
    expect(
      await inlineContentErrorsIn(`<figure>
  ![An image](./image.png)

  <figcaption>A caption.</figcaption>
</figure>

<figure>
  ![An image](./image.png)
  <figcaption>
    A caption.
  </figcaption>
</figure>

<figure>
  <blockquote>A quotation.</blockquote>
  <figcaption>A caption.</figcaption>
</figure>

<Aside label="Aside">An aside.</Aside>
<Aside label="Aside">Another aside.</Aside>
`),
    ).toEqual([]);
  });

  test("reports the line and name of an element or component on the line after Markdown", async () => {
    const errors = await inlineContentErrorsIn(`<figure>
  ![An image](./image.png)
  <figcaption>A caption.</figcaption>
</figure>

A paragraph.
<Aside label="Aside">An aside.</Aside>
`);
    expect(errors.map(({ lineNumber, errorDetail }) => ({ lineNumber, errorDetail }))).toEqual([
      { lineNumber: 3, errorDetail: "Expected a blank line between the paragraph and <figcaption>" },
      { lineNumber: 7, errorDetail: "Expected a blank line between the paragraph and <Aside>" },
    ]);
  });

  test("reports a block inside a link and inside an inline element in a paragraph, naming the element it is inside", async () => {
    const errors =
      await inlineContentErrorsIn(`A sentence with [a <div>block</div>](/page) and <a href="/page"><div>another</div></a>.
`);
    expect(errors.map(({ lineNumber, errorDetail }) => ({ lineNumber, errorDetail }))).toEqual([
      { lineNumber: 1, errorDetail: "Expected inline content inside <a>, not <div>" },
      { lineNumber: 1, errorDetail: "Expected inline content inside <a>, not <div>" },
    ]);
  });

  test("reports a block inside a heading, an inline element, and a component that accepts only inline content", async () => {
    const errors = await inlineContentErrorsIn(`## A heading <div>A block.</div>

<span>
  <div>A block.</div>
</span>

<AlertButton message="A message.">
  Some text.

  <Callout>A callout.</Callout>
</AlertButton>

<ImageRow>
  ![An image](./image.png)

  \`\`\`js
  code();
  \`\`\`
</ImageRow>
`);
    expect(errors.map(({ lineNumber, errorDetail }) => ({ lineNumber, errorDetail }))).toEqual([
      { lineNumber: 1, errorDetail: "Expected inline content inside <h2>, not <div>" },
      { lineNumber: 4, errorDetail: "Expected inline content inside <span>, not <div>" },
      { lineNumber: 10, errorDetail: "Expected inline content inside <AlertButton>, not <Callout>" },
      { lineNumber: 16, errorDetail: "Expected inline content inside <ImageRow>, not <pre>" },
    ]);
  });

  test("accepts an element on the line after the text of an item in a tight list, which renders without a paragraph", async () => {
    expect(
      await inlineContentErrorsIn(`- ![An image](./image.png)
  <figcaption>A caption.</figcaption>
- An item.
`),
    ).toEqual([]);
  });

  test("reports an element on the line after the text of an item in a loose list, which renders in a paragraph", async () => {
    const errors = await inlineContentErrorsIn(`- ![An image](./image.png)
  <figcaption>A caption.</figcaption>

- An item.
`);
    expect(errors.map(({ lineNumber }) => lineNumber)).toEqual([2]);
  });

  test("ignores a block among the children of an `ImageGallery`, which the build checks with its own message", async () => {
    expect(
      await inlineContentErrorsIn(`<ImageGallery>
  ![An image](./image.png)

  <div>A block.</div>
</ImageGallery>
`),
    ).toEqual([]);
  });

  test("fixes an element that continues the paragraph above it by inserting a blank line before it", async () => {
    expect(
      await fixed(`<figure>
  ![An image](./image.png)
  <figcaption>A caption.</figcaption>
</figure>
`),
    ).toBe(`<figure>
  ![An image](./image.png)

  <figcaption>A caption.</figcaption>
</figure>
`);
  });

  test("does not fix an element that a blank line would not separate from its paragraph", async () => {
    // A blank line would end the block quote, or leave the element on a line with other content, which MDX also parses
    // as a paragraph. The rule fixes only a paragraph at the root or in a JSX element, so it does not fix the list item
    // either. The list is loose, as a tight list renders its items without a paragraph.
    const source = `![An image](./image.png) <figcaption>A caption.</figcaption>

![An image](./image.png)
<figcaption>A caption.</figcaption> More text.

<figcaption>A caption.</figcaption> More text.

> ![An image](./image.png)
> <figcaption>A caption.</figcaption>

- ![An image](./image.png)
  <figcaption>A caption.</figcaption>

- An item.
`;
    const errors = await inlineContentErrorsIn(source);

    expect(errors.map(({ lineNumber, fixInfo }) => ({ lineNumber, fixInfo }))).toEqual([
      { lineNumber: 1, fixInfo: null },
      { lineNumber: 4, fixInfo: null },
      { lineNumber: 6, fixInfo: null },
      { lineNumber: 9, fixInfo: null },
      { lineNumber: 12, fixInfo: null },
    ]);
    expect(applyFixes(source, errors)).toBe(source);
  });
});
