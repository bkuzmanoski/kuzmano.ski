import { format } from "prettier";
import { describe, expect, test } from "vitest";

import mdxPlugin from "./prettier.mdx.ts";

const PARAGRAPH = `The paragraph wraps so that an inline element <code data-path>./file.css</code> falls at the start of a line.
`;

function formatWith(source: string, parser: "markdown" | "mdx", plugins = [mdxPlugin]) {
  return format(source, { parser, plugins, printWidth: 40, proseWrap: "always" });
}

// Formats the source twice, as a later save would, to catch a paragraph the first format sets up to split.
async function formatTwiceWith(source: string, parser: "markdown" | "mdx", plugins = [mdxPlugin]) {
  return formatWith(await formatWith(source, parser, plugins), parser, plugins);
}

describe("prettier.mdx.ts", () => {
  describe("inline elements", () => {
    test("wraps before the word preceding an inline element instead of before the element", async () => {
      expect(await formatWith(PARAGRAPH, "mdx")).toBe(`The paragraph wraps so that an inline
element <code data-path>./file.css</code>
falls at the start of a line.
`);
    });

    test("leaves the paragraph whole when formatting its own output again", async () => {
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

  describe("element blocks", () => {
    test("prints a block containing Markdown images as written", async () => {
      const source = `<Parent>
  ![First image](./first.png)
  ![Second image](./second.png)
  <img src="./third.png"   alt="Third image" />
</Parent>
`;

      expect(await formatWith(source, "mdx")).toBe(source);
      expect(await formatWith(source, "mdx", [])).toContain("![First image](./first.png) ![Second");
    });

    test("formats a block separated from its parent's opening tag by a blank line, and preserves its indentation", async () => {
      expect(
        await formatWith(
          `<Parent>
  ![First image](./first.png)

  <img src="./second.png"   alt="Second image" />

  <picture>
    <img src="./third.png" alt="Third image" />
  </picture>
</Parent>
`,
          "mdx",
        ),
      ).toBe(`<Parent>
  ![First image](./first.png)

  <img
    src="./second.png"
    alt="Second image"
  />

  <picture>
    <img src="./third.png" alt="Third image" />
  </picture>
</Parent>
`);
    });

    test("formats a block without Markdown images as the built-in printer does", async () => {
      const source = `<Parent>
  <img src="./first.png"   alt="First image" />
  A paragraph in the parent element, long enough to wrap.
</Parent>
`;
      expect(await formatWith(source, "mdx")).toBe(await formatWith(source, "mdx", []));
    });
  });
});
