import { visit } from "unist-util-visit";

import { elementNameOf } from "../content/markup/tree.ts";

import { blocksIn, listOf, textNode } from "./nodes.ts";

import type { ContentNode, ContentParent } from "../content/markup/tree.ts";

// Writes the tables in an entry as GFM tables in its Markdown representation.

const TABLE_SECTION_NAMES = ["thead", "tbody", "tfoot"] as const;

type TableSectionName = (typeof TABLE_SECTION_NAMES)[number];

const isTableSectionName = (name: string | null): name is TableSectionName =>
  TABLE_SECTION_NAMES.some((sectionName) => sectionName === name);

interface AuthoredTable {
  caption: Array<ContentNode>;
  rows: Array<Array<ContentNode>>; // The `<td>` and `<th>` elements of each row.
}

const TABLE_CELL_NAMES = new Set(["td", "th"]);

// MDX parses an element written on one line as phrasing inside a paragraph, so the rows and cells of a
// table are found through the paragraphs between them.
function cellsIn(row: ContentNode): Array<ContentNode> {
  return (row.children ?? []).flatMap((child) => {
    if (child.type === "paragraph") {
      return cellsIn(child);
    }

    return TABLE_CELL_NAMES.has(elementNameOf(child) ?? "") ? [child] : [];
  });
}

function authoredTableFrom(table: ContentNode): AuthoredTable {
  const caption: Array<ContentNode> = [];
  const rowsBySection: Record<TableSectionName, Array<Array<ContentNode>>> = { thead: [], tbody: [], tfoot: [] };

  const collect = (parent: ContentNode, section: TableSectionName) => {
    for (const child of parent.children ?? []) {
      const name = elementNameOf(child);

      if (name === "caption") {
        caption.push(...blocksIn(child));
      } else if (name === "tr") {
        rowsBySection[section].push(cellsIn(child));
      } else if (isTableSectionName(name)) {
        collect(child, name);
      } else if (child.type === "paragraph") {
        collect(child, section);
      }
    }
  };

  collect(table, "tbody");

  return { caption, rows: [...rowsBySection.thead, ...rowsBySection.tbody, ...rowsBySection.tfoot] };
}

function phrasingIn(cell: ContentNode): Array<ContentNode> | null {
  const children = cell.children ?? [];

  if (cell.type === "mdxJsxTextElement" || children.length === 0) {
    return children;
  }

  const [paragraph] = children;

  return children.length === 1 && paragraph?.type === "paragraph" ? (paragraph.children ?? []) : null;
}

function spanValueOf(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim();
  }

  return typeof value === "object" && value !== null && "value" in value ? String(value.value).trim() : null;
}

const singleLinePhrasingOf = (phrasing: Array<ContentNode>): Array<ContentNode> =>
  phrasing.map((node) => {
    if (node.type === "break") {
      return textNode(" ");
    }

    if (node.type === "text") {
      return { ...node, value: node.value?.replace(/[^\S\n]*\n\s*/g, " ") };
    }

    return node.children ? { ...node, children: singleLinePhrasingOf(node.children) } : node;
  });

const SPAN_ATTRIBUTE_NAMES = new Set(["colSpan", "colspan", "rowSpan", "rowspan"]);

const isSpanningCell = (cell: ContentNode) =>
  (cell.attributes ?? []).some(({ name, value }) => SPAN_ATTRIBUTE_NAMES.has(name ?? "") && spanValueOf(value) !== "1");

function gfmTableRowsFrom(rows: Array<Array<ContentNode>>): Array<ContentNode> | null {
  const tableRows: Array<ContentNode> = [];

  for (const row of rows) {
    const tableCells: Array<ContentNode> = [];

    for (const cell of row) {
      const phrasing = isSpanningCell(cell) ? null : phrasingIn(cell);

      if (!phrasing) {
        return null;
      }

      tableCells.push({ type: "tableCell", children: singleLinePhrasingOf(phrasing) });
    }

    tableRows.push({ type: "tableRow", children: tableCells });
  }

  return tableRows;
}

function tableMarkdownNodesFrom(table: ContentNode): Array<ContentNode> {
  const { caption, rows } = authoredTableFrom(table);

  if (rows.length === 0) {
    return caption;
  }

  const tableRows = gfmTableRowsFrom(rows);

  if (tableRows) {
    return [...caption, { type: "table", children: tableRows }];
  }

  return [...caption, listOf(rows.map((row) => [listOf(row.map(blocksIn))]))];
}

/**
 * Replaces each `<table>` written as a block with its Markdown nodes. This must run before the MDX
 * is stripped, which replaces a table's children before the table itself and so would remove the
 * `<tr>`, `<td>`, and `<th>` elements the rows and cells are read from.
 */
export function remarkAuthoredTables() {
  return function transform(tree: ContentParent) {
    visit(tree, (node, index, parent) => {
      if (node.type !== "mdxJsxFlowElement" || node.name !== "table" || !parent || index === undefined) {
        return undefined;
      }

      parent.children.splice(index, 1, ...tableMarkdownNodesFrom(node));

      return index; // Visits the replacements, so a table nested in a listed cell is rewritten too.
    });
  };
}
