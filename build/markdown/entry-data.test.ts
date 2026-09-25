import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { createServer } from "vite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { PAGES_DIRECTORY_NAME } from "#/config/content.ts";

import { CONTENT_DIRECTORY_PATH, fromContent, fromRoot } from "../paths.ts";

import { entryDataModuleReaderThrough, readEntryDataExports, readEntryDataModule } from "./entry-data.ts";

import type { EntryDataModule } from "./entry-data.ts";
import type { ContentNode } from "../content/markup/tree.ts";
import type { ViteDevServer } from "vite";

const ENTRY_ABSOLUTE_PATH = fromContent("collection/entry.mdx");
const QUOTED_ENTRY_PATH = `"${CONTENT_DIRECTORY_PATH}/collection/entry.mdx"`;
const QUOTED_DATA_FILE_PATH = `"${CONTENT_DIRECTORY_PATH}/collection/entry.data.ts"`;

const ENTRY_DATA_MODULES: Record<string, EntryDataModule> = {
  [fromContent("collection/entry.data.ts")]: {
    RECORD: "record",
    OTHER_RECORD: "other record",
    default: "default record",
  },
  [fromContent("shared/records.ts")]: { RECORD: "shared record" },
};

// Returns the fake module for each path in `ENTRY_DATA_MODULES`, and rejects for any other path, as a
// missing file does.
const readFakeEntryDataModule = vi.fn((absolutePath: string) => {
  const entryDataModule = ENTRY_DATA_MODULES[absolutePath];
  return entryDataModule ? Promise.resolve(entryDataModule) : Promise.reject(new Error("The file does not exist."));
});

const treeOf = (source: string) => unified().use(remarkParse).use(remarkMdx).parse(source) as ContentNode; // `ContentNode` flattens mdast into optional fields, so the parsed root is cast to it.

function componentElementsIn(tree: ContentNode): Array<ContentNode> {
  const elements: Array<ContentNode> = [];

  visit(tree, (node: ContentNode) => {
    if (node.name === "Component") {
      elements.push(node);
    }
  });

  return elements;
}

const entryDataExportsOf = (source: string, entryAbsolutePath = ENTRY_ABSOLUTE_PATH) => {
  const tree = treeOf(source);
  return readEntryDataExports(tree, componentElementsIn(tree), { path: entryAbsolutePath }, readFakeEntryDataModule);
};
const exportedValuesOf = async (source: string) =>
  [...(await entryDataExportsOf(source)).values()].map(({ value }) => value);

// Created inside the repository, so a module resolves `#/` imports against its `package.json`. The `.tmp` suffix
// is gitignored, and the directory is not under `node_modules`, which the dev server does not watch.
const temporaryModuleDirectory = async () => {
  const directoryAbsolutePath = fromRoot(`entry-data-module-${randomUUID()}.tmp`);

  await mkdir(directoryAbsolutePath);

  return directoryAbsolutePath;
};

describe("readEntryDataExports", () => {
  test("returns the export of the data file that the import an element's spread names", async () => {
    await expect(
      exportedValuesOf(`import { RECORD } from "./entry.data.ts";

<Component {...RECORD} />
`),
    ).resolves.toEqual(["record"]);
  });

  test("returns the export for a spread padded with spaces inside its braces", async () => {
    await expect(
      exportedValuesOf(`import { RECORD } from "./entry.data.ts";

<Component { ...RECORD } />
`),
    ).resolves.toEqual(["record"]);
  });

  test("returns the export an aliased import names, rather than the export named by its alias", async () => {
    await expect(
      exportedValuesOf(`import { OTHER_RECORD as RECORD } from "./entry.data.ts";

<Component {...RECORD} />
`),
    ).resolves.toEqual(["other record"]);
  });

  test("returns the default export for a default import", async () => {
    await expect(
      exportedValuesOf(`import RECORD from "./entry.data.ts";

<Component {...RECORD} />
`),
    ).resolves.toEqual(["default record"]);
  });

  test("returns the export of the file the entry imports it from, resolved against the entry's directory", async () => {
    await expect(
      exportedValuesOf(`import { RECORD } from "../shared/records.ts";

<Component {...RECORD} />
`),
    ).resolves.toEqual(["shared record"]);
  });

  test("returns the export each element's spread names, importing each data file once", async () => {
    readFakeEntryDataModule.mockClear();

    await expect(
      exportedValuesOf(`import { RECORD, OTHER_RECORD } from "./entry.data.ts";

<Component {...RECORD} />

<Component {...OTHER_RECORD} />
`),
    ).resolves.toEqual(["record", "other record"]);
    expect(readFakeEntryDataModule).toHaveBeenCalledTimes(1);
  });

  test("returns the data file's quoted path with each export", async () => {
    const entryDataExports = await entryDataExportsOf(`import { RECORD } from "./entry.data.ts";

<Component {...RECORD} />
`);

    expect([...entryDataExports.values()]).toEqual([{ value: "record", quotedDataFilePath: QUOTED_DATA_FILE_PATH }]);
  });

  test("does not import the data file when called without elements", async () => {
    readFakeEntryDataModule.mockClear();

    await expect(
      exportedValuesOf(`import { RECORD } from "./entry.data.ts";

A paragraph.
`),
    ).resolves.toEqual([]);
    expect(readFakeEntryDataModule).not.toHaveBeenCalled();
  });

  test.each([
    ["spreads a member expression", "{...RECORD.value}"],
    ["spreads two records", "{...RECORD} {...OTHER_RECORD}"],
    ["is given its record as a prop", "record={RECORD}"],
    ["has an attribute beside its spread", '{...RECORD} asOf="2020-01"'],
  ])("throws when an element %s, naming the entry", async (_label, attributes) => {
    await expect(
      exportedValuesOf(`import { RECORD, OTHER_RECORD } from "./entry.data.ts";

<Component ${attributes} />
`),
    ).rejects.toThrow(
      `${QUOTED_ENTRY_PATH} renders \`Component\` with attributes other than a single \`{...NAME}\` spread`,
    );
  });

  test.each([
    ["is not imported", `export const RECORD = {};`],
    ["is bound by a namespace import", `import * as RECORD from "./entry.data.ts";`],
  ])("throws when the name an element spreads %s, naming the entry and the name", async (_label, statement) => {
    await expect(
      exportedValuesOf(`${statement}

<Component {...RECORD} />
`),
    ).rejects.toThrow(`${QUOTED_ENTRY_PATH} spreads \`RECORD\` into \`Component\`, but does not import \`RECORD\``);
  });

  test("throws when the name an element spreads is imported by a path that is not relative to the entry, naming the entry and the path", async () => {
    await expect(
      exportedValuesOf(`import { RECORD } from "#/records.ts";

<Component {...RECORD} />
`),
    ).rejects.toThrow(
      `${QUOTED_ENTRY_PATH} imports \`RECORD\` from "#/records.ts", which is not a path relative to the entry`,
    );
  });

  test("throws when the data file cannot be imported, naming the entry and the data file", async () => {
    await expect(
      exportedValuesOf(`import { RECORD } from "./missing.data.ts";

<Component {...RECORD} />
`),
    ).rejects.toThrow(
      `${QUOTED_ENTRY_PATH} renders \`Component\` from its data file "${CONTENT_DIRECTORY_PATH}/collection/missing.data.ts", which cannot be imported`,
    );
  });

  test("throws when the data file does not export the name an import names, naming the data file and the export", async () => {
    await expect(
      exportedValuesOf(`import { MISSING_RECORD as RECORD } from "./entry.data.ts";

<Component {...RECORD} />
`),
    ).rejects.toThrow(`${QUOTED_DATA_FILE_PATH} does not export \`MISSING_RECORD\``);
  });

  test("throws when called without a reader for an entry with an element, naming the entry", async () => {
    const tree = treeOf(`import { RECORD } from "./entry.data.ts";

<Component {...RECORD} />
`);
    const pendingExports = readEntryDataExports(
      tree,
      componentElementsIn(tree),
      { path: ENTRY_ABSOLUTE_PATH },
      undefined,
    );

    await expect(pendingExports).rejects.toThrow(`${QUOTED_ENTRY_PATH} renders \`Component\``);
  });
});

