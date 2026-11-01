import { doc } from "prettier";
import { printers as estreePrinters } from "prettier/plugins/estree";
import { parsers as postcssParsers, printers as postcssPrinters } from "prettier/plugins/postcss";
import { parsers as typescriptParsers } from "prettier/plugins/typescript";

import type { Doc, Options, ParserOptions, Plugin } from "prettier";

// A Prettier plugin that rewraps the prose of comments to the print width. It covers `//` comments and `/** */` doc
// comments in TypeScript and `/* */` comments in CSS, on lines of their own. The plugin leaves a comment after code on
// its line, beside the value it explains. The pre-commit hook writes Prettier's output without showing it, so the
// plugin rewraps only lines it positively identifies as prose, and changes only the whitespace between their words. It
// prints any other line as authored, and that line ends the paragraph before it.

interface CommentNode {
  type: string;
  value: string;
  range: [number, number];
  loc: { start: unknown; end: unknown };
}

/** An empty `text` is a blank line between paragraphs. */
type CommentBlock =
  | { kind: "prose"; markerPrefix: string; continuationPrefix: string; words: Array<string> }
  | { kind: "verbatim"; text: string };

interface CommentFrame {
  firstLinePrefix: string;
  linePrefix: string;
  blankLine: string;
  suffix: string;
}

const LINE_COMMENT_FRAME: CommentFrame = { firstLinePrefix: "// ", linePrefix: "// ", blankLine: "//", suffix: "" };
const DOC_COMMENT_FRAME: CommentFrame = { firstLinePrefix: " * ", linePrefix: " * ", blankLine: " *", suffix: "" };
const CSS_COMMENT_FRAME: CommentFrame = { firstLinePrefix: "/* ", linePrefix: " * ", blankLine: " *", suffix: " */" };

const DIRECTIVE_PATTERN = /^\s*(?:@|eslint-|prettier-|stylelint-)/;
const ASTERISK_LINE_PATTERN = /^\s*\*(?: (.*))?$/;
const CODE_FENCE = "```";
const LIST_MARKER_PATTERN = /^(?:[-*]|\d+\.) /;

