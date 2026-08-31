import { readFile } from "node:fs/promises";

import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

import { COLLECTIONS } from "#/config/content.ts";
import { parseFrontmatter } from "#/content/schema.ts";
import { markdownPath } from "#/metadata.ts";

import { byNewestFirst, publishedEntries, scanContent } from "./prerender/routes.ts";

import type { ScannedContent, ScannedEntry } from "./prerender/routes.ts";
import type { Plugin } from "vite";

interface MarkdownNode {
  type: string;
  name?: string | null;
  children?: Array<MarkdownNode>;
}

/** A markdown file to serve, keyed by the path it is served from. */
export interface MarkdownFile {
  path: string;
  render: () => Promise<string>;
}

// Replacements for components embedded in the content, keyed by element name.
//
// A component with no entry is replaced by its children. That preserves wrapper components but
// drops self-closing components whose meaning is carried by their attributes.
const COMPONENT_MARKDOWN: Record<string, (node: MarkdownNode) => Array<MarkdownNode>> = {};

// Nodes that exist only to serve the compiled component: imports, exports, and `{expressions}`.
const DISCARDED_NODES = new Set(["mdxjsEsm", "mdxFlowExpression", "mdxTextExpression"]);
const JSX_NODES = new Set(["mdxJsxFlowElement", "mdxJsxTextElement"]);
const MDX_NODES = new Set([...DISCARDED_NODES, ...JSX_NODES]);

// Returns the replacement nodes for a node. A plain node is returned unchanged.
function replacementsFor(node: MarkdownNode): Array<MarkdownNode> {
  if (DISCARDED_NODES.has(node.type)) {
    return [];
  }

  if (JSX_NODES.has(node.type)) {
    const replace = node.name ? COMPONENT_MARKDOWN[node.name] : undefined;
    return replace ? replace(node) : (node.children ?? []);
  }

  return [node];
}

// Replaces MDX nodes with plain Markdown nodes that `remark-stringify` can serialize.
function stripMdx() {
  return function transform(tree: MarkdownNode) {
    if (!tree.children) {
      return;
    }

    // Children are stripped before the node holding them, so a component promoted in place of its
    // parent has already been replaced. Stripping downwards would leave nested MDX behind.
    tree.children.forEach(transform);
    tree.children = tree.children.flatMap(replacementsFor);
  };
}

function mdxNodesIn(node: MarkdownNode, found = new Set<string>()): Set<string> {
  if (MDX_NODES.has(node.type)) {
    found.add(node.name ?? node.type);
  }

  node.children?.forEach((child) => mdxNodesIn(child, found));

  return found;
}

// Ensures the Markdown tree contains no MDX nodes. Any MDX that survives `stripMdx`
// would be serialized as JSX and appear verbatim in the Markdown.
function assertMarkdownOnly() {
  return function assert(tree: MarkdownNode, file: { path?: string | undefined }) {
    const remaining = mdxNodesIn(tree);

    if (remaining.size > 0) {
      throw new Error(
        `"${file.path ?? "Markdown"}" still holds MDX that cannot be written as Markdown: ${[...remaining].join(", ")}.`,
      );
    }
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter) // Keeps the frontmatter block which carries the title, description, and date.
  .use(remarkMdx)
  .use(stripMdx)
  .use(assertMarkdownOnly)
  .use(remarkStringify, { bullet: "-", listItemIndent: "one", rule: "-", fences: true, strong: "*", emphasis: "_" });

/** Converts MDX source to the Markdown representation of a page. */
export async function markdownOf(source: string, path?: string): Promise<string> {
  return String(await processor.process({ value: source, path }));
}

async function entryMarkdown(entry: ScannedEntry): Promise<string> {
  // Validate the frontmatter even though it is emitted unchanged. A malformed block
  // should fail the build here rather than be included in the Markdown file.
  parseFrontmatter(entry.frontmatter, entry.path);
  return markdownOf(await readFile(entry.path, "utf8"), entry.path);
}

const asLinkText = (value: string) => value.replace(/[\\[\]]/g, (character) => `\\${character}`); // Escapes the characters that would otherwise end a link's text or its destination early.
const asOneLine = (value: string) => value.replace(/\s+/g, " ").trim(); // Collapses a description onto the single line its list item occupies.

// A collection's entries as a Markdown index, linking each entry's Markdown.
// A collection has no document of its own, so the index is its alternate representation.
function collectionMarkdown(name: string, entries: Array<ScannedEntry>): string {
  const declaredCollections: Record<string, { title: string; description: string } | undefined> = COLLECTIONS; // Widened because `name` may be a directory that is not a declared collection.
  const metadata = declaredCollections[name];

  if (!metadata) {
    throw new Error(`Collection "${name}" is missing a title for its markdown index.`);
  }

  const items = [...entries].sort(byNewestFirst).map((entry) => {
    const { title, description, date } = parseFrontmatter(entry.frontmatter, entry.path);
    return `- [${asLinkText(title)}](${markdownPath(`/${name}/${entry.slug}`)}) (${date})\n  ${asOneLine(description)}`;
  });
  const sections = [`# ${metadata.title}`, metadata.description, ...(items.length > 0 ? [items.join("\n")] : [])];

  return `${sections.join("\n\n")}\n`;
}

/**
 * Returns Markdown files for entries and collection indexes.
 *
 * When `drafts` is true, draft entries are included (for development purposes).
 * A production build excludes both draft pages and their Markdown.
 */
export function markdownFilesFor(
  { collections, pages }: ScannedContent,
  { drafts = false }: { drafts?: boolean } = {},
): Array<MarkdownFile> {
  const served = (entries: Array<ScannedEntry>) => (drafts ? entries : publishedEntries(entries));

  return [
    ...served(pages.entries).map((entry) => ({
      path: markdownPath(`/${entry.slug}`),
      render: () => entryMarkdown(entry),
    })),
    ...collections.flatMap(({ name, entries }) => {
      const listed = served(entries);
      return [
        {
          path: markdownPath(`/${name}`),
          // eslint-disable-next-line @typescript-eslint/require-await -- Asynchronous so an invalid entry rejects the render rather than throwing at the caller.
          render: async () => collectionMarkdown(name, listed),
        },
        ...listed.map((entry) => ({
          path: markdownPath(`/${name}/${entry.slug}`),
          render: () => entryMarkdown(entry),
        })),
      ];
    }),
  ];
}

/** Emits a Markdown alternate file every route. */
export function markdownPlugin(): Plugin {
  return {
    name: "kuzmano.ski:markdown",
    applyToEnvironment: (environment) => environment.name === "client",
    async generateBundle() {
      for (const { path, render } of markdownFilesFor(scanContent())) {
        this.emitFile({ type: "asset", fileName: path.slice(1), source: await render() });
      }
    },
    configureServer(server) {
      // Rescanned per request so an edit to a content file shows up without a restart.
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split("?")[0];

        if (!path?.endsWith(".md")) {
          next();
          return;
        }

        const file = markdownFilesFor(scanContent(), { drafts: true }).find((candidate) => candidate.path === path);

        if (!file) {
          next();
          return;
        }

        file
          .render()
          .then((markdown) => {
            response.setHeader("content-type", "text/markdown; charset=utf-8");
            response.end(markdown);
          })
          .catch(next);
      });
    },
  };
}
