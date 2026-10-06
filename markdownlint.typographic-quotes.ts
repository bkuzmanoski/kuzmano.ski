import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { remarkGfmSubset } from "./build/content/markup/gfm.ts";
import { elementNameOf, isJsxElement } from "./build/content/markup/tree.ts";

import type { ContentNode } from "./build/content/markup/tree.ts";
// eslint-disable-next-line import/no-extraneous-dependencies -- Provided by `markdownlint-cli2`.
import type { Rule, RuleOnError } from "markdownlint";

interface ProseCharacter {
  character: string;
  offset: number | null; // `null` when the character is not checked (e.g. a placeholder, or one authored as an escape or character reference).
}

interface OpenQuotationCounts {
  double: number;
  single: number;
}

const QUOTE_CHARACTERS = new Set(['"', "'", "“", "”", "‘", "’"]);
const STRAIGHT_QUOTE_CHARACTERS = new Set(['"', "'"]);
const DOUBLE_QUOTE_CHARACTERS = new Set(['"', "“", "”"]);
const DASH_CHARACTERS = new Set(["—", "–", "-"]);
const OPENING_CONTEXT_CHARACTERS = new Set(["(", "[", "{", "“", "‘", ...DASH_CHARACTERS]);
const LEADING_APOSTROPHE_WORD_PATTERN = /^(?:\d\ds?|tis|twas|til|em|cause|n)(?![\p{L}\p{N}])/iu;
const LEADING_APOSTROPHE_WORD_MAX_LENGTH = 5;
const ESCAPABLE_CHARACTER_PATTERN = /[!-/:-@[-`{-~]/;
const CHARACTER_REFERENCE_PATTERN = /&(?:#(\d{1,7})|#[xX]([\dA-Fa-f]{1,6})|[A-Za-z][A-Za-z\d]{1,31});/y;
const WORD_CHARACTER_PATTERN = /[\p{L}\p{N}]/u;
const DIGIT_PATTERN = /\d/;
const WHITESPACE_PATTERN = /\s/;
const PLACEHOLDER_CHARACTER = "x";
const PHRASING_CONTAINER_TYPES = new Set(["paragraph", "heading", "tableCell"]);
const PROSE_ATTRIBUTE_NAMES = new Set(["alt", "title", "label", "caption", "aria-label", "action", "confirmation"]);
const LITERAL_ELEMENT_NAMES = new Set(["code", "kbd", "pre", "samp"]);

export const AMBIGUOUS_QUOTE_DETAIL =
  "Expected a typographic quotation mark, apostrophe, or prime, or a backslash-escaped straight quote";

const isWordCharacter = (character: string | undefined) =>
  character !== undefined && WORD_CHARACTER_PATTERN.test(character);
const isDigit = (character: string | undefined) => character !== undefined && DIGIT_PATTERN.test(character);
const isWhitespace = (character: string | undefined) => character === undefined || WHITESPACE_PATTERN.test(character);

function doubleQuoteFor(
  isOpeningContext: boolean,
  previous: string | undefined,
  next: string | undefined,
  openQuotationCounts: OpenQuotationCounts,
): string | null {
  if (isOpeningContext) {
    if (isWhitespace(next)) {
      return null;
    }

    openQuotationCounts.double += 1;

    return "“";
  }

  if (isDigit(previous) && openQuotationCounts.double === 0) {
    return null; // Outside a quotation, a double quote after a digit could be a double prime.
  }

  openQuotationCounts.double = Math.max(0, openQuotationCounts.double - 1);

  return "”";
}

function singleQuoteFor(
  isOpeningContext: boolean,
  previousCharacter: string | undefined,
  nextCharacter: string | undefined,
  following: string,
  openQuotationCounts: OpenQuotationCounts,
): string | null {
  if (isOpeningContext) {
    if (isWhitespace(nextCharacter)) {
      return null;
    }

    if (LEADING_APOSTROPHE_WORD_PATTERN.test(following)) {
      return "’";
    }

    openQuotationCounts.single += 1;
    return "‘";
  }

  if (isWordCharacter(previousCharacter) && isWordCharacter(nextCharacter)) {
    return isDigit(previousCharacter) && isDigit(nextCharacter) ? null : "’"; // Between two digits, a single quote between digits could be a prime.
  }

  if (isDigit(previousCharacter) && openQuotationCounts.single === 0) {
    return null; // Outside a quotation, a single quote after a digit could be a prime.
  }

  openQuotationCounts.single = Math.max(0, openQuotationCounts.single - 1);

  return "’";
}

function typographicQuotesIn(proseRun: Array<ProseCharacter>): Map<number, string | null> {
  const replacements = new Map<number, string | null>();
  const resolvedCharacters = proseRun.map(({ character }) => character);
  const openQuotationCounts: OpenQuotationCounts = { double: 0, single: 0 };

  for (const [index, { character, offset }] of proseRun.entries()) {
    if (!QUOTE_CHARACTERS.has(character)) {
      continue;
    }

    const previousCharacter = resolvedCharacters[index - 1];
    const nextCharacter = resolvedCharacters[index + 1];
    const isDoubleQuote = DOUBLE_QUOTE_CHARACTERS.has(character);
    const openQuotationCount = isDoubleQuote ? openQuotationCounts.double : openQuotationCounts.single;
    const isClosingAfterDash =
      DASH_CHARACTERS.has(previousCharacter!) && isWhitespace(nextCharacter) && openQuotationCount > 0; // A quote between a dash and a space closes an open quotation.
    const isOpeningContext =
      !isClosingAfterDash && (isWhitespace(previousCharacter) || OPENING_CONTEXT_CHARACTERS.has(previousCharacter!));
    const replacement = isDoubleQuote
      ? doubleQuoteFor(isOpeningContext, previousCharacter, nextCharacter, openQuotationCounts)
      : singleQuoteFor(
          isOpeningContext,
          previousCharacter,
          nextCharacter,
          resolvedCharacters.slice(index + 1, index + 1 + LEADING_APOSTROPHE_WORD_MAX_LENGTH).join(""),
          openQuotationCounts,
        ); // Typographic and escaped quotes are classified too as they open and close quotations for the quotes after them.

    if (STRAIGHT_QUOTE_CHARACTERS.has(character)) {
      resolvedCharacters[index] = replacement ?? character;

      if (offset !== null) {
        replacements.set(offset, replacement);
      }
    }
  }

  return replacements;
}

function decodedLengthOf(reference: RegExpExecArray): number {
  const [, decimal, hexadecimal] = reference;
  const codePoint =
    decimal !== undefined ? Number(decimal) : hexadecimal !== undefined ? Number.parseInt(hexadecimal, 16) : 0;

  return codePoint > 0xffff && codePoint <= 0x10ffff ? 2 : 1;
}

function alignedProseCharacters(
  source: string,
  { start, end, value }: { start: number; end: number; value: string },
  { hasBackslashEscapes }: { hasBackslashEscapes: boolean },
): Array<ProseCharacter> {
  const proseCharacters: Array<ProseCharacter> = [];

  let offset = start;
  let index = 0;

  while (index < value.length && offset < end) {
    const character = value[index]!;

    if (
      hasBackslashEscapes &&
      source[offset] === "\\" &&
      source[offset + 1] === character &&
      ESCAPABLE_CHARACTER_PATTERN.test(character)
    ) {
      proseCharacters.push({ character, offset: null });
      index += 1;
      offset += 2;

      continue;
    }

    if (source[offset] === character) {
      proseCharacters.push({ character, offset });
      index += 1;
      offset += 1;
      continue;
    }

    CHARACTER_REFERENCE_PATTERN.lastIndex = offset;
    const reference = CHARACTER_REFERENCE_PATTERN.exec(source);

    if (reference) {
      const decodedLength = decodedLengthOf(reference);

      proseCharacters.push({ character: value.slice(index, index + decodedLength), offset: null });
      index += decodedLength;
      offset += reference[0].length;
      continue;
    }

    offset += 1;
  }

  return proseCharacters;
}

const placeholderCharacter = (character = PLACEHOLDER_CHARACTER): ProseCharacter => ({ character, offset: null });
const isLiteralElement = (node: ContentNode) =>
  isJsxElement(node) && LITERAL_ELEMENT_NAMES.has(elementNameOf(node) ?? "");

function titleRangeIn(source: string, node: ContentNode): { start: number; end: number } | null {
  const nodeStart = node.position!.start.offset!;

  let closingDelimiterOffset = node.position!.end.offset! - 1;

  if (node.type !== "definition") {
    closingDelimiterOffset -= 1; // The `)` that closes the destination and title.
  }

  while (closingDelimiterOffset > nodeStart && isWhitespace(source[closingDelimiterOffset])) {
    closingDelimiterOffset -= 1;
  }

  const closingDelimiter = source[closingDelimiterOffset];
  const openingDelimiter = closingDelimiter === ")" ? "(" : closingDelimiter;

  for (let offset = closingDelimiterOffset - 1; offset > nodeStart; offset -= 1) {
    if (source[offset] === openingDelimiter && source[offset - 1] !== "\\") {
      return { start: offset + 1, end: closingDelimiterOffset };
    }
  }

  return null;
}

function proseRunsIn(source: string, tree: ContentNode): Array<Array<ProseCharacter>> {
  const proseRuns: Array<Array<ProseCharacter>> = [];

  const addProseAttributeValues = (node: ContentNode) => {
    for (const { type, name, value, position } of node.attributes ?? []) {
      if (
        type !== "mdxJsxAttribute" ||
        !PROSE_ATTRIBUTE_NAMES.has(name ?? "") ||
        typeof value !== "string" ||
        position?.start.offset === undefined ||
        position.end.offset === undefined
      ) {
        continue;
      }

      const valueStart =
        position.start.offset + source.slice(position.start.offset, position.end.offset).search(/["']/) + 1;

      // A JSX string attribute value does not support backslash escapes.
      proseRuns.push(
        alignedProseCharacters(
          source,
          { start: valueStart, end: position.end.offset - 1, value },
          { hasBackslashEscapes: false },
        ),
      );
    }
  };

  const addTitle = (node: ContentNode) => {
    const titleRange = node.title && node.position ? titleRangeIn(source, node) : null;

    if (titleRange) {
      proseRuns.push(
        alignedProseCharacters(source, { ...titleRange, value: node.title! }, { hasBackslashEscapes: true }),
      );
    }
  };

  const addImageAlt = (node: ContentNode) => {
    if (node.alt && node.position) {
      const altStart = node.position.start.offset! + "![".length;

      proseRuns.push(
        alignedProseCharacters(
          source,
          { start: altStart, end: node.position.end.offset!, value: node.alt },
          { hasBackslashEscapes: true },
        ),
      );
    }
  };

  const isAutolinkLiteral = ({ url, children }: ContentNode) =>
    children?.length === 1 && children[0]!.type === "text" && url?.endsWith(children[0]!.value!) === true;

  const flatten = (nodes: Array<ContentNode>, proseRun: Array<ProseCharacter>) => {
    for (const node of nodes) {
      if (node.type === "text" && node.position) {
        proseRun.push(
          ...alignedProseCharacters(
            source,
            { start: node.position.start.offset!, end: node.position.end.offset!, value: node.value! },
            { hasBackslashEscapes: true },
          ),
        );
      } else if (node.type === "break") {
        proseRun.push(placeholderCharacter(" "));
      } else if (node.type === "image" || node.type === "imageReference") {
        addImageAlt(node);
        addTitle(node);
        proseRun.push(placeholderCharacter());
      } else if (node.type === "link" && isAutolinkLiteral(node)) {
        proseRun.push(placeholderCharacter());
      } else {
        if (isJsxElement(node)) {
          addProseAttributeValues(node);
        } else if (node.type === "link") {
          addTitle(node);
        }

        if (node.children?.length && !isLiteralElement(node)) {
          flatten(node.children, proseRun);
        } else {
          proseRun.push(placeholderCharacter());
        }
      }
    }
  };

  const visit = (node: ContentNode) => {
    if (isJsxElement(node)) {
      addProseAttributeValues(node);
    } else if (node.type === "definition") {
      addTitle(node);
    }

    if (isLiteralElement(node)) {
      return;
    }

    if (node.children && PHRASING_CONTAINER_TYPES.has(node.type)) {
      const proseRun: Array<ProseCharacter> = [];

      flatten(node.children, proseRun);
      proseRuns.push(proseRun);
    } else {
      node.children?.forEach(visit);
    }
  };

  visit(tree);

  return proseRuns;
}

function reportStraightQuotes(source: string, replacements: Map<number, string | null>, onError: RuleOnError) {
  let lineNumber = 1;
  let lineStartOffset = 0;

  // The offsets are visited in order, so the line containing each one is found by scanning forward from the last.
  for (const [offset, replacement] of [...replacements].sort(([a], [b]) => a - b)) {
    for (let nextLineEnd = source.indexOf("\n", lineStartOffset); nextLineEnd !== -1 && nextLineEnd < offset;) {
      lineNumber += 1;
      lineStartOffset = nextLineEnd + 1;
      nextLineEnd = source.indexOf("\n", lineStartOffset);
    }

    const column = offset - lineStartOffset + 1;

    onError({
      lineNumber,
      detail: replacement === null ? AMBIGUOUS_QUOTE_DETAIL : `Expected ${replacement}, found ${source[offset]}`,
      range: [column, 1],
      ...(replacement !== null && { fixInfo: { editColumn: column, deleteCount: 1, insertText: replacement } }),
    });
  }
}

const typographicQuotesRule: Rule = {
  names: ["typographic-quotes"],
  description: "Quotation marks and apostrophes in prose should be typographic",
  tags: ["typography"],
  parser: "none",
  function: (params, onError) => {
    const source = params.lines.join("\n");

    let tree: ContentNode;

    try {
      tree = unified().use(remarkParse).use(remarkMdx).use(remarkGfmSubset).parse(source);
    } catch {
      return; // The build reports MDX that does not parse.
    }

    const replacements = new Map<number, string | null>();

    for (const proseRun of proseRunsIn(source, tree)) {
      for (const [offset, replacement] of typographicQuotesIn(proseRun)) {
        replacements.set(offset, replacement);
      }
    }

    reportStraightQuotes(source, replacements, onError);
  },
};

export default typographicQuotesRule;
