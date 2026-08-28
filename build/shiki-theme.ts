import type { RehypeShikiOptions } from "@shikijs/rehype";

type ThemeRegistration = Exclude<Extract<RehypeShikiOptions, { theme?: unknown }>["theme"], string>;

const syntax = (role: string) => `var(--color-${role}-syntax)`;

export const shikiTheme: ThemeRegistration = {
  name: "kuzmano-ski",
  type: "light",
  colors: {
    "editor.foreground": syntax("foreground"),
    "editor.background": syntax("background"),
  },
  tokenColors: [
    {
      scope: ["meta.embedded", "source.groovy.embedded"],
      settings: { foreground: syntax("foreground"), fontStyle: "" },
    },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: syntax("comment"), fontStyle: "italic" },
    },
    {
      scope: ["meta.tag.sgml.doctype", "meta.diff.header", "meta.preprocessor", "entity.name.function.preprocessor"],
      settings: { foreground: syntax("comment") },
    },
    {
      scope: [
        "keyword",
        "storage",
        "variable.language",
        "keyword.operator.new",
        "keyword.operator.expression",
        "support.other",
        "punctuation.definition.keyword",
      ],
      settings: { foreground: syntax("keyword") },
    },
    {
      scope: [
        "entity.name.function",
        "support.function",
        "variable.function",
        "keyword.other.special-method",
        "storage.type.method",
      ],
      settings: { foreground: syntax("function") },
    },
    {
      scope: [
        "entity.name.variable.property",
        "meta.object-literal.key",
        "meta.object.member",
        "meta.property.object",
        "support.type.property.name",
        "support.variable.property",
        "variable.object.property",
        "variable.other.constant.property",
        "variable.other.member",
        "variable.other.object.property",
        "variable.other.property",
      ],
      settings: { foreground: syntax("property") },
    },
    {
      scope: ["entity.name.type", "entity.other.inherited-class", "support.class", "support.type"],
      settings: { foreground: syntax("type") },
    },
    {
      scope: ["variable", "meta.import constant", "support.variable"],
      settings: { foreground: syntax("foreground") },
    },
    {
      scope: ["constant", "support.constant", "meta.preprocessor.numeric", "constant.other.color punctuation"],
      settings: { foreground: syntax("constant") },
    },
    {
      scope: ["string", "constant.character", "markup.raw", "markup.inline.raw", "meta.preprocessor.string"],
      settings: { foreground: syntax("string") },
    },
    {
      scope: ["string.regexp"],
      settings: { foreground: syntax("type") },
    },
    {
      scope: ["string.unquoted.argument"],
      settings: { foreground: syntax("foreground") },
    },
    {
      scope: ["keyword.operator"],
      settings: { foreground: syntax("foreground") },
    },
    {
      scope: [
        "keyword.operator.type.annotation",
        "meta.tag.attributes keyword.operator.assignment",
        "keyword.operator.assignment.shell",
      ],
      settings: { foreground: syntax("punctuation") },
    },
    {
      scope: ["punctuation", "meta.brace", "constant.character.escape"],
      settings: { foreground: syntax("punctuation") },
    },
    {
      scope: [
        "punctuation.definition.template-expression.begin",
        "punctuation.definition.template-expression.end",
        "punctuation.section.embedded",
        "punctuation.definition.subshell",
        "punctuation.definition.variable.shell",
      ],
      settings: { foreground: syntax("keyword") },
    },
    {
      scope: ["entity.name.type.module", "support.type.property-name"],
      settings: { foreground: syntax("foreground") },
    },
    {
      scope: ["invalid"],
      settings: { foreground: syntax("invalid") },
    },
    {
      scope: [
        "entity.name.tag",
        "entity.name.nesting.css",
        "entity.other.attribute-name.class.css",
        "entity.other.attribute-name.id.css",
        "punctuation.definition.tag",
        "punctuation.definition.entity",
      ],
      settings: { foreground: syntax("keyword") },
    },
    {
      scope: [
        "meta.selector.pseudo-class",
        "meta.selector.pseudo-element",
        "meta.selector.pseudo-class punctuation.definition.entity",
        "meta.selector.pseudo-element punctuation.definition.entity",
      ],
      settings: { foreground: syntax("punctuation") },
    },
    {
      scope: ["entity.other.keyframe-offset"],
      settings: { foreground: syntax("punctuation") },
    },
    {
      scope: ["keyword.other.unit"],
      settings: { foreground: syntax("constant") },
    },
    {
      scope: ["markup.heading", "markup.bold", "strong"],
      settings: { fontStyle: "bold" },
    },
    {
      scope: ["markup.italic", "emphasis"],
      settings: { fontStyle: "italic" },
    },
    {
      scope: [
        "markup.heading markup.italic",
        "markup.bold markup.italic",
        "markup.italic markup.bold",
        "strong emphasis",
        "emphasis strong",
      ],
      settings: { fontStyle: "italic bold" },
    },
    {
      scope: ["string.other.link", "markup.link"],
      settings: { foreground: syntax("function") },
    },
  ],
};
