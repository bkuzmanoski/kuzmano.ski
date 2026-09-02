import type { Rule, RuleParams } from "markdownlint";

// A markdownlint rule capping how deep a heading may nest.

type Token = RuleParams["parsers"]["micromark"]["tokens"][number];

const DEFAULT_LEVEL = 3;

const HEADING_TYPES = new Set(["atxHeading", "setextHeading"]);
const SEQUENCE_TYPES = new Set(["atxHeadingSequence", "setextHeadingLine"]);

// Walks the token tree rather than the raw lines so that a `#` inside a fenced or indented
// block is not mistaken for a heading. Headings nest inside block quotes and list items.
function* headings(tokens: Array<Token>): Generator<Token> {
  for (const token of tokens) {
    if (HEADING_TYPES.has(token.type)) {
      yield token;
    } else if (token.children.length > 0) {
      yield* headings(token.children);
    }
  }
}

// Matches markdownlint's reading of a heading token: setext `===` is level 1, setext `---`
// is level 2, and ATX `###` is level 3.
function levelOf(heading: Token): number {
  const sequence = heading.children.find((child) => SEQUENCE_TYPES.has(child.type));

  if (!sequence || sequence.text.startsWith("=")) {
    return 1;
  }

  if (sequence.text.startsWith("-")) {
    return 2;
  }

  return Math.min(sequence.text.length, 6);
}

const rule: Rule = {
  names: ["max-heading-level"],
  description: "Heading levels should not nest deeper than the content styles support",
  tags: ["headings"],
  parser: "micromark",
  function: (params, onError) => {
    const maxHeadingLevel = (params.config as { level?: number }).level ?? DEFAULT_LEVEL; // `config` is the rule's own entry in `.markdownlint-cli2.jsonc`, typed as `any`.

    for (const heading of headings(params.parsers.micromark.tokens)) {
      const level = levelOf(heading);

      if (level > maxHeadingLevel) {
        onError({
          lineNumber: heading.startLine,
          detail: `Expected h${maxHeadingLevel} or higher, found h${level}`,
        });
      }
    }
  },
};

export default rule;
