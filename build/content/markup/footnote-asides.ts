import { visit } from "unist-util-visit";
import { visitParents } from "unist-util-visit-parents";

import { FOOTNOTE_COMPONENT_NAME, RAIL_COMPONENT_NAME } from "./rail-asides.ts";
import { elementNameOf, isJsxElement, isWhitespaceOrComment, quotedEntryPathOf } from "./tree.ts";

import type { ContentNode, ContentParent, EntryVFile } from "./tree.ts";

interface FootnoteVFile extends EntryVFile {
  value?: string | Uint8Array;
}

interface FootnoteDefinition extends ContentNode {
  label?: string | null; // The label as authored, where `identifier` is normalized.
  children: Array<ContentNode>;
}

interface FootnoteReference extends ContentNode {
  label?: string | null;
}

interface NumberedFootnote {
  number: number;
  definition: FootnoteDefinition;
  referenceCount: number;
}

const BACK_LINK_TEXT = "↩︎";
const WRITTEN_REFERENCE_PATTERN = /(\\*)\[\^([^\]\s]+)\]/g; // A `[^label]` in an entry's source, with the run of backslashes before it, which escapes the bracket when its length is odd.

// Each run of characters other than ASCII letters, digits, hyphens, and underscores in a label becomes
// one hyphen, so the fragment of a reference's `href` attribute matches the footnote's ID without
// percent-decoding. The transform throws for two labels that become the same ID.
const idOf = (identifier: string) => identifier.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
const footnoteIdOf = (identifier: string) => `fn-${idOf(identifier)}`;
const footnoteReferenceIdOf = (identifier: string, occurrence: number) =>
  `fnref-${idOf(identifier)}${occurrence > 1 ? `-${occurrence}` : ""}`;

const isLink = (node: ContentNode) =>
  node.type === "link" || node.type === "linkReference" || (isJsxElement(node) && elementNameOf(node) === "a");
const isHeading = (node: ContentNode) =>
  node.type === "heading" || (isJsxElement(node) && /^h[1-6]$/.test(elementNameOf(node) ?? ""));
const isRail = (node: ContentNode) => isJsxElement(node) && elementNameOf(node) === RAIL_COMPONENT_NAME;
const isFootnoteDefinition = (node: ContentNode): node is FootnoteDefinition => node.type === "footnoteDefinition";

function containerDescriptionOf(container: ContentNode): string {
  if (isFootnoteDefinition(container)) {
    return `the footnote "[^${container.label ?? container.identifier}]"`;
  }

  if (isJsxElement(container)) {
    return `\`<${elementNameOf(container) ?? ""}>\``;
  }

  return container.type === "listItem" ? "a list item" : "a blockquote"; // The only other blocks that contain blocks.
}

const textNode = (value: string): ContentNode => ({ type: "text", value });
const supOf = (children: Array<ContentNode>): ContentNode => ({
  type: "mdxJsxTextElement",
  name: "sup",
  attributes: [],
  children,
});
const linkOf = (url: string, properties: Record<string, string>, children: Array<ContentNode>) => ({
  type: "link",
  url,
  data: { hProperties: properties },
  children,
});

function backLinksOf(identifier: string, { number, referenceCount }: NumberedFootnote): Array<ContentNode> {
  return Array.from({ length: referenceCount }, (_, index) => {
    const occurrence = index + 1;
    return [
      textNode(" "),
      linkOf(
        `#${footnoteReferenceIdOf(identifier, occurrence)}`,
        { ariaLabel: `Back to reference ${number}${occurrence > 1 ? `-${occurrence}` : ""}` },
        [textNode(BACK_LINK_TEXT), ...(occurrence > 1 ? [supOf([textNode(String(occurrence))])] : [])],
      ),
    ];
  }).flat();
}

function footnoteElementOf(identifier: string, footnote: NumberedFootnote): ContentNode {
  const children = [...footnote.definition.children];
  const lastChild = children.at(-1);
  const backLinks = backLinksOf(identifier, footnote);

  if (lastChild?.type === "paragraph") {
    children[children.length - 1] = { ...lastChild, children: [...(lastChild.children ?? []), ...backLinks] };
  } else {
    children.push({ type: "paragraph", children: backLinks.slice(1) });
  }

  return {
    type: "mdxJsxFlowElement",
    name: FOOTNOTE_COMPONENT_NAME,
    attributes: [
      { type: "mdxJsxAttribute", name: "id", value: footnoteIdOf(identifier) },
      { type: "mdxJsxAttribute", name: "number", value: String(footnote.number) },
    ],
    children,
  };
}

function assertReferencesDefined(tree: ContentParent, file: FootnoteVFile) {
  const source = typeof file.value === "string" ? file.value : new TextDecoder().decode(file.value);
  visit(tree, "text", (node: ContentNode) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;

    if (start === undefined || end === undefined) {
      return;
    }

    for (const [, backslashes = "", label] of source.slice(start, end).matchAll(WRITTEN_REFERENCE_PATTERN)) {
      if (backslashes.length % 2 === 0) {
        throw new Error(
          `${quotedEntryPathOf(file)} references the footnote "[^${label}]", which it does not define. Write "\\[^${label}]" for the text itself.`,
        );
      }
    }
  });
}

