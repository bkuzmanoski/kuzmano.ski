import { describe, expect, test, vi } from "vitest";

import { GITHUB_PROFILE_LINK_TEXT, GITHUB_PROFILE_URL, SITE_URL } from "#/config/site.ts";
import { mediaRoute } from "#/lib/content/paths.ts";
import type { Experience } from "#/lib/experience/career-timeline.ts";
import { fallbackText } from "#/lib/waitlist/render-fallback.ts";

import { CONTENT_DIRECTORY_PATH, fromContent } from "../paths.ts";
import { ENTRY_ABSOLUTE_PATH, MEDIA_FILE_HASH } from "../test-utils/media.ts";

import { markdownRendererFor } from "./markdown.ts";

import type { EntryDataModule } from "./entry-data.ts";
import type { MediaForEntry } from "../content/markup/media-rewrite.ts";

const ENTRY_URL = "https://example.com/collection/entry";
const FRONTMATTER = `---
title: A title
description: A description.
date: 2026-07-19
---
`;
const IMAGE = {
  kind: "image" as const,
  src: mediaRoute(`collection/entry/image.${MEDIA_FILE_HASH}.png`),
  width: 900,
  height: 500,
  alternates: [{ srcSet: mediaRoute(`collection/entry/image.${MEDIA_FILE_HASH}.avif`), type: "image/avif" }],
};
const VIDEO = {
  kind: "video" as const,
  src: mediaRoute(`collection/entry/video.${MEDIA_FILE_HASH}.mp4`),
  width: 960,
  height: 540,
  posterImage: {
    src: mediaRoute(`collection/entry/video.poster.${MEDIA_FILE_HASH}.webp`),
    width: 960,
    height: 540,
  },
};

const MEDIA: Record<string, typeof IMAGE | typeof VIDEO> = { "./image.png": IMAGE, "./video.mp4": VIDEO };
const EXPERIENCE: Experience = {
  asOf: "2026-09",
  disciplines: [{ id: "discipline", name: "Discipline", accentColor: "blue" }],
  roles: [
    {
      title: "Role",
      organization: "Organization",
      disciplines: ["discipline"],
      start: "2026-01",
      end: null,
      summary: "A summary.",
    },
  ],
};
const OTHER_EXPERIENCE: Experience = {
  ...EXPERIENCE,
  roles: [{ ...EXPERIENCE.roles[0]!, title: "Other Role", organization: "Other Organization" }],
};

const ENTRY_DATA_MODULE: EntryDataModule = {
  RECORD: EXPERIENCE,
  OTHER_RECORD: OTHER_EXPERIENCE,
  INVALID_RECORD: { ...EXPERIENCE, asOf: "soon" },
};

// Returns the fake module for the data file of `collection/entry.mdx`, and rejects for any other
// path, as a missing file does.
const readEntryDataModule = vi.fn((absolutePath: string) =>
  absolutePath === fromContent("collection/entry.data.ts")
    ? Promise.resolve(ENTRY_DATA_MODULE)
    : Promise.reject(new Error("The file does not exist.")),
);

const mediaForEntry: MediaForEntry = (absolutePath) =>
  Promise.resolve((reference: string) => (absolutePath === ENTRY_ABSOLUTE_PATH ? (MEDIA[reference] ?? null) : null));
const markdownFor = markdownRendererFor();
const markdownWithMediaFor = markdownRendererFor(mediaForEntry);
const entryDataMarkdownFor = (source: string) =>
  markdownFor(`${FRONTMATTER}${source}`, { path: fromContent("collection/entry.mdx"), readEntryDataModule });

