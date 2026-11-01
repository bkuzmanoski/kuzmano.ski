import { format } from "prettier";
import { describe, expect, test } from "vitest";

import commentsPlugin from "./prettier.comments.ts";

function formatTypeScript(source: string) {
  return format(source, { parser: "typescript", plugins: [commentsPlugin], printWidth: 40 });
}

function formatCss(source: string) {
  return format(source, { parser: "css", plugins: [commentsPlugin], printWidth: 40 });
}

describe("prettier.comments.ts", () => {
  describe("line comments", () => {
    test("wraps a comment that exceeds the print width, and leaves the result unchanged when formatting it again", async () => {
      const formatted = await formatTypeScript(`// A comment that exceeds the print width and has to wrap.
`);

      expect(formatted).toBe(`// A comment that exceeds the print
// width and has to wrap.
`);
      expect(await formatTypeScript(formatted)).toBe(formatted);
    });

    test("joins adjacent lines wrapped below the print width", async () => {
      expect(
        await formatTypeScript(`// A comment.
// More text.
`),
      ).toBe(`// A comment. More text.
`);
    });

    test("wraps a nested comment to the print width less its indentation", async () => {
      expect(
        await formatTypeScript(`export function run() {
// A comment that exceeds the print width.
  return 1;
}
`),
      ).toBe(`export function run() {
  // A comment that exceeds the print
  // width.
  return 1;
}
`);
    });

    test("wraps a line before a code span containing a space rather than inside it", async () => {
      expect(
        await formatTypeScript(`// A comment with a code span \`of two words\` in it.
`),
      ).toBe(`// A comment with a code span
// \`of two words\` in it.
`);
    });

    test("leaves a line without a space to wrap at as authored when it exceeds the print width", async () => {
      expect(
        await formatTypeScript(`// https://example.com/a/path/that/exceeds/the/print/width
`),
      ).toBe(`// https://example.com/a/path/that/exceeds/the/print/width
`);
    });

    test("preserves a blank comment line between paragraphs", async () => {
      expect(
        await formatTypeScript(`// A paragraph.
//
// Another paragraph.
`),
      ).toBe(`// A paragraph.
//
// Another paragraph.
`);
    });

    test("does not join a comment to one after a blank line", async () => {
      expect(
        await formatTypeScript(`// A comment.

// Another comment.
`),
      ).toBe(`// A comment.

// Another comment.
`);
    });

    test("does not join a line ending in a colon to the line after it", async () => {
      expect(
        await formatTypeScript(`// Items:
// More text.
`),
      ).toBe(`// Items:
// More text.
`);
    });

    test.each([
      {
        description: "a dash",
        source: `// A value that wraps here - the default - applies to every case that follows it.
`,
        expected: `// A value that wraps here - the
// default - applies to every case that
// follows it.
`,
      },
      {
        description: "a list number",
        source: `// The setting applies at most at level 2. Then the value changes for every case.
`,
        expected: `// The setting applies at most at
// level 2. Then the value changes for
// every case.
`,
      },
      {
        description: "a directive name",
        source: `// Write a comment that starts with eslint-disable-next-line before the line.
`,
        expected: `// Write a comment that starts
// with eslint-disable-next-line before
// the line.
`,
      },
    ])(
      "wraps a line before the word preceding $description, so the next line does not start with it",
      async ({ source, expected }) => {
        expect(await formatTypeScript(source)).toBe(expected);
      },
    );

    test("wraps a line before a word ending in a colon rather than after it", async () => {
      expect(
        await formatTypeScript(`// A value is one of these two options: a name or a list of names.
`),
      ).toBe(`// A value is one of these two
// options: a name or a list of names.
`);
    });

    test("wraps a list item with a hanging indent, and starts each item on its own line", async () => {
      expect(
        await formatTypeScript(`// - An item that exceeds the print width.
// - Another item.
`),
      ).toBe(`// - An item that exceeds the print
//   width.
// - Another item.
`);
    });

    test("joins an indented continuation line to its list item", async () => {
      expect(
        await formatTypeScript(`// - An item
//   continues.
`),
      ).toBe(`// - An item continues.
`);
    });

    test("leaves a comment after code on its line", async () => {
      const source = `export const value = 1; // A comment that exceeds the print width.
`;
      expect(await formatTypeScript(source)).toBe(source);
    });

    test("does not join a comment after code to the comment on the next line", async () => {
      expect(
        await formatTypeScript(`export const value = 1; // A comment.
// Another comment.
`),
      ).toBe(`export const value = 1; // A comment.
// Another comment.
`);
    });

    test("leaves a directive on its own line, and joins the lines around it separately", async () => {
      expect(
        await formatTypeScript(`// A comment.
// More text.
// eslint-disable-next-line no-console
console.log(1);
`),
      ).toBe(`// A comment. More text.
// eslint-disable-next-line no-console
console.log(1);
`);
    });

    test("leaves the node after a `prettier-ignore` directive unformatted", async () => {
      const source = `// A comment.
// prettier-ignore
const   value  =  1;
`;
      expect(await formatTypeScript(source)).toBe(source);
    });

    test("leaves commented-out code as authored", async () => {
      const source = `// A comment.
// const value = run(1);
// More text.
`;

      expect(await formatTypeScript(source)).toBe(source);
    });

    test("leaves lines aligned with extra spaces as authored", async () => {
      const source = `// First   Second
// Third   Fourth
`;
      expect(await formatTypeScript(source)).toBe(source);
    });

    test("leaves an indented line as authored", async () => {
      const source = `// An example.
//   indented(line)
`;
      expect(await formatTypeScript(source)).toBe(source);
    });

    test("leaves a comment without a space after its `//` as authored", async () => {
      const source = `//A comment.
//More text.
`;
      expect(await formatTypeScript(source)).toBe(source);
    });

    test("wraps a comment that starts with a word such as `iOS`", async () => {
      expect(
        await formatTypeScript(`// iOS retargets a tap near a control to the control.
`),
      ).toBe(`// iOS retargets a tap near a control to
// the control.
`);
    });
  });

  describe("doc comments", () => {
    test("wraps a one-line doc comment that exceeds the print width onto lines between its delimiters", async () => {
      expect(
        await formatTypeScript(`/** A doc comment that exceeds the print width. */
export const value = 1;
`),
      ).toBe(`/**
 * A doc comment that exceeds the print
 * width.
 */
export const value = 1;
`);
    });

    test("leaves a one-line doc comment that fits the print width on one line", async () => {
      const source = `/** A doc comment. */
export const value = 1;
`;
      expect(await formatTypeScript(source)).toBe(source);
    });

    test("joins adjacent lines wrapped below the print width, and leaves a multi-line doc comment that fits on one line in its multi-line form", async () => {
      expect(
        await formatTypeScript(`/**
 * A comment.
 * More text.
 */
export const value = 1;
`),
      ).toBe(`/**
 * A comment. More text.
 */
export const value = 1;
`);
    });

    test("preserves a blank line between paragraphs", async () => {
      const source = `/**
 * A paragraph.
 *
 * Another paragraph.
 */
export const value = 1;
`;
      expect(await formatTypeScript(source)).toBe(source);
    });

    test("leaves the lines of a code fence as authored", async () => {
      const source = `/**
 * \`\`\`ts
 * run(1)
 * run(2)
 * \`\`\`
 */
export const value = 1;
`;
      expect(await formatTypeScript(source)).toBe(source);
    });

    test("wraps a line before the word preceding an `@` tag, so the tag does not start a line", async () => {
      expect(
        await formatTypeScript(`/**
 * The styles of every rule inside an @media query apply here too.
 */
export const value = 1;
`),
      ).toBe(`/**
 * The styles of every rule inside
 * an @media query apply here too.
 */
export const value = 1;
`);
    });

    test("leaves an empty doc comment as authored", async () => {
      const source = `/**
 */
export const value = 1;
`;
      expect(await formatTypeScript(source)).toBe(source);
    });

    test("leaves a doc comment with text after its opening delimiter as authored", async () => {
      const source = `/** A comment that
 * has text after the opening delimiter.
 */
export const value = 1;
`;
      expect(await formatTypeScript(source)).toBe(source);
    });

    test("leaves a block comment that is not a doc comment as authored", async () => {
      const source = `/* A block comment that exceeds the print width. */
export const value = 1;
`;
      expect(await formatTypeScript(source)).toBe(source);
    });

    test("leaves a doc comment after code on its line", async () => {
      const source = `export const value = 1; /** A doc comment that exceeds the print width. */
`;
      expect(await formatTypeScript(source)).toBe(source);
    });
  });

  describe("CSS comments", () => {
    test("wraps a comment that exceeds the print width with an asterisk on each later line, and leaves the result unchanged when formatting it again", async () => {
      const formatted = await formatCss(`/* A comment that exceeds the print width. */
.element {
  color: red;
}
`);

      expect(formatted).toBe(`/* A comment that exceeds the print
 * width. */
.element {
  color: red;
}
`);
      expect(await formatCss(formatted)).toBe(formatted);
    });

    test("joins adjacent lines wrapped below the print width", async () => {
      expect(
        await formatCss(`/* A comment.
 * More text. */
.element {
  color: red;
}
`),
      ).toBe(`/* A comment. More text. */
.element {
  color: red;
}
`);
    });

    test("wraps a comment in a rule to the print width less its indentation", async () => {
      expect(
        await formatCss(`.element {
  /* A comment that exceeds the width. */
  color: red;
}
`),
      ).toBe(`.element {
  /* A comment that exceeds the
   * width. */
  color: red;
}
`);
    });

    test("preserves a blank line between paragraphs", async () => {
      const source = `/* A paragraph.
 *
 * Another paragraph. */
.element {
  color: red;
}
`;
      expect(await formatCss(source)).toBe(source);
    });

    test("leaves a comment after a declaration on its line", async () => {
      const source = `.element {
  color: red; /* A comment that exceeds the print width. */
}
`;
      expect(await formatCss(source)).toBe(source);
    });

    test("leaves a comment with its closing delimiter on its own line as authored", async () => {
      const source = `/* A comment.
 * More text.
 */
.element {
  color: red;
}
`;
      expect(await formatCss(source)).toBe(source);
    });

    test("leaves a directive as authored", async () => {
      const source = `/* stylelint-disable-next-line a-rule-that-exceeds-the-print-width */
.element {
  color: red;
}
`;
      expect(await formatCss(source)).toBe(source);
    });
  });

  describe("embedded code", () => {
    test("leaves a comment in a Markdown code block as authored", async () => {
      const source = `\`\`\`ts
// A comment that exceeds the print width.
// More text.
export const value = 1;
\`\`\`
`;
      expect(await format(source, { parser: "markdown", plugins: [commentsPlugin], printWidth: 40 })).toBe(source);
    });

    test("leaves a comment in CSS embedded in a Markdown code block as authored", async () => {
      const source = `\`\`\`css
/* A comment that exceeds the print width. */
.element {
  color: red;
}
\`\`\`
`;
      expect(await format(source, { parser: "markdown", plugins: [commentsPlugin], printWidth: 40 })).toBe(source);
    });
  });
});