/**
 * Converts an entry's GFM footnotes to rail asides. Numbers each footnote by its first reference and
 * replaces every reference with `<sup><a id="fnref-<label>" href="#fn-<label>" aria-label="Footnote N">`.
 * Repeated references receive IDs suffixed with `-2`, `-3`, and so on. Moves each definition into a
 * `Footnote` element with the ID `fn-<label>`, inserting it at the root after the block containing its
 * first reference and any existing `Rail` elements. Appends links back to every reference to the
 * footnote's final paragraph.
 *
 * Throws when a reference has no definition, a label is defined twice, two labels share an ID, a definition
 * has no reference or is not at the entry root, or a reference appears inside a footnote, link, or heading.
 * Also throws, naming the entry, when it renders a `Footnote` itself.
 */
export function remarkFootnoteAsides() {
  return function transform(tree: ContentParent, file: FootnoteVFile) {
    const entryPath = quotedEntryPathOf(file);
    const definitions = new Map<string, FootnoteDefinition>();
    const labelsByFootnoteId = new Map<string, string>();

    assertReferencesDefined(tree, file); // Runs before the definitions are removed from the tree, so it reads the text inside them too.

    visit(tree, (node: ContentNode) => {
      if (isJsxElement(node) && elementNameOf(node) === FOOTNOTE_COMPONENT_NAME) {
        throw new Error(
          `${entryPath} renders a \`${FOOTNOTE_COMPONENT_NAME}\`, which the build emits for each footnote.`,
        );
      }
    });

    visit(tree, "footnoteDefinition", (node: FootnoteDefinition, _index, parent: ContentParent | undefined) => {
      // A definition inside another block would leave that block empty, and one inside another definition would be removed with it.
      if (parent !== undefined && parent !== tree) {
        throw new Error(
          `${entryPath} defines the footnote "[^${node.label ?? node.identifier}]" inside ${containerDescriptionOf(parent)}.`,
        );
      }
    });

    for (const node of tree.children.filter(isFootnoteDefinition)) {
      const identifier = node.identifier ?? "";
      const label = node.label ?? identifier;
      const footnoteId = footnoteIdOf(identifier);
      const labelWithSameId = labelsByFootnoteId.get(footnoteId);

      if (definitions.has(identifier)) {
        throw new Error(`${entryPath} defines the footnote "[^${label}]" twice.`);
      }

      if (labelWithSameId !== undefined) {
        throw new Error(
          `${entryPath} defines the footnotes "[^${labelWithSameId}]" and "[^${label}]", which have the same ID "${footnoteId}".`,
        );
      }

      visit(node, "footnoteReference", (reference: FootnoteReference) => {
        throw new Error(
          `${entryPath} references the footnote "[^${reference.label}]" inside the footnote "[^${label}]".`,
        );
      });

      definitions.set(identifier, node);
      labelsByFootnoteId.set(footnoteId, label);
    }

    tree.children = tree.children.filter((node) => !isFootnoteDefinition(node));

    const footnotes = new Map<string, NumberedFootnote>();
    const firstReferencedIdentifiersByBlock = new Map<ContentNode, Array<string>>();

    for (const block of tree.children) {
      visitParents(block, "footnoteReference", (reference: FootnoteReference, ancestors: Array<ContentNode>) => {
        const identifier = reference.identifier ?? "";
        const label = reference.label ?? identifier;

        if (ancestors.some(isLink)) {
          throw new Error(`${entryPath} references the footnote "[^${label}]" inside a link.`);
        }

        if (ancestors.some(isHeading)) {
          throw new Error(`${entryPath} references the footnote "[^${label}]" inside a heading.`);
        }

        const definition = definitions.get(identifier)!; // The parser creates a reference only for a defined label.

        let footnote = footnotes.get(identifier);

        if (footnote === undefined) {
          footnote = { number: footnotes.size + 1, definition, referenceCount: 0 };
          footnotes.set(identifier, footnote);
          firstReferencedIdentifiersByBlock.set(block, [
            ...(firstReferencedIdentifiersByBlock.get(block) ?? []),
            identifier,
          ]);
        }

        const parent = ancestors.at(-1)!;

        footnote.referenceCount++;
        parent.children![parent.children!.indexOf(reference)] = supOf([
          linkOf(
            `#${footnoteIdOf(identifier)}`,
            {
              id: footnoteReferenceIdOf(identifier, footnote.referenceCount),
              ariaLabel: `Footnote ${footnote.number}`,
              dataFootnoteReference: "",
            },
            [textNode(String(footnote.number))],
          ),
        ]);
      });
    }

    for (const [identifier, definition] of definitions) {
      if (!footnotes.has(identifier)) {
        throw new Error(`${entryPath} defines the footnote "[^${definition.label}]" without a reference to it.`);
      }
    }

    const footnoteElementsFor = (identifiers: Array<string>) =>
      identifiers.map((identifier) => footnoteElementOf(identifier, footnotes.get(identifier)!));
    const children: Array<ContentNode> = [];

    let pendingIdentifiers: Array<string> = [];

    for (const block of tree.children) {
      if (!isRail(block) && !isWhitespaceOrComment(block)) {
        children.push(...footnoteElementsFor(pendingIdentifiers));
        pendingIdentifiers = [];
      }

      children.push(block);
      pendingIdentifiers.push(...(firstReferencedIdentifiersByBlock.get(block) ?? []));
    }

    tree.children = [...children, ...footnoteElementsFor(pendingIdentifiers)];
  };
}
