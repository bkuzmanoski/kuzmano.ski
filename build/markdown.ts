import { readFile } from "node:fs/promises";

import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

import { COLLECTIONS } from "#/config/content.ts";
import { parseFrontmatter } from "#/content/schema.ts";

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

    tree.children = tree.children.flatMap(replacementsFor);
    tree.children.forEach(transform);
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter) // Keeps the block, which already carries the title, description and date.
  .use(remarkMdx)
  .use(stripMdx)
  .use(remarkStringify, { bullet: "-", listItemIndent: "one", rule: "-", fences: true, strong: "*", emphasis: "_" });

/** Converts MDX source to the Markdown representation of a page. */
export async function markdownOf(source: string): Promise<string> {
  return String(await processor.process(source));
}

const entryMarkdown = async (path: string) => markdownOf(await readFile(path, "utf8"));

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
    return `- [${title}](/${name}/${entry.slug}.md) (${date})\n  ${description}`;
  });
  const sections = [`# ${metadata.title}`, metadata.description, ...(items.length > 0 ? [items.join("\n")] : [])];

  return `${sections.join("\n\n")}\n`;
}

/** Markdown files for published entries and collection indexes. */
export function markdownFilesFor({ collections, pages }: ScannedContent): Array<MarkdownFile> {
  return [
    ...publishedEntries(pages.entries).map(({ slug, path }) => ({
      path: `/${slug}.md`,
      render: () => entryMarkdown(path),
    })),
    ...collections.flatMap(({ name, entries }) => {
      const published = publishedEntries(entries);
      return [
        { path: `/${name}.md`, render: () => Promise.resolve(collectionMarkdown(name, published)) },
        ...published.map(({ slug, path }) => ({
          path: `/${name}/${slug}.md`,
          render: () => entryMarkdown(path),
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

        const file = markdownFilesFor(scanContent()).find((candidate) => candidate.path === path);

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
