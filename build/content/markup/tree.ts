/**
 * A node in the MDX, Markdown, or HTML syntax tree the content pipeline walks.
 *
 * The media references and the Markdown representation walk three vocabularies — mdast (`image`,
 * `definition`, `imageReference`, `text`), hast (`element`), and mdx-jsx (`mdxJsxFlowElement`,
 * `mdxJsxTextElement`). This flattens all of them into one optional-field shape rather than composing
 * `@types/mdast` and `@types/hast` to avoid a narrowing step in every callback before it could read
 * `url`, `properties`, or `attributes`.
 *
 * `value` and `children` are never both present.
 */
export interface ContentNode {
  type: string;
  tagName?: string;
  name?: string | null;
  value?: string;
  url?: string;
  identifier?: string; // Markdown label used by `definition` and `imageReference` nodes.
  alt?: string | null;
  title?: string | null;
  properties?: Record<string, unknown>;
  attributes?: Array<{ type?: string; name?: string | null; value?: unknown }>;
  children?: Array<ContentNode>;
}

/** A tree root with required children, enabling `unist-util-visit` transforms to replace nodes. */
export interface ContentParent extends ContentNode {
  children: Array<ContentNode>;
}

/** VFile data used by entry transforms. */
export interface EntryVFile {
  path?: string | undefined;
}

/** `remark-mdx` node types for authored JSX. */
export const JSX_ELEMENT_NODE_TYPES = new Set(["mdxJsxFlowElement", "mdxJsxTextElement"]);

export const isJsxElement = (node: ContentNode) => JSX_ELEMENT_NODE_TYPES.has(node.type);

/** Returns an element name from MDX JSX or hast. */
export const elementNameOf = (node: ContentNode | undefined) => node?.tagName ?? node?.name ?? null;

/** Whether an element has an attribute, including JSX expressions. */
export function hasAttribute(node: ContentNode, name: string): boolean {
  if (node.attributes) {
    return node.attributes.some((attribute) => attribute.name === name);
  }

  return node.properties !== undefined && name in node.properties;
}

/** Whether a JSX element spreads an expression into its attributes, which can set any attribute at runtime. */
export const hasSpreadAttribute = (node: ContentNode) =>
  node.attributes?.some(({ type }) => type === "mdxJsxExpressionAttribute") ?? false;

export function stringAttributeOf(node: ContentNode, name: string): string | null {
  const value = node.attributes
    ? node.attributes.find((attribute) => attribute.name === name)?.value
    : node.properties?.[name];
  return typeof value === "string" ? value : null;
}

/** Adds an attribute, stringifying JSX values but preserving hast numeric values. */
function setAttribute(node: ContentNode, name: string, value: string | number) {
  if (node.attributes) {
    node.attributes.push({ type: "mdxJsxAttribute", name, value: String(value) });
  } else if (node.properties) {
    node.properties[name] = value;
  }
}

/** Adds each attribute the element does not already have. */
export function setMissingAttributes(node: ContentNode, attributes: Record<string, string | number>) {
  for (const [name, value] of Object.entries(attributes)) {
    if (!hasAttribute(node, name)) {
      setAttribute(node, name, value);
    }
  }
}
