// eslint-disable-next-line import/no-extraneous-dependencies -- Provided by `markdownlint-cli2`.
import { applyFixes } from "markdownlint";
// eslint-disable-next-line import/no-extraneous-dependencies -- Provided by `markdownlint-cli2`.
import { lint } from "markdownlint/promise";
import { describe, expect, test } from "vitest";

import typographicQuotesRule, { AMBIGUOUS_QUOTE_DETAIL } from "./markdownlint.typographic-quotes.ts";

async function typographicQuoteErrorsIn(source: string) {
  const results = await lint({
    strings: { entry: source },
    config: { default: false, "typographic-quotes": true },
    customRules: [typographicQuotesRule],
  });
  return results.entry ?? [];
}

async function fixed(source: string) {
  return applyFixes(source, await typographicQuoteErrorsIn(source));
}

describe("typographic-quotes", () => {
  test("accepts typographic quotation marks and apostrophes", async () => {
    expect(await typographicQuoteErrorsIn("“A ‘quotation’,” it’s the entry’s.")).toEqual([]);
  });

  test("reports the line, column, and expected character of each straight quote", async () => {
    const errors = await typographicQuoteErrorsIn(`A paragraph.

A "quotation".
`);
    expect(errors.map(({ lineNumber, errorRange, errorDetail }) => ({ lineNumber, errorRange, errorDetail }))).toEqual([
      { lineNumber: 3, errorRange: [3, 1], errorDetail: 'Expected “, found "' },
      { lineNumber: 3, errorRange: [13, 1], errorDetail: 'Expected ”, found "' },
    ]);
  });

  test("fixes double and single quotation marks by whether they open or close", async () => {
    expect(await fixed(`"A 'quotation' (in "parentheses")," and "'nested'."`)).toBe(
      `“A ‘quotation’ (in “parentheses”),” and “‘nested’.”`,
    );
  });

  test("fixes apostrophes within, at the end of, and at the start of a word", async () => {
    expect(await fixed("It's the entries' rock 'n' roll from the '90s, 'til the 90's.")).toBe(
      "It’s the entries’ rock ’n’ roll from the ’90s, ’til the 90’s.",
    );
  });

  test("fixes a quote either side of emphasis, inline code, a link, and a JSX element", async () => {
    expect(await fixed('"*A*" "`a`" "[a](/page)" <Kbd>A</Kbd>\'s')).toBe("“*A*” “`a`” “[a](/page)” <Kbd>A</Kbd>’s");
  });

  test("fixes a closing quote after a digit inside a quotation", async () => {
    expect(await fixed(`"Version 2" and 'version 2'`)).toBe("“Version 2” and ‘version 2’");
  });

  test("fixes a quote between a dash and a space as closing the quotation it is in", async () => {
    expect(await fixed(`"I was going to—" she said, 'and then—' she stopped.`)).toBe(
      "“I was going to—” she said, ‘and then—’ she stopped.",
    );
  });

  test("reports a quote after a digit outside a quotation, between two digits, or between spaces, without a fix", async () => {
    const source = `A 27" display, 5'10", and a ' alone.`;
    const errors = await typographicQuoteErrorsIn(source);

    expect(errors.map(({ errorRange, errorDetail, fixInfo }) => ({ errorRange, errorDetail, fixInfo }))).toEqual([
      { errorRange: [5, 1], errorDetail: AMBIGUOUS_QUOTE_DETAIL, fixInfo: null },
      { errorRange: [17, 1], errorDetail: AMBIGUOUS_QUOTE_DETAIL, fixInfo: null },
      { errorRange: [20, 1], errorDetail: AMBIGUOUS_QUOTE_DETAIL, fixInfo: null },
      { errorRange: [29, 1], errorDetail: AMBIGUOUS_QUOTE_DETAIL, fixInfo: null },
    ]);
  });

  test("ignores a backslash-escaped quote", async () => {
    expect(await typographicQuoteErrorsIn(`A 27\\" display and 5\\'.`)).toEqual([]);
  });

  test("fixes quotes in headings, list items, block quotes, table cells, and footnotes", async () => {
    expect(
      await fixed(`## It's a heading

- It's a list item

> It's a block quote

| It's a cell |
| ----------- |

A footnote.[^1]

[^1]: It's a footnote.
`),
    ).toBe(`## It’s a heading

- It’s a list item

> It’s a block quote

| It’s a cell |
| ----------- |

A footnote.[^1]

[^1]: It’s a footnote.
`);
  });

  test("fixes quotes on a block quote's continuation lines by the text after the `>` marker", async () => {
    expect(
      await fixed(`> A "quotation
>"continues" here.
`),
    ).toBe(`> A “quotation
>“continues” here.
`);
  });

  test("fixes quotes in the text inside a JSX element, its prose attribute values, and an image's alt text", async () => {
    expect(
      await fixed(`<Rail label="It's">
  It's inside an element.
</Rail>

<img alt='A "quotation"' src="./image.png" />

![It's an image](./image.png)
`),
    ).toBe(`<Rail label="It’s">
  It’s inside an element.
</Rail>

<img alt='A “quotation”' src="./image.png" />

![It’s an image](./image.png)
`);
  });

  test("ignores the values of JSX attributes that are not prose, such as a URL or a data attribute", async () => {
    expect(
      await typographicQuoteErrorsIn(`<a href="/page?query='a'" data-content-span='a "b"'>A link</a>
`),
    ).toEqual([]);
  });

  test("ignores the text inside a `<code>`, `<kbd>`, `<pre>`, or `<samp>` element", async () => {
    expect(
      await typographicQuoteErrorsIn(`Press <kbd>'</kbd> to type <code>'a'</code>, which prints <samp>"a"</samp>.

<pre>
  const value = "a";
</pre>
`),
    ).toEqual([]);
  });

  test("fixes quotes in link, image, and definition titles, and in a reference image's alt text", async () => {
    expect(
      await fixed(`[A link](/page "It's a title") [A link](/page (It's a title)) ![It's an image][image]

[image]: ./image.png 'A "title"'
`),
    ).toBe(`[A link](/page "It’s a title") [A link](/page (It’s a title)) ![It’s an image][image]

[image]: ./image.png 'A “title”'
`);
  });

  test("ignores quotes in frontmatter, ESM, code, expressions, link destinations, and autolink literals", async () => {
    expect(
      await typographicQuoteErrorsIn(`---
title: "A title"
---

import { Component } from "./component.tsx";

\`\`\`ts
const value = "a";
\`\`\`

\`'a'\` {"a"} <Component value={"a"} /> [a](/page?query='a') https://example.com/a'b
`),
    ).toEqual([]);
  });

  test("ignores MDX that does not parse", async () => {
    expect(await typographicQuoteErrorsIn(`<Unclosed "a"`)).toEqual([]);
  });
});
