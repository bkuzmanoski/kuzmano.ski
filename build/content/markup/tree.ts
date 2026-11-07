import { toQuotedRootRelative } from "../../paths.ts";

/** `remark-mdx` node types for authored JSX. */
export const JSX_ELEMENT_NODE_TYPES = new Set(["mdxJsxFlowElement", "mdxJsxTextElement"]);

/**
 * A node in the MDX, Markdown, or HTML syntax tree the content pipeline walks.
 *
 * The media references and the Markdown representation walk three vocabularies — mdast (`image`, `definition`,
 * `imageReference`, `text`), hast (`element`), and mdx-jsx (`mdxJsxFlowElement`, `mdxJsxTextElement`). This flattens
 * all of them into one optional-field shape rather than composing `@types/mdast` and `@types/hast` to avoid a narrowing
 * step in every callback before it could read `url`, `properties`, or `attributes`.
 *
 * `value` and `children` are never both present.
 */
export interface ContentNode {
  type: string;
  tagName?: string;
  name?: string | null;
  value?: string;
  url?: string;
  /** Markdown label used by `definition` and `imageReference` nodes. */
  identifier?: string;
  alt?: string | null;
  title?: string | null;
  /** Language of an mdast `code` node. */
  lang?: string | null;
  /** Text after the language on the opening fence of an mdast `code` node. */
  meta?: string | null;
  /** Level of an mdast `heading` node, from 1 to 6. */
  depth?: number;
  /** Whether an mdast `list` node is numbered. */
  ordered?: boolean | null;
  /** Whether an mdast `list` or `listItem` node separates its children with blank lines. */
  spread?: boolean | null;
  properties?: Record<string, unknown>;
  attributes?: Array<ContentNodeAttribute>;
  children?: Array<ContentNode>;
  /** Absent from a node created by a transform. */
  position?: SourcePosition;
}

export interface ContentNodeAttribute {
  type?: string;
  name?: string | null;
  value?: unknown;
  /** Absent from an attribute created by a transform. */
  position?: SourcePosition;
}

export interface SourcePosition {
  start: SourcePoint;
  end: SourcePoint;
}

interface SourcePoint {
  line: number;
  column: number;
  /** In UTF-16 code units. */
  offset?: number | undefined;
}

/** A tree root with required children, enabling `unist-util-visit` transforms to replace nodes. */
export interface ContentParent extends ContentNode {
  children: Array<ContentNode>;
}

/** VFile data used by entry transforms. */
export interface EntryVFile {
  path?: string | undefined;
}

/** Names an entry by its repository-relative path, quoted, at the start of a problem message. */
export const quotedEntryPathOf = ({ path }: EntryVFile) =>
  path ? toQuotedRootRelative(path) : "An entry without a path";

export const isJsxElement = (node: ContentNode) => JSX_ELEMENT_NODE_TYPES.has(node.type);

/** Returns an element name from MDX JSX or hast. */
export const elementNameOf = (node: ContentNode | undefined) => node?.tagName ?? node?.name ?? null;

export const isJsxElementNamed = (node: ContentNode, name: string) =>
  isJsxElement(node) && elementNameOf(node) === name;

/**
 * Returns an attribute from an MDX JSX or hast element, or `undefined` when it is absent. JSX attribute values are
 * `null` when valueless and objects when authored as expressions.
 */
export function attributeOf(node: ContentNode, name: string): { value?: unknown } | undefined {
  if (node.attributes) {
    return node.attributes.find((attribute) => attribute.name === name);
  }

  return node.properties !== undefined && name in node.properties ? { value: node.properties[name] } : undefined;
}

/** Whether an element declares a named attribute, including a JSX expression. */
export const hasAttribute = (node: ContentNode, name: string) => attributeOf(node, name) !== undefined;

/** Whether a JSX element spreads an expression into its attributes, which can set any attribute at runtime. */
export const hasSpreadAttribute = (node: ContentNode) =>
  node.attributes?.some(({ type }) => type === "mdxJsxExpressionAttribute") ?? false;

export function stringAttributeOf(node: ContentNode, name: string): string | null {
  const value = attributeOf(node, name)?.value;
  return typeof value === "string" ? value : null;
}

/**
 * Returns an attribute value only when it is in `allowedValues`; otherwise throws. Returns `undefined` if the attribute
 * is absent. `describeElement` receives its authored value: a string, "without a value", or "authored as an
 * expression".
 */
export function assertAttributeOneOf<TValue extends string>(
  node: ContentNode,
  name: string,
  allowedValues: ReadonlyArray<TValue>,
  { file, describeElement }: { file: EntryVFile; describeElement: (authoredValue: AuthoredAttributeValue) => string },
): TValue | undefined {
  const attribute = attributeOf(node, name);

  if (attribute === undefined) {
    return undefined;
  }

  const { value } = attribute;

  if (typeof value === "string" && (allowedValues as ReadonlyArray<string>).includes(value)) {
    return value as TValue;
  }

  const authoredValue: AuthoredAttributeValue =
    typeof value === "string"
      ? { kind: "string", value }
      : { kind: value === null || value === undefined ? "without a value" : "authored as an expression" };

  throw new Error(
    `${quotedEntryPathOf(file)} renders ${describeElement(authoredValue)}. Expected one of: ${allowedValues.join(", ")}.`,
  );
}

export type AuthoredAttributeValue =
  { kind: "string"; value: string } | { kind: "without a value" | "authored as an expression" };

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
 * A node in the ESTree program `remark-mdx` parses from an import, an export, an `{expression}`, or a JSX expression
 * attribute and attaches as `data.estree`, flattened into one optional-field shape. It declares only the fields the
 * build reads as `@types/estree` is not a dependency.
 */
export interface EstreeNode {
  type: string;
  /** Name of an `Identifier` node. */
  name?: string;
  /** Value of a `Literal` node, or `{ raw, cooked }` of a `TemplateElement` node. */
  value?: unknown;
  /** Statements of a `Program` node. */
  body?: Array<EstreeNode>;
  /** Expression of an `ExpressionStatement` node. */
  expression?: EstreeNode;
  /** Interpolated expressions of a `TemplateLiteral` node. */
  expressions?: Array<EstreeNode>;
  /** `TemplateElement` nodes of a `TemplateLiteral` node. */
  quasis?: Array<EstreeNode>;
  /** Members of an `ObjectExpression` node. */
  properties?: Array<EstreeNode>;
  /** Operand of a `SpreadElement` node. */
  argument?: EstreeNode;
  /** Specifiers of an `ImportDeclaration` node. */
  specifiers?: Array<EstreeNode>;
  /** Module specifier of an `ImportDeclaration` node, as a `Literal` node. */
  source?: EstreeNode;
  /** Exported name an `ImportSpecifier` node imports. */
  imported?: EstreeNode;
  /** Name an import specifier binds in the importing module. */
  local?: EstreeNode;
}

/** `ContentNode` does not declare `data`, which mdast declares differently for each node type. */
export const estreeOf = (node: object): EstreeNode | null =>
  (node as { data?: { estree?: EstreeNode | null } }).data?.estree ?? null;

export const isWhitespaceOrComment = (node: ContentNode) =>
  (node.type === "text" && !node.value?.trim()) ||
  (node.type === "mdxFlowExpression" && estreeOf(node)?.body?.length === 0);