describe("markdownFor", () => {
  test("preserves the frontmatter block", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      Body.
    `);
    expect(markdown).toContain(FRONTMATTER.trim());
  });

  test("preserves prose, headings, and code fences", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      # Heading

      Some _text_.

      \`\`\`ts
      const a = 1;
      \`\`\`
    `);

    expect(markdown).toContain("# Heading");
    expect(markdown).toContain("Some _text_.");
    expect(markdown).toContain("```ts\nconst a = 1;\n```");
  });

  test("omits imports, exports, and expressions", async () => {
    const markdown = await markdownFor(
      `${FRONTMATTER}\nimport { Note } from "./note";\nexport const value = 1;\n\n{/* A comment */}\n\nBody.\n`,
    );

    expect(markdown).not.toContain("import");
    expect(markdown).not.toContain("export");
    expect(markdown).not.toContain("comment");
    expect(markdown).toContain("Body.");
  });

  test("replaces a component with its children", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <Note>
        A wrapped paragraph.
      </Note>

      A <Emphasis>wrapped phrase</Emphasis>.
    `);

    expect(markdown).not.toContain("<Note>");
    expect(markdown).not.toContain("<Emphasis>");
    expect(markdown).toContain("A wrapped paragraph.");
    expect(markdown).toContain("A wrapped phrase.");
  });

  test("omits a component without children", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <Figure src="/a.png" />

      Body.
    `);
    expect(markdown).not.toContain("Figure");
  });

  test("replaces a component nested inside another with its children", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <Note>
        <Panel>
          A nested paragraph.
        </Panel>
      </Note>
    `);

    expect(markdown).not.toContain("<");
    expect(markdown).toContain("A nested paragraph.");
  });

  test("replaces a component with fallback Markdown, nested inside one without, with its children and its fallback Markdown", async () => {
    const source = `${FRONTMATTER}
      <Note>
        <Waitlist list="List">
          Description.
        </Waitlist>
      </Note>
    `;
    const markdown = await markdownFor(source, { url: ENTRY_URL });

    expect(markdown).not.toContain("<");
    expect(markdown).toContain("Description.");
    expect(markdown).toContain(fallbackText(`[${ENTRY_URL}](${ENTRY_URL})`));
  });

  test("replaces a component nested inside another, written inside a sentence, with its children", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      A <Emphasis>phrase <Strong>within</Strong> a phrase</Emphasis>.
    `);
    expect(markdown).toContain("A phrase within a phrase.");
  });

  test("replaces an element named after an `Object.prototype` property with its children", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      A <constructor>wrapped</constructor> word.
    `);
    expect(markdown).toContain("A wrapped word.");
  });

  test("omits an expression and a component without children nested inside another", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <Note>
        <Figure src="/image.png" />

        {/* A comment */}

        Body.
      </Note>
    `);

    expect(markdown).not.toContain("Figure");
    expect(markdown).not.toContain("comment");
    expect(markdown).toContain("Body.");
  });

  test("replaces a `Waitlist` with its children and its fallback Markdown", async () => {
    const source = `${FRONTMATTER}
      <Waitlist list="List">
        Description.
      </Waitlist>

      Body.
    `;
    const markdown = await markdownFor(source, { url: ENTRY_URL });

    expect(markdown).toContain("Description.");
    expect(markdown).toContain(fallbackText(`[${ENTRY_URL}](${ENTRY_URL})`));
    expect(markdown).toContain("Body.");
  });

  test("throws when a component whose fallback Markdown is a block is written inside a sentence, naming the file by its repository-relative path and the component", async () => {
    const source = `${FRONTMATTER}
      A sentence with <Waitlist list="List">a phrase</Waitlist> inside it.
    `;
    const pendingMarkdown = markdownFor(source, { path: fromContent("collection/entry.mdx"), url: ENTRY_URL });

    await expect(pendingMarkdown).rejects.toThrow(
      `"${CONTENT_DIRECTORY_PATH}/collection/entry.mdx" writes components inline`,
    );
    await expect(pendingMarkdown).rejects.toThrow("Waitlist");
  });

  test("omits a `Waitlist` when called without an entry URL", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <Waitlist list="List">
        Description.
      </Waitlist>
    `);

    expect(markdown).not.toContain("waitlist");
    expect(markdown).not.toContain("Description.");
  });

  test.each(["Callout", "Rail"])(
    "renders the `label` attribute of a `%s` as bold text above its children",
    async (name) => {
      const markdown = await markdownFor(`${FRONTMATTER}
      <${name} label="Label">
        A labeled paragraph.
      </${name}>
    `);
      expect(markdown).toContain(`**Label**

A labeled paragraph.`);
    },
  );

  test.each(["Callout", "Rail"])(
    "renders the `label` attribute of a `%s` written on one line as bold text at the start of its sentence",
    async (name) => {
      const markdown = await markdownFor(`${FRONTMATTER}
        <${name} label="Label">A labeled sentence.</${name}>
      `);
      expect(markdown).toContain("**Label** A labeled sentence.");
    },
  );

  test("replaces a `Callout` without a `label` attribute with its children", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <Callout>
        An unlabeled paragraph.
      </Callout>
    `);

    expect(markdown).not.toContain("**");
    expect(markdown).toContain("An unlabeled paragraph.");
  });

  test("replaces an `ImageGrid` with its children, then the paragraph of its `caption` attribute", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <ImageGrid caption="A caption.">
        <img src="https://example.com/first.png" alt="First" />
        <img src="https://example.com/second.png" alt="Second" />
      </ImageGrid>
    `);
    expect(markdown).toContain(`![First](https://example.com/first.png)

![Second](https://example.com/second.png)

A caption.`);
  });

  test("replaces an `ImageGrid` without a `caption` attribute with its children", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <ImageGrid>
        <img src="https://example.com/image.png" alt="An image" />
      </ImageGrid>

      Body.
    `);
    expect(markdown).toContain(`![An image](https://example.com/image.png)

Body.`);
  });

  test.each([
    ["a `<code>` with a `data-path` attribute", "<code data-path>directory/file.ts</code>", "`directory/file.ts`"],
    ["a `<kbd>`", "<kbd>Escape</kbd>", "`Escape`"],
  ])("renders %s as inline code", async (_label, element, inlineCode) => {
    const markdown = await markdownFor(`${FRONTMATTER}
      Press ${element} now.
    `);
    expect(markdown).toContain(`Press ${inlineCode} now.`);
  });

  test.each([
    ["a `<kbd>`", `<kbd>{"⌘"}</kbd>`, "`⌘`"],
    ["a `<code>`", "<code>{`{`}value{`}`}</code>", "`{value}`"],
    ["prose", `a {"literal"} {1}`, "a literal 1"],
  ])("renders the text of a literal expression in %s", async (_label, element, text) => {
    const markdown = await markdownFor(`${FRONTMATTER}
      Press ${element} now.
    `);
    expect(markdown).toContain(`Press ${text} now.`);
  });

  test("renders an `<hr>` as a thematic break", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      Before.

      <hr />

      After.
    `);
    expect(markdown).toContain(`Before.

---

After.`);
  });

  test("replaces a `ContributionGraph` with a link to the GitHub profile", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <ContributionGraph />
    `);
    expect(markdown).toContain(`[${GITHUB_PROFILE_LINK_TEXT}](${GITHUB_PROFILE_URL})`);
  });

  test("renders an `CareerTimeline` from the export of the entry's data file that its spread names", async () => {
    const markdown = await entryDataMarkdownFor(`
import { OTHER_RECORD } from "./entry.data.ts";

<CareerTimeline {...OTHER_RECORD} />
`);

    expect(markdown).toContain("Other Role, Other Organization");
    expect(markdown).not.toContain("## Role, Organization");
  });

  test("renders an `CareerTimeline` nested inside another component", async () => {
    const markdown = await entryDataMarkdownFor(`
import { RECORD } from "./entry.data.ts";

<Figure>
  <CareerTimeline {...RECORD} />
</Figure>
`);
    expect(markdown).toContain("Role, Organization");
  });

  test("does not import the entry's data file for an entry without an `CareerTimeline`", async () => {
    readEntryDataModule.mockClear();

    await entryDataMarkdownFor(`
import { RECORD } from "./entry.data.ts";

A paragraph.
`);

    expect(readEntryDataModule).not.toHaveBeenCalled();
  });

  test("throws when an `CareerTimeline` is written inside a sentence, naming the component", async () => {
    await expect(
      entryDataMarkdownFor(`
import { RECORD } from "./entry.data.ts";

A sentence with <CareerTimeline {...RECORD} /> inside it.
`),
    ).rejects.toThrow("writes components inline whose fallback Markdown is a block: CareerTimeline");
  });

  test("throws when an `CareerTimeline` has an attribute beside its spread, naming the entry", async () => {
    await expect(
      entryDataMarkdownFor(`
import { RECORD } from "./entry.data.ts";

<CareerTimeline {...RECORD} asOf="2020-01" />
`),
    ).rejects.toThrow(
      `"${CONTENT_DIRECTORY_PATH}/collection/entry.mdx" renders \`CareerTimeline\` with attributes other than a single \`{...NAME}\` spread`,
    );
  });

  test("throws when the entry's data file cannot be imported, naming the entry and the data file", async () => {
    await expect(
      entryDataMarkdownFor(`
import { RECORD } from "./other-entry.data.ts";

<CareerTimeline {...RECORD} />
`),
    ).rejects.toThrow(
      `"${CONTENT_DIRECTORY_PATH}/collection/entry.mdx" renders \`CareerTimeline\` from its data file "${CONTENT_DIRECTORY_PATH}/collection/other-entry.data.ts", which cannot be imported`,
    );
  });

  test("throws when the entry's data file does not export the record, naming the data file and the export", async () => {
    await expect(
      entryDataMarkdownFor(`
import { MISSING_RECORD } from "./entry.data.ts";

<CareerTimeline {...MISSING_RECORD} />
`),
    ).rejects.toThrow(`"${CONTENT_DIRECTORY_PATH}/collection/entry.data.ts" does not export \`MISSING_RECORD\``);
  });

  test("throws when the exported record is not a valid experience record, naming the data file", async () => {
    await expect(
      entryDataMarkdownFor(`
import { INVALID_RECORD } from "./entry.data.ts";

<CareerTimeline {...INVALID_RECORD} />
`),
    ).rejects.toThrow(`"${CONTENT_DIRECTORY_PATH}/collection/entry.data.ts" is not a valid experience record`);
  });

  test("renders a `<pre>` as a fenced code block that preserves its line breaks", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
<pre><code>line one
line two</code></pre>
`);
    expect(markdown).toContain(`\`\`\`
line one
line two
\`\`\``);
  });

  test("renders a `<pre>` written across lines as a fenced code block", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
<pre>
  <code>
    line one
    line two
  </code>
</pre>
`);
    expect(markdown).toContain(`\`\`\`
line one
line two
\`\`\``);
  });

  test("renders a `<pre>` as a fenced code block in the language a `language-*` class on its `<code>` names", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
<pre><code className="highlighted language-ts">const value = 1;</code></pre>
`);
    expect(markdown).toContain(`\`\`\`ts
const value = 1;
\`\`\``);
  });

  test("preserves the blank line between two paragraphs of a `<pre>` written across lines", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
<pre>
  <code>
    line one

    line two
  </code>
</pre>
`);
    expect(markdown).toContain(`\`\`\`
line one

line two
\`\`\``);
  });

  test("renders the text of the literal expressions in a `<pre>` written on one line", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
<pre><code>if (value) {"{"} return; {"}"}</code></pre>
`);
    expect(markdown).toContain(`\`\`\`
if (value) { return; }
\`\`\``);
  });

  test("renders a literal expression written on a line of its own in a `<pre>` as a line of its text", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
<pre>
  <code>
    if (value) {"{"}
    {\`  return;\`}
    {"}"}
  </code>
</pre>
`);
    expect(markdown).toContain(`\`\`\`
if (value) {
  return;
}
\`\`\``);
  });

  test("renders a `<table>` as a GFM table whose header row is its `<thead>` row", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <table>
        <tbody>
          <tr>
            <td>First</td>
            <td>1</td>
          </tr>
        </tbody>
        <thead>
          <tr>
            <th>Column</th>
            <th>Value</th>
          </tr>
        </thead>
      </table>
    `);
    expect(markdown).toContain(`| Column | Value |
| ------ | ----- |
| First  | 1     |`);
  });

  test("renders a `<table>` without a `<thead>` as a GFM table whose header row is its first row", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <table>
        <tr>
          <td>Column</td>
          <td>Value</td>
        </tr>
        <tr>
          <td>First</td>
          <td>1</td>
        </tr>
      </table>
    `);
    expect(markdown).toContain(`| Column | Value |
| ------ | ----- |
| First  | 1     |`);
  });

  test("renders the rows of a `<tfoot>` after the rows of the `<tbody>` before it", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <table>
        <thead>
          <tr><th>Column</th></tr>
        </thead>
        <tfoot>
          <tr><td>Last</td></tr>
        </tfoot>
        <tbody>
          <tr><td>First</td></tr>
        </tbody>
      </table>
    `);
    expect(markdown).toContain(`| Column |
| ------ |
| First  |
| Last   |`);
  });

  test("renders links, emphasis, and inline code in a `<table>` cell as inline Markdown", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <table>
        <tr>
          <th>Column</th>
          <th>Value</th>
        </tr>
        <tr>
          <td>[A link](https://example.com)</td>
          <td>
            Some _emphasis_ and <code>code</code>.
          </td>
        </tr>
      </table>
    `);
    expect(markdown).toContain("| [A link](https://example.com) | Some _emphasis_ and `code`. |");
  });

  test("renders the text of a literal expression in a `<table>` cell", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <table>
        <tr>
          <th>Column</th>
        </tr>
        <tr>
          <td>{"<value>"}</td>
        </tr>
      </table>
    `);
    expect(markdown).toContain(String.raw`| \<value> |`);
  });

  test("renders a `<table>` cell whose paragraph is written across lines on the line of its row", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <table>
        <tr>
          <th>Column</th>
        </tr>
        <tr>
          <td>
            A paragraph written
            across lines,\\
            with a hard line break.
          </td>
        </tr>
      </table>
    `);
    expect(markdown).toContain("| A paragraph written across lines, with a hard line break. |");
  });

  test("escapes a `|` in a `<table>` cell", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <table>
        <tr>
          <th>Column</th>
        </tr>
        <tr>
          <td>A | B</td>
        </tr>
      </table>
    `);
    expect(markdown).toContain(String.raw`| A \| B |`);
  });

  test("renders the `<caption>` of a `<table>` as a paragraph before the table", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <table>
        <caption>A _caption_.</caption>
        <tr>
          <th>Column</th>
        </tr>
      </table>
    `);
    expect(markdown).toContain(`A _caption_.

| Column |
| ------ |`);
  });

  test("renders a `<table>` in a `<figure>` as a GFM table followed by the paragraph of its `<figcaption>`", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <figure>
        <table>
          <tr>
            <th>Column</th>
          </tr>
        </table>
        <figcaption>A caption.</figcaption>
      </figure>
    `);
    expect(markdown).toContain(`| Column |
| ------ |

A caption.`);
  });

  test("renders a `<table>` written on one line as a GFM table", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <table><tr><th>Column</th></tr><tr><td>First</td></tr></table>
    `);
    expect(markdown).toContain(`| Column |
| ------ |
| First  |`);
  });

  test.each([
    ["spans columns", `<td colSpan={2}>Spanning</td>`],
    ["spans rows", `<td rowSpan="2">Spanning</td>`],
  ])("renders a `<table>` with a cell that %s as a list of rows, each a list of cells", async (_label, cell) => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <table>
        <tr>
          <th>Column</th>
          <th>Value</th>
        </tr>
        <tr>
          ${cell}
        </tr>
      </table>
    `);
    expect(markdown).toContain(`- - Column
  - Value
- - Spanning`);
  });

  test("renders a `<table>` with a cell containing two paragraphs as a list of rows, each a list of cells, preserving the paragraphs", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <table>
        <tr>
          <th>Column</th>
        </tr>
        <tr>
          <td>
            A paragraph.

            Another paragraph.
          </td>
        </tr>
      </table>
    `);
    expect(markdown).toContain(`- - Column
- - A paragraph.

    Another paragraph.`);
  });

  test("renders a `<ul>` as a bulleted list with one item per `<li>`", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <ul>
        <li>First</li>
        <li>
          Second
        </li>
      </ul>
    `);
    expect(markdown).toContain(`- First
- Second`);
  });

  test("renders an `<ol>` written on one line as a numbered list with one item per `<li>`", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <ol><li>First</li><li>Second</li></ol>
    `);
    expect(markdown).toContain(`1. First
2. Second`);
  });

  test("renders a list nested in an `<li>` as a list inside its item", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <ul>
        <li>
          Outer

          <ol>
            <li>Inner</li>
          </ol>
        </li>
      </ul>
    `);
    expect(markdown).toContain(`- Outer
  1. Inner`);
  });

  test("renders a `<dl>` as a list with one item per term, each its term in bold followed by its description", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <dl>
        <dt>First term</dt>
        <dd>A description.</dd>
        <dt>Second term</dt>
        <dd>
          A description written
          across lines.
        </dd>
      </dl>
    `);
    expect(markdown).toContain(`- **First term**: A description.
- **Second term**: A description written
  across lines.`);
  });

  test("renders the terms of a `<dl>` that share a description in one item, followed by each block of the description", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      <dl>
        <dt>First term</dt>
        <dt>Second term</dt>
        <dd>
          A paragraph.

          Another paragraph.
        </dd>
      </dl>
    `);
    expect(markdown).toContain(`- **First term**, **Second term**: A paragraph.

  Another paragraph.`);
  });

  test("preserves a pipe table as a GFM table", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
| Column | Value |
| - | - |
| A \\| B | _1_ |
`);
    expect(markdown).toContain(String.raw`| Column | Value |
| ------ | ----- |
| A \| B | _1_   |`);
  });

  test("preserves the column alignment of a pipe table", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
| Start | Center | End |
| :- | :-: | -: |
| 1 | 2 | 3 |
`);
    expect(markdown).toContain(`| Start | Center | End |
| :---- | :----: | --: |
| 1     |    2   |   3 |`);
  });

  test.each([
    ["a URL", "https://example.com/path", "[https://example.com/path](https://example.com/path)"],
    ["a `www.` domain", "www.example.com", "[www.example.com](http://www.example.com)"],
    ["an email address", "someone@example.com", "[someone@example.com](mailto:someone@example.com)"],
  ])("renders %s in prose as a link", async (_label, literal, link) => {
    const markdown = await markdownFor(`${FRONTMATTER}
See ${literal} for more.
`);
    expect(markdown).toContain(`See ${link} for more.`);
  });

  test("preserves text between double tildes as strikethrough", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
A ~~removed~~ word.
`);
    expect(markdown).toContain("A ~~removed~~ word.");
  });

  test("escapes each single tilde in prose", async () => {
    // GitHub parses text between single tildes as strikethrough, which the site does not.
    const markdown = await markdownFor(`${FRONTMATTER}
From ~1 to ~2, or ~one~.
`);
    expect(markdown).toContain(String.raw`From \~1 to \~2, or \~one\~.`);
  });

  test("preserves footnote syntax as escaped prose", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
A sentence.[^1]

[^1]: A note.
`);
    expect(markdown).toContain(String.raw`A sentence.\[^1]

\[^1]: A note.`);
  });

  test("preserves task list syntax as a list whose items begin with escaped brackets", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
- [ ] Open
- [x] Done
`);
    expect(markdown).toContain(String.raw`- \[ ] Open
- \[x] Done`);
  });

  test.each([
    [
      "written on one line",
      `<figure>
        <blockquote>A quotation.</blockquote>
        <figcaption>A caption.</figcaption>
      </figure>`,
    ],
    [
      "written across lines",
      `<figure>
        <blockquote>
          A quotation.
        </blockquote>

        <figcaption>A caption.</figcaption>
      </figure>`,
    ],
  ])(
    "renders a `<blockquote>` %s in a `<figure>` as a block quote followed by the paragraph of its `<figcaption>`",
    async (_label, figure) => {
      const markdown = await markdownFor(`${FRONTMATTER}
      ${figure}
    `);
      expect(markdown).toContain(`> A quotation.

A caption.`);
    },
  );

  test("splits a paragraph at a `<blockquote>` written inside a sentence", async () => {
    const markdown = await markdownFor(`${FRONTMATTER}
      Before <blockquote>A quotation.</blockquote> after.
    `);
    expect(markdown).toContain(`Before

> A quotation.

after.`);
  });

  test("resolves a Markdown image to the absolute URL of the file the site serves", async () => {
    const source = `${FRONTMATTER}
      ![An image](./image.png)
    `;
    const markdown = await markdownWithMediaFor(source, { path: ENTRY_ABSOLUTE_PATH });
    expect(markdown).toContain(`![An image](${SITE_URL}${IMAGE.src})`);
  });

  test("resolves an image reference's definition to the absolute URL of the file the site serves", async () => {
    const source = `${FRONTMATTER}
      ![An image][definition]

      [definition]: ./image.png
    `;
    const markdown = await markdownWithMediaFor(source, { path: ENTRY_ABSOLUTE_PATH });

    expect(markdown).toContain("![An image][definition]");
    expect(markdown).toContain(`[definition]: ${SITE_URL}${IMAGE.src}`);
  });

  test("preserves the destination of a definition used only by a link", async () => {
    const source = `${FRONTMATTER}
      [The notes][n]

      [n]: ./notes.md
    `;
    const markdown = await markdownWithMediaFor(source, { path: ENTRY_ABSOLUTE_PATH });
    expect(markdown).toContain("[n]: ./notes.md");
  });

  test("renders the `<img>` of a `<picture>` as a Markdown image with the absolute URL of the file the site serves", async () => {
    const source = `${FRONTMATTER}
      <picture>
        <source srcSet="./image.png" type="image/avif" />
        <img src="./image.png" alt="An image" />
      </picture>
    `;
    const markdown = await markdownWithMediaFor(source, { path: ENTRY_ABSOLUTE_PATH });
    expect(markdown).toContain(`![An image](${SITE_URL}${IMAGE.src})`);
  });

  test("preserves the blank lines around an `<img>` written as a block", async () => {
    const source = `${FRONTMATTER}
      Before.

      <img src="./image.png" alt="An image" />

      After.
    `;
    const markdown = await markdownWithMediaFor(source, { path: ENTRY_ABSOLUTE_PATH });
    expect(markdown).toContain(`Before.\n\n![An image](${SITE_URL}${IMAGE.src})\n\nAfter.`);
  });

  test("preserves a Markdown image whose destination is not a file the site serves", async () => {
    const source = `${FRONTMATTER}
      ![An image](./nonexistent-image.png)
    `;
    const markdown = await markdownWithMediaFor(source, { path: ENTRY_ABSOLUTE_PATH });
    expect(markdown).toContain("![An image](./nonexistent-image.png)");
  });

  test("preserves a Markdown image whose destination references a video", async () => {
    const source = `${FRONTMATTER}
      ![A video](./video.mp4)
    `;
    const markdown = await markdownWithMediaFor(source, { path: ENTRY_ABSOLUTE_PATH });
    expect(markdown).toContain("![A video](./video.mp4)");
  });

  test("preserves a Markdown image whose destination is an external URL", async () => {
    const source = `${FRONTMATTER}
      ![An image](https://example.com/image.png)
    `;
    const markdown = await markdownWithMediaFor(source, { path: ENTRY_ABSOLUTE_PATH });
    expect(markdown).toContain("![An image](https://example.com/image.png)");
  });

  test("renders a `<video>` as a link to the file the site serves, with its poster image as the link content", async () => {
    const source = `${FRONTMATTER}
      <video src="./video.mp4" controls />
    `;
    const markdown = await markdownWithMediaFor(source, { path: ENTRY_ABSOLUTE_PATH });
    expect(markdown).toContain(`[![](${SITE_URL}${VIDEO.posterImage.src})](${SITE_URL}${VIDEO.src})`);
  });

  test("renders a `<video>` with its `aria-label` attribute as the alternative text of its poster image", async () => {
    const source = `${FRONTMATTER}
      <video src="./video.mp4" aria-label="A video" />
    `;
    const markdown = await markdownWithMediaFor(source, { path: ENTRY_ABSOLUTE_PATH });
    expect(markdown).toContain(`![A video](${SITE_URL}${VIDEO.posterImage.src})`);
  });

  test("renders a `<video>` with a `<source>` child the same as one with a `src` attribute", async () => {
    const source = `${FRONTMATTER}
      <video controls>
        <source src="./video.mp4" type="video/mp4" />
      </video>
    `;
    const markdown = await markdownWithMediaFor(source, { path: ENTRY_ABSOLUTE_PATH });
    expect(markdown).toContain(`[![](${SITE_URL}${VIDEO.posterImage.src})](${SITE_URL}${VIDEO.src})`);
  });
});
