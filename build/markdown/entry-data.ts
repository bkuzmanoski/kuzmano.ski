import { dirname, resolve } from "node:path";

import { visit } from "unist-util-visit";
import { isRunnableDevEnvironment, runnerImport } from "vite";

import { estreeOf } from "../content/markup/tree.ts";
import { SERVER_ENVIRONMENT } from "../environments.ts";
import { fromRoot, toRootRelative } from "../paths.ts";

import { quotedEntryPathOf } from "./nodes.ts";

import type { ContentNode, EntryVFile, EstreeNode } from "../content/markup/tree.ts";
import type { ViteDevServer } from "vite";

// A component rendered from entry data is given its record as `{...NAME}`, where `NAME` is imported
// from the entry's data file. The Markdown pass reads the export that import names from the same file,
// so it writes the record the page renders.

/** The exports of an entry data module, keyed by export name. */
export type EntryDataModule = Record<string, unknown>;

/** Imports the entry data module at an absolute path. */
export type EntryDataModuleReader = (absolutePath: string) => Promise<EntryDataModule>;

/** The module specifier a name is imported from, and the name the module exports it as. */
interface EntryImport {
  source: string;
  exportName: string;
}

const importedNameOf = (specifier: EstreeNode): string | null => {
  if (specifier.type === "ImportDefaultSpecifier") {
    return "default";
  }

  if (specifier.type !== "ImportSpecifier") {
    return null;
  }

  const { imported } = specifier;

  return imported?.type === "Literal" && typeof imported.value === "string" ? imported.value : (imported?.name ?? null);
};

function entryImportsIn(tree: ContentNode): Map<string, EntryImport> {
  const entryImports = new Map<string, EntryImport>();

  visit(tree, "mdxjsEsm", (node: ContentNode) => {
    for (const statement of estreeOf(node)?.body ?? []) {
      const source = statement.source?.value;

      if (statement.type !== "ImportDeclaration" || typeof source !== "string") {
        continue;
      }

      for (const specifier of statement.specifiers ?? []) {
        const localName = specifier.local?.name;
        const exportName = importedNameOf(specifier);

        if (localName && exportName) {
          entryImports.set(localName, { source, exportName });
        }
      }
    }
  });

  return entryImports;
}

// The identifier an element spreads into its props as `{...NAME}`.
//
// Throws, naming the entry, when the element spreads anything but one identifier or has any other
// attribute.
function spreadIdentifierOf(element: ContentNode, file: EntryVFile): string {
  const [attribute, ...otherAttributes] = element.attributes ?? [];
  const properties =
    attribute?.type === "mdxJsxExpressionAttribute"
      ? (estreeOf(attribute)?.body?.[0]?.expression?.properties ?? [])
      : [];
  const [property, ...otherProperties] = properties;
  const identifier =
    property?.type === "SpreadElement" && property.argument?.type === "Identifier" ? property.argument.name : undefined;

  if (!identifier || otherAttributes.length > 0 || otherProperties.length > 0) {
    throw new Error(
      `${quotedEntryPathOf(file)} renders \`${element.name}\` with attributes other than a single \`{...NAME}\` spread of an import from its data file.`,
    );
  }

  return identifier;
}

/** The value of an entry data file's export, and the file's quoted path for a problem message. */
export interface EntryDataExport {
  value: unknown;
  quotedDataFilePath: string;
}

/**
 * Reads the export each element in `elements` is rendered from, keyed by element: the element's
 * `{...NAME}` spread names an import of the entry in `tree`, and the export that import names is read
 * from the data file it imports, resolved against the entry's path. Imports each data file once, and
 * only when `elements` is not empty.
 *
 * Throws, naming the entry, when an element has attributes other than that spread, the entry does not
 * import `NAME` by a path relative to itself, or the data file cannot be imported, and naming the data
 * file when it does not export the name the import names.
 */
