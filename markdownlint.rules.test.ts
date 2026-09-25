// eslint-disable-next-line import/no-extraneous-dependencies -- Provided by `markdownlint-cli2`
import { lint } from "markdownlint/promise";
import { describe, expect, test } from "vitest";

import headingLevelsRule from "./markdownlint.rules.ts";

// Lints the source with only the rule under test, and returns the line and detail of each error.
async function headingLevelErrorsIn(source: string) {
  const results = await lint({
    strings: { entry: source },
    config: { default: false, "heading-levels": { minimum: 2, maximum: 3 } },
    customRules: [headingLevelsRule],
  });

  return (results.entry ?? []).map(({ lineNumber, errorDetail }) => ({ lineNumber, errorDetail }));
}

describe("heading-levels", () => {
  test("accepts Markdown headings and heading elements at the minimum and maximum levels", async () => {
    expect(
      await headingLevelErrorsIn(`## A section

### A subsection

<h2>A section</h2>

<h3>A subsection</h3>
`),
    ).toEqual([]);
  });

  test("rejects ATX and setext headings below the minimum level", async () => {
    expect(
      await headingLevelErrorsIn(`# A title

A title
=======
`),
    ).toEqual([
      { lineNumber: 1, errorDetail: "Expected h2 to h3, found h1" },
      { lineNumber: 3, errorDetail: "Expected h2 to h3, found h1" },
    ]);
  });

  test("rejects a Markdown heading above the maximum level", async () => {
    expect(await headingLevelErrorsIn("#### A heading")).toEqual([
      { lineNumber: 1, errorDetail: "Expected h2 to h3, found h4" },
    ]);
  });

  test("rejects a heading element outside the levels, on its own line, inside another element, and in a sentence", async () => {
    expect(
      await headingLevelErrorsIn(`<h1>A title</h1>

<Callout>
  <h4>A heading</h4>
</Callout>

A sentence with <h5>a heading</h5> inside it.
`),
    ).toEqual([
      { lineNumber: 1, errorDetail: "Expected h2 to h3, found an <h1> element" },
      { lineNumber: 4, errorDetail: "Expected h2 to h3, found an <h4> element" },
      { lineNumber: 7, errorDetail: "Expected h2 to h3, found an <h5> element" },
    ]);
  });

  test("ignores a heading written in a code fence or in inline code", async () => {
    expect(
      await headingLevelErrorsIn(`\`\`\`md
# A title
\`\`\`

\`<h4>\` is a heading element.
`),
    ).toEqual([]);
  });

  test("ignores an element whose name begins with `h` and a digit but continues", async () => {
    expect(await headingLevelErrorsIn("<h4x>Not a heading</h4x>")).toEqual([]);
  });
});
