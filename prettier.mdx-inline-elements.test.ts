import { format } from "prettier";
import { describe, expect, test } from "vitest";

import mdxInlineElements from "./prettier.mdx-inline-elements.ts";

const PARAGRAPH = `The paragraph wraps so that an inline element <code data-path>./file.css</code> falls at the start of a line.
`;

function formatWith(source: string, parser: "markdown" | "mdx", plugins = [mdxInlineElements]) {
  return format(source, { parser, plugins, printWidth: 40, proseWrap: "always" });
}

// Formats the source twice, as a later save would, to catch a paragraph the first format sets up to split.
async function formatTwiceWith(source: string, parser: "markdown" | "mdx", plugins = [mdxInlineElements]) {
  return formatWith(await formatWith(source, parser, plugins), parser, plugins);
}

describe("mdx-inline-elements", () => {
  test("wraps before the word preceding an inline element instead of before the element", async () => {
    expect(await formatWith(PARAGRAPH, "mdx")).toBe(`The paragraph wraps so that an inline
element <code data-path>./file.css</code>
falls at the start of a line.
`);
  });

  test("leaves the paragraph whole when formatting its own output again, which splits it without the plugin", async () => {
    expect(await formatTwiceWith(PARAGRAPH, "mdx")).toBe(await formatWith(PARAGRAPH, "mdx"));
    expect(await formatTwiceWith(PARAGRAPH, "mdx", [])).toContain("\n\n<code data-path>");
  });

  test("formats an element on lines of its own as a block, as the built-in printer does", async () => {
    const source = `A paragraph.

<div>
  A block.
</div>
`;
    expect(await formatWith(source, "mdx")).toBe(await formatWith(source, "mdx", []));
  });

  test("formats Markdown as the built-in printer does", async () => {
    expect(await formatWith(PARAGRAPH, "markdown")).toBe(await formatWith(PARAGRAPH, "markdown", []));
  });
});