/** The second alternative matches words (e.g., "iOS" and "en-AU"). */
const PARAGRAPH_START_PATTERN = /^(?:[\p{Lu}\p{N}`"'(]|[\p{Ll}-]+\p{Lu})/u;

const CONTINUATION_START_PATTERN = /^[\p{L}\p{N}`"'(]/u;
const CODE_LINE_PATTERN = /(?:^(?:await|const|export|import|let|return|throw|type|var)\b|[=(]).*;$|[{}]$/;
const CODE_SPAN_PATTERN = /`[^`]*`/g;
const ALIGNMENT_SPACES_PATTERN = /\S {2,}\S/;
/** Treats a code span as part of one word, so a line break does not split it. */
const WORD_PATTERN = /(?:`[^`]*`|\S)+/g;

const { fill, group, hardline, ifBreak, join, line } = doc.builders;
const estreePrinter = estreePrinters.estree;
const postcssPrinter = postcssPrinters.postcss;
const typescriptParser = typescriptParsers.typescript;

/**
 * The doc of each comment the parser reflowed, keyed by node, as embedded TypeScript uses the same printer without the
 * reflow.
 */
const commentDocs = new WeakMap<CommentNode, Doc>();

const wordsIn = (text: string): Array<string> => text.match(WORD_PATTERN) ?? [];

// Whether a wrapped line may start with `word`. A line that starts with a character outside
// `CONTINUATION_START_PATTERN` (e.g., an em dash), a list marker, a directive, or a code fence, or that follows a line
// ending in a colon, would end the paragraph on the next pass. A directive at the start of a line would also take
// effect (e.g., `eslint-disable-next-line`, or an `@` tag in a doc comment).
const canStartWrappedLine = (word: string, previousWord: string): boolean =>
  CONTINUATION_START_PATTERN.test(word) &&
  !DIRECTIVE_PATTERN.test(word) &&
  !LIST_MARKER_PATTERN.test(`${word} `) &&
  !word.startsWith(CODE_FENCE) &&
  !previousWord.endsWith(":");

/** Joins each word that cannot start a wrapped line to the word before it, so `fill` breaks the line before both. */
function lineUnitsFrom(words: Array<string>): Array<string> {
  const units: Array<string> = [];

  for (const [index, word] of words.entries()) {
    const previousWord = words[index - 1];

    if (previousWord !== undefined && !canStartWrappedLine(word, previousWord)) {
      units[units.length - 1] += ` ${word}`;
    } else {
      units.push(word);
    }
  }

  return units;
}

function isProse(text: string, startPattern: RegExp): boolean {
  const textOutsideCodeSpans = text.replaceAll(CODE_SPAN_PATTERN, "`");
  return (
    startPattern.test(text) &&
    !DIRECTIVE_PATTERN.test(text) &&
    !CODE_LINE_PATTERN.test(textOutsideCodeSpans) &&
    !ALIGNMENT_SPACES_PATTERN.test(textOutsideCodeSpans)
  );
}

/**
 * Groups the text lines of a comment into paragraphs and list items, and marks every other line as verbatim. A line
 * ending in a colon ends its paragraph, as it introduces whatever follows it.
 */
function commentBlocksFrom(lines: Array<string>): Array<CommentBlock> {
  const blocks: Array<CommentBlock> = [];

  let openProseBlock: Extract<CommentBlock, { kind: "prose" }> | null = null;
  let isInsideCodeFence = false;

  for (const text of lines) {
    const isCodeFence = text.startsWith(CODE_FENCE);

    if (isCodeFence || isInsideCodeFence) {
      isInsideCodeFence = isCodeFence ? !isInsideCodeFence : isInsideCodeFence;
      blocks.push({ kind: "verbatim", text });
      openProseBlock = null;
      continue;
    }

    const listMarker = LIST_MARKER_PATTERN.exec(text)?.[0];

    if (listMarker !== undefined && isProse(text.slice(listMarker.length), CONTINUATION_START_PATTERN)) {
      openProseBlock = {
        kind: "prose",
        markerPrefix: listMarker,
        continuationPrefix: " ".repeat(listMarker.length),
        words: wordsIn(text.slice(listMarker.length)),
      };
      blocks.push(openProseBlock);
    } else if (
      openProseBlock &&
      text.startsWith(openProseBlock.continuationPrefix) &&
      isProse(text.slice(openProseBlock.continuationPrefix.length), CONTINUATION_START_PATTERN)
    ) {
      openProseBlock.words.push(...wordsIn(text));
    } else if (isProse(text, PARAGRAPH_START_PATTERN)) {
      openProseBlock = { kind: "prose", markerPrefix: "", continuationPrefix: "", words: wordsIn(text) };
      blocks.push(openProseBlock);
    } else {
      blocks.push({ kind: "verbatim", text });
      openProseBlock = null;
    }

    if (text.endsWith(":")) {
      openProseBlock = null;
    }
  }

  return blocks;
}

function printProseBlock(
  { markerPrefix, continuationPrefix, words }: Extract<CommentBlock, { kind: "prose" }>,
  prefix: string,
  linePrefix: string,
  suffix: string,
): Doc {
  const wordSeparator = ifBreak([line, linePrefix, continuationPrefix], " ");
  const units = lineUnitsFrom(words);
  const lastUnitIndex = units.length - 1;
  const printedUnits = units.map((unit, index) => (index === lastUnitIndex ? unit + suffix : unit));

  return [prefix, markerPrefix, fill(join(wordSeparator, printedUnits))];
}

function printCommentBlocks(blocks: Array<CommentBlock>, frame: CommentFrame): Doc {
  const lastBlockIndex = blocks.length - 1;
  return join(
    hardline,
    blocks.map((block, index) => {
      const prefix = index === 0 ? frame.firstLinePrefix : frame.linePrefix;
      const suffix = index === lastBlockIndex ? frame.suffix : "";

      if (block.kind === "prose") {
        return printProseBlock(block, prefix, frame.linePrefix, suffix);
      }

      return block.text === "" ? frame.blankLine + suffix : prefix + block.text + suffix;
    }),
  );
}

function isOnOwnLines(text: string, start: number, end: number): boolean {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = text.indexOf("\n", end);

  return (
    text.slice(lineStart, start).trim() === "" && text.slice(end, lineEnd === -1 ? text.length : lineEnd).trim() === ""
  );
}

const isLineComment = ({ type }: CommentNode): boolean => type === "Line";

// Excludes a directive, which has to remain a comment of its own, as `prettier-ignore` applies to the node after it.
function isReflowableLineComment(comment: CommentNode, text: string): boolean {
  const [start, end] = comment.range;

  return (
    isLineComment(comment) &&
    /^\/\/(?: |$)/.test(text.slice(start, end)) &&
    !DIRECTIVE_PATTERN.test(comment.value) &&
    isOnOwnLines(text, start, end)
  );
}

function isNextLineOf(previous: CommentNode, next: CommentNode, text: string): boolean {
  const lineStart = text.lastIndexOf("\n", previous.range[0]) + 1;
  const indentation = text.slice(lineStart, previous.range[0]);

  return text.slice(previous.range[1], next.range[0]) === `\n${indentation}`;
}

/**
 * Prettier parses each line of a `//` comment as a comment of its own, so the plugin merges adjacent lines into one
 * comment before Prettier attaches comments to nodes. The merged comment has one range, so Prettier prints it once.
 */
function commentsWithMergedLines(comments: Array<CommentNode>, text: string): Array<CommentNode> {
  const mergedComments: Array<CommentNode> = [];

  for (const comment of comments) {
    const previous = mergedComments.at(-1);

    if (
      previous &&
      isReflowableLineComment(previous, text) &&
      isReflowableLineComment(comment, text) &&
      isNextLineOf(previous, comment, text)
    ) {
      previous.value += `\n${comment.value}`;
      previous.range = [previous.range[0], comment.range[1]];
      previous.loc = { start: previous.loc.start, end: comment.loc.end };
    } else {
      mergedComments.push(comment);
    }
  }

  return mergedComments;
}

const lineCommentTextOf = (commentLine: string): string => commentLine.replace(/^ /, "");

/** Returns `null` for a line without a leading asterisk. */
function asteriskLineTextOf(commentLine: string): string | null {
  const match = ASTERISK_LINE_PATTERN.exec(commentLine);
  return match ? (match[1] ?? "") : null;
}

/** Returns `null` for a doc comment in any other shape, such as one with text on the line of its opening `/**`. */
function docCommentLinesFrom(value: string): Array<string> | null {
  const [firstLine = "", ...otherLines] = value.split("\n");

  if (otherLines.length === 0) {
    return [firstLine.slice(1).trim()];
  }

  const lastLine = otherLines.pop();
  const textLines = otherLines.map(asteriskLineTextOf);

  if (firstLine !== "*" || lastLine?.trim() !== "" || textLines.includes(null)) {
    return null;
  }

  return textLines as Array<string>;
}

function printDocComment(comment: CommentNode): Doc | null {
  const lines = comment.value.startsWith("*") ? docCommentLinesFrom(comment.value) : null;

  if (lines === null || lines.length === 0) {
    return null;
  }

  const blocks = commentBlocksFrom(lines);
  const [firstBlock] = blocks;

  if (comment.value.includes("\n")) {
    return ["/**", hardline, printCommentBlocks(blocks, DOC_COMMENT_FRAME), hardline, " */"];
  }

  if (firstBlock?.kind !== "prose") {
    return null;
  }

  // Prints on one line where the comment fits, and otherwise moves its delimiters to lines of their own.
  return group([
    "/**",
    ifBreak([line, " * "], " "),
    printProseBlock(firstBlock, "", " * ", ""),
    ifBreak([line, " */"], " */"),
  ]);
}

function recordCommentDocs(comments: Array<CommentNode>, text: string): void {
  for (const comment of comments) {
    const [start, end] = comment.range;

    if (isReflowableLineComment(comment, text)) {
      const lines = comment.value.split("\n").map(lineCommentTextOf);
      commentDocs.set(comment, printCommentBlocks(commentBlocksFrom(lines), LINE_COMMENT_FRAME));
    } else if (!isLineComment(comment) && isOnOwnLines(text, start, end)) {
      const printedDoc = printDocComment(comment);

      if (printedDoc !== null) {
        commentDocs.set(comment, printedDoc);
      }
    }
  }
}

/** Returns `null` for a comment in any other shape, such as one with its delimiters on lines of their own. */
function cssCommentLinesFrom(comment: string): Array<string> | null {
  const [firstLine = "", ...otherLines] = comment.slice(2, -2).split("\n");
  const textLines = otherLines.map(asteriskLineTextOf);

  if (!firstLine.startsWith(" ") || textLines.includes(null)) {
    return null;
  }

  return [firstLine.slice(1), ...(textLines as Array<string>)].map((text) => text.trimEnd());
}

function printCssComment(comment: string, options: ParserOptions, start: number, end: number): Doc {
  const lines = cssCommentLinesFrom(comment);
  return lines === null || !isOnOwnLines(options.originalText, start, end)
    ? comment
    : printCommentBlocks(commentBlocksFrom(lines), CSS_COMMENT_FRAME);
}

const isEmbedded = ({ parentParser }: Options): boolean => parentParser !== undefined;

/**
 * Prettier prefers the printers of the plugin that provides a file's parser, so each printer below takes effect only
 * when the plugin provides the parser too.
 */
const plugin = {
  parsers: {
    css: postcssParsers.css,
    typescript: {
      ...typescriptParser,
      parse: async (text: string, options: ParserOptions) => {
        const ast = (await typescriptParser.parse(text, options)) as { comments?: Array<CommentNode> };

        if (!isEmbedded(options) && ast.comments) {
          ast.comments = commentsWithMergedLines(ast.comments, text);
          recordCommentDocs(ast.comments, text);
        }

        return ast;
      },
    },
  },
  printers: {
    estree: {
      ...estreePrinter,
      printComment: (path, options) =>
        commentDocs.get(path.node as CommentNode) ?? estreePrinter.printComment!(path, options),
    },
    postcss: {
      ...postcssPrinter,
      print: (path, options, print, args) => {
        const printed = postcssPrinter.print(path, options, print, args);
        const node = path.node as { type: string };

        return node.type === "css-comment" && typeof printed === "string" && !isEmbedded(options)
          ? printCssComment(printed, options, options.locStart(node), options.locEnd(node))
          : printed;
      },
    },
  },
} satisfies Plugin;

export default plugin;