describe("readEntryDataModule", () => {
  let directoryAbsolutePath: string;
  let moduleAbsolutePath: string;

  const writeModule = (source: string) => writeFile(moduleAbsolutePath, source);

  beforeEach(async () => {
    directoryAbsolutePath = await temporaryModuleDirectory();
    moduleAbsolutePath = join(directoryAbsolutePath, "entry.data.ts");
  });

  afterEach(() => rm(directoryAbsolutePath, { recursive: true, force: true }));

  test("returns the exports of the module as it is on disk after an edit", async () => {
    await writeModule(`export const RECORD: string = "first";\n`);

    await expect(readEntryDataModule(moduleAbsolutePath)).resolves.toMatchObject({ RECORD: "first" });

    await writeModule(`export const RECORD: string = "second";\n`);

    await expect(readEntryDataModule(moduleAbsolutePath)).resolves.toMatchObject({ RECORD: "second" });
  });

  test("returns the exports of a module that uses an `enum` and imports a value through `#/`", async () => {
    await writeModule(`
      import { PAGES_DIRECTORY_NAME } from "#/config/content.ts";

      enum Kind {
        First = "first",
      }

      export const RECORD = { kind: Kind.First, directory: PAGES_DIRECTORY_NAME };
    `);
    await expect(readEntryDataModule(moduleAbsolutePath)).resolves.toMatchObject({
      RECORD: { kind: "first", directory: PAGES_DIRECTORY_NAME },
    });
  });
});

describe("entryDataModuleReaderThrough", () => {
  let directoryAbsolutePath: string;
  let moduleAbsolutePath: string;
  let server: ViteDevServer;

  beforeEach(async () => {
    directoryAbsolutePath = await temporaryModuleDirectory();
    moduleAbsolutePath = join(directoryAbsolutePath, "entry.data.ts");
    server = await createServer({
      root: directoryAbsolutePath,
      configFile: false,
      logLevel: "silent",
      server: { middlewareMode: true, ws: false },
    });
  });

  afterEach(async () => {
    await server.close();
    await rm(directoryAbsolutePath, { recursive: true, force: true });
  });

  test("returns the module it evaluated until the file changes, then the module as it is on disk", async () => {
    const readEntryDataModuleInDev = entryDataModuleReaderThrough(server);

    await writeFile(moduleAbsolutePath, `export const RECORD: string = "first";\n`);

    const firstModule = await readEntryDataModuleInDev(moduleAbsolutePath);

    expect(firstModule).toMatchObject({ RECORD: "first" });
    expect(await readEntryDataModuleInDev(moduleAbsolutePath)).toBe(firstModule);

    await writeFile(moduleAbsolutePath, `export const RECORD: string = "second";\n`);

    await vi.waitFor(async () => {
      expect(await readEntryDataModuleInDev(moduleAbsolutePath)).toMatchObject({ RECORD: "second" });
    });

    const secondModule = await readEntryDataModuleInDev(moduleAbsolutePath);

    expect(await readEntryDataModuleInDev(moduleAbsolutePath)).toBe(secondModule);
  });
});
