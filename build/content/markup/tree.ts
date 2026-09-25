/** `remark-mdx` node types for authored JSX. */
export const JSX_ELEMENT_NODE_TYPES = new Set(["mdxJsxFlowElement", "mdxJsxTextElement"]);

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
  lang?: string | null; // Language of an mdast `code` node.
  depth?: number; // Level of an mdast `heading` node, from 1 to 6.
  ordered?: boolean | null; // Whether an mdast `list` node is numbered.
  spread?: boolean | null; // Whether an mdast `list` or `listItem` node separates its children with blank lines.
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

/**
 * A node in the ESTree program `remark-mdx` parses from an import, an export, an `{expression}`, or a
 * JSX expression attribute and attaches as `data.estree`, flattened into one optional-field shape. It
 * declares only the fields the build reads, since `@types/estree` is not a dependency.
 */
export interface EstreeNode {
  type: string;
  name?: string; // Name of an `Identifier` node.
  value?: unknown; // Value of a `Literal` node, or `{ raw, cooked }` of a `TemplateElement` node.
  body?: Array<EstreeNode>; // Statements of a `Program` node.
  expression?: EstreeNode; // Expression of an `ExpressionStatement` node.
  expressions?: Array<EstreeNode>; // Interpolated expressions of a `TemplateLiteral` node.
  quasis?: Array<EstreeNode>; // `TemplateElement` nodes of a `TemplateLiteral` node.
  properties?: Array<EstreeNode>; // Members of an `ObjectExpression` node.
  argument?: EstreeNode; // Operand of a `SpreadElement` node.
  specifiers?: Array<EstreeNode>; // Specifiers of an `ImportDeclaration` node.
  source?: EstreeNode; // Module specifier of an `ImportDeclaration` node, as a `Literal` node.
  imported?: EstreeNode; // Exported name an `ImportSpecifier` node imports.
  local?: EstreeNode; // Name an import specifier binds in the importing module.
}

// `ContentNode` does not declare `data`, which mdast declares differently for each node type.
export const estreeOf = (node: object): EstreeNode | null =>
  (node as { data?: { estree?: EstreeNode | null } }).data?.estree ?? null;