export async function readEntryDataExports(
  tree: ContentNode,
  elements: Array<ContentNode>,
  file: EntryVFile,
  entryDataModuleReader: EntryDataModuleReader | undefined,
): Promise<Map<ContentNode, EntryDataExport>> {
  const entryDataExports = new Map<ContentNode, EntryDataExport>();
  const [firstElement] = elements;

  if (!firstElement) {
    return entryDataExports;
  }

  const identifiers = new Map(elements.map((element) => [element, spreadIdentifierOf(element, file)]));
  const entryPath = file.path;

  if (!entryPath || !entryDataModuleReader) {
    throw new Error(
      `${quotedEntryPathOf(file)} renders \`${firstElement.name}\`, whose record requires the entry's path and a reader for its data file.`,
    );
  }

  const entryImports = entryImportsIn(tree);
  const dataModulesByAbsolutePath = new Map<string, Promise<EntryDataModule>>();

  const readDataModule = (element: ContentNode, dataFileAbsolutePath: string, quotedDataFilePath: string) => {
    const pendingDataModule =
      dataModulesByAbsolutePath.get(dataFileAbsolutePath) ??
      entryDataModuleReader(dataFileAbsolutePath).catch((cause: unknown) => {
        throw new Error(
          `${quotedEntryPathOf(file)} renders \`${element.name}\` from its data file ${quotedDataFilePath}, which cannot be imported: ${(cause as Error).message}`,
          { cause },
        );
      });

    dataModulesByAbsolutePath.set(dataFileAbsolutePath, pendingDataModule);
    return pendingDataModule;
  };

  for (const [element, identifier] of identifiers) {
    const entryImport = entryImports.get(identifier);

    if (!entryImport) {
      throw new Error(
        `${quotedEntryPathOf(file)} spreads \`${identifier}\` into \`${element.name}\`, but does not import \`${identifier}\` from a data file.`,
      );
    }

    if (!entryImport.source.startsWith("./") && !entryImport.source.startsWith("../")) {
      throw new Error(
        `${quotedEntryPathOf(file)} imports \`${identifier}\` from "${entryImport.source}", which is not a path relative to the entry.`,
      );
    }

    const dataFileAbsolutePath = resolve(dirname(entryPath), entryImport.source);
    const quotedDataFilePath = `"${toRootRelative(dataFileAbsolutePath)}"`;
    const exportedValue = (await readDataModule(element, dataFileAbsolutePath, quotedDataFilePath))[
      entryImport.exportName
    ];

    if (exportedValue === undefined) {
      throw new Error(
        `${quotedDataFilePath} does not export \`${entryImport.exportName}\`, which ${quotedEntryPathOf(file)} spreads into \`${element.name}\`.`,
      );
    }

    entryDataExports.set(element, { value: exportedValue, quotedDataFilePath });
  }

  return entryDataExports;
}

/**
 * Imports an entry data module.
 *
 * `runnerImport` transforms and evaluates the module in a module runner of its own and closes the
 * runner before it returns, so each call reads the file again and no earlier version remains loaded.
 */
export async function readEntryDataModule(absolutePath: string): Promise<EntryDataModule> {
  const { module } = await runnerImport<EntryDataModule>(absolutePath, { root: fromRoot(".") });
  return module;
}

/**
 * Returns a reader that imports an entry data module through the dev server's SSR module runner.
 *
 * The runner evaluates a module once and caches it until Vite invalidates it on an edit, so a Markdown
 * request re-evaluates the module only after it changes, rather than creating a runner of its own as
 * `readEntryDataModule` does. Falls back to `readEntryDataModule` when the SSR environment does not run
 * in this process.
 */
export function entryDataModuleReaderThrough(server: ViteDevServer): EntryDataModuleReader {
  return (absolutePath) => {
    const environment = server.environments[SERVER_ENVIRONMENT];
    return isRunnableDevEnvironment(environment)
      ? environment.runner.import<EntryDataModule>(absolutePath)
      : readEntryDataModule(absolutePath);
  };
}
