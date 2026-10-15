import { doc, format } from "prettier";
import { describe, expect, test, vi } from "vitest";

import mdxPlugin, { firstDifferenceBetween } from "./prettier.mdx.ts";

function formatWith(source: string) {
  return format(source, { parser: "mdx", plugins: [mdxPlugin], printWidth: 40, proseWrap: "always" });
}

function parse(source: string) {
  return mdxPlugin.parsers.mdx.parse(source);
}

describe("prettier.mdx.ts", () => {
  describe("paragraphs and ESM", () => {
    test("wraps a paragraph with an inline element at the start of a line, and leaves the result unchanged when formatting it again", async () => {
      const formatted = await formatWith(
        `The paragraph wraps so that an inline element <code>./directory/file.css</code> falls at the start of a line.
`,
      );

      expect(formatted).toBe(`The paragraph wraps so that an inline
element
<code>./directory/file.css</code> falls
at the start of a line.
`);
      expect(await formatWith(formatted)).toBe(formatted);
    });

    test("formats imports and exports as JavaScript", async () => {
      expect(
        await formatWith(`import {Parent} from './parent.tsx'
export const value = {key:'A value'}

A paragraph.
`),
      ).toBe(`import { Parent } from "./parent.tsx";
export const value = { key: "A value" };

A paragraph.
`);
    });
  });

  describe("elements", () => {
    test("indents the children of an element by two spaces and formats them as Markdown", async () => {
      expect(
        await formatWith(`<Parent>
Intro:
* First item
* Second item,
  continued
</Parent>
`),
      ).toBe(`<Parent>
  Intro:

  - First item
  - Second item, continued
</Parent>
`);
    });

    test("wraps a paragraph inside an element to the print width less its indentation", async () => {
      expect(
        await formatWith(`<Parent>
  A paragraph in the parent element, long enough to wrap.
</Parent>
`),
      ).toBe(`<Parent>
  A paragraph in the parent element,
  long enough to wrap.
</Parent>
`);
    });

    test("prints an element authored on one line, and one authored over several lines, as authored", async () => {
      const source = `<Parent>A short paragraph.</Parent>

<Parent>
  A short paragraph.
</Parent>
`;
      expect(await formatWith(source)).toBe(source);
    });

    test("removes blank lines between an element's tags and its children", async () => {
      expect(
        await formatWith(`<Parent>

  A paragraph.

</Parent>
`),
      ).toBe(`<Parent>
  A paragraph.
</Parent>
`);
    });

    test("formats the opening tag of an element with children as JSX, breaking its attributes onto lines of their own when it exceeds the print width less its indentation", async () => {
      expect(
        await formatWith(`<Parent value={1+2}>
<Child first="1" second="A second attribute">
A paragraph.
</Child>
</Parent>
`),
      ).toBe(`<Parent value={1 + 2}>
  <Child
    first="1"
    second="A second attribute"
  >
    A paragraph.
  </Child>
</Parent>
`);
    });

    test("formats an element without children as JSX", async () => {
      expect(
        await formatWith(`<Parent>
  <img src="./image.png"   alt="An image with alternative text long enough to wrap" />
</Parent>
`),
      ).toBe(`<Parent>
  <img
    src="./image.png"
    alt="An image with alternative text long enough to wrap"
  />
</Parent>
`);
    });

    test("indents fenced code inside an element, preserving the relative indentation of its lines", async () => {
      expect(
        await formatWith(`<Parent>

\`\`\`swift
let value = 1
  let indented = 2
\`\`\`
</Parent>
`),
      ).toBe(`<Parent>
  \`\`\`swift
  let value = 1
    let indented = 2
  \`\`\`
</Parent>
`);
    });
  });

  describe("blocks printed as authored", () => {
    test("prints a Markdown block containing an element as authored", async () => {
      const source = `- A list item containing an element:

  <Parent>
  A paragraph   with extra spaces.
  </Parent>
`;
      expect(await formatWith(source)).toBe(source);
    });

    test("prints a paragraph containing an expression or an element with an expression attribute as authored", async () => {
      const source = `A paragraph with an expression {1 *2* 3} and extra   spaces.

<Parent value={1 *2* 3}>A child</Parent> and extra   spaces.
`;
      expect(await formatWith(source)).toBe(source);
    });
  });

  describe("firstDifferenceBetween", () => {
    test("returns the first node of the original whose content differs from the formatted MDX", () => {
      const difference = firstDifferenceBetween(
        parse(`A paragraph.

A second paragraph.
`),
        parse(`A paragraph.

A changed paragraph.
`),
      );

      expect(difference?.type).toBe("text");
      expect(difference?.position?.start.line).toBe(3);
    });

    test("returns the first node of the original whose children differ in number from the formatted MDX", () => {
      expect(
        firstDifferenceBetween(
          parse(`A paragraph.
<Parent>A child</Parent>
`),
          parse(`A paragraph.

<Parent>A child</Parent>
`),
        )?.type,
      ).toBe("root");
    });

    test("ignores the line breaks of wrapped text and the formatting of JavaScript", () => {
      expect(
        firstDifferenceBetween(
          parse(`import {Parent} from './parent.tsx'

A paragraph in   the parent element, long enough to wrap.
`),
          parse(`import { Parent } from "./parent.tsx";

A paragraph in the parent element,
long enough to wrap.
`),
        ),
      ).toBeUndefined();
    });

    test("treats a line break in inline code as a space, as Markdown does", () => {
      expect(
        firstDifferenceBetween(
          parse(`A paragraph with \`inline
code\`.
`),
          parse(`A paragraph with \`inline code\`.
`),
        ),
      ).toBeUndefined();
    });

    test("returns text whose non-breaking space is a space in the formatted MDX, as Markdown does not collapse it", () => {
      expect(
        firstDifferenceBetween(
          parse(`A\u00A0paragraph.
`),
          parse(`A paragraph.
`),
        )?.type,
      ).toBe("text");
    });

    test("returns inline code whose spaces differ from the formatted MDX", () => {
      expect(
        firstDifferenceBetween(
          parse(`A paragraph with \`inline  code\`.
`),
          parse(`A paragraph with \`inline code\`.
`),
        )?.type,
      ).toBe("inlineCode");
    });
  });

  // The plugin checks its output with the string `doc.printer.printDocToString` renders, which the stub replaces,
  // since no input is known to fail the check.
  describe("failures", () => {
    test("rejects with the line of the first difference when the formatted MDX parses to a different tree", async () => {
      vi.spyOn(doc.printer, "printDocToString").mockReturnValueOnce({
        formatted: `A paragraph.

A changed paragraph.
`,
      });
      await expect(
        formatWith(`A paragraph.

A second paragraph.
`),
      ).rejects.toThrow("Formatting changes how MDX parses the `text` at line 3.");
    });

    test("rejects when the formatted MDX fails to parse", async () => {
      vi.spyOn(doc.printer, "printDocToString").mockReturnValueOnce({
        formatted: `A paragraph with {an unclosed expression.
`,
      });
      await expect(
        formatWith(`A paragraph.
`),
      ).rejects.toThrow("Formatting produces MDX that fails to parse");
    });
  });
});
