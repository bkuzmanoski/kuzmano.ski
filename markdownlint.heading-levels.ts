// eslint-disable-next-line import/no-extraneous-dependencies -- Provided by `markdownlint-cli2`
import type { Rule, RuleParams } from "markdownlint";

// A markdownlint rule limiting an entry's headings to the levels the content styles support.

type Token = RuleParams["parsers"]["micromark"]["tokens"][number];

interface Heading {
  lineNumber: number;
  level: number;
  isElement: boolean;
}

const DEFAULT_MINIMUM_LEVEL = 1;
const DEFAULT_MAXIMUM_LEVEL = 6;

const HEADING_TYPES = new Set(["atxHeading", "setextHeading"]);
const SEQUENCE_TYPES = new Set(["atxHeadingSequence", "setextHeadingLine"]);
const HTML_TYPES = new Set(["htmlFlow", "htmlText"]);
const HTML_HEADING_TAG_PATTERN = /<h([1-6])(?=[\s/>])/gi;

// Matches markdownlint's reading of a heading token: setext `===` is level 1, setext `---`
// is level 2, and ATX `###` is level 3.
function levelOf(heading: Token): number {
  const sequenceToken = heading.children.find((child) => SEQUENCE_TYPES.has(child.type));

  if (!sequenceToken || sequenceToken.text.startsWith("=")) {
    return 1;
  }

  if (sequenceToken.text.startsWith("-")) {
    return 2;
  }

  return Math.min(sequenceToken.text.length, 6);
}

function* elementHeadingsIn(htmlToken: Token): Generator<Heading> {
  for (const match of htmlToken.text.matchAll(HTML_HEADING_TAG_PATTERN)) {
    const lineOffset = htmlToken.text.slice(0, match.index).split("\n").length - 1;
    yield { lineNumber: htmlToken.startLine + lineOffset, level: Number(match[1]), isElement: true };
  }
}

// Walks the token tree rather than the raw lines so that a `#` or a `<h4>` inside a fenced or
// indented block, or in inline code, is not mistaken for a heading. Headings nest inside block
// quotes and list items.
function* headingsIn(tokens: Array<Token>): Generator<Heading> {
  for (const token of tokens) {
    if (HEADING_TYPES.has(token.type)) {
      yield { lineNumber: token.startLine, level: levelOf(token), isElement: false };
    } else if (HTML_TYPES.has(token.type)) {
      yield* elementHeadingsIn(token);
    } else if (token.children.length > 0) {
      yield* headingsIn(token.children);
    }
  }
}

const headingLevelsRule: Rule = {
  names: ["heading-levels"],
  description: "Headings should use only the levels the content styles support",
  tags: ["headings"],
  parser: "micromark",
  function: (params, onError) => {
    const config = params.config as { minimum?: number; maximum?: number }; // `config` is the rule's own entry in `.markdownlint-cli2.jsonc`, typed as `any`.
    const minimumLevel = config.minimum ?? DEFAULT_MINIMUM_LEVEL;
    const maximumLevel = config.maximum ?? DEFAULT_MAXIMUM_LEVEL;

    for (const { lineNumber, level, isElement } of headingsIn(params.parsers.micromark.tokens)) {
      if (level < minimumLevel || level > maximumLevel) {
        onError({
          lineNumber,
          detail: `Expected h${minimumLevel} to h${maximumLevel}, found ${isElement ? `an <h${level}> element` : `h${level}`}`,
        });
      }
    }
  },
};

export default headingLevelsRule;
