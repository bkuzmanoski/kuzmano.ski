import postcss from "postcss";

import type { Rule } from "postcss";

/**
 * Returns custom properties declared directly in top-level `:root` rules.
 *
 * Later declarations override earlier ones. Ignores conditional and nested rules,
 * and throws if no top-level `:root` rule is found.
 */
export function rootCustomPropertiesIn(css: string, source: string): Map<string, string> {
  const properties = new Map<string, string>();
  const stylesheetRoot = postcss.parse(css, { from: source });
  const rootRules = stylesheetRoot.nodes.filter(
    (node): node is Rule => node.type === "rule" && node.selector === ":root",
  );

  if (rootRules.length === 0) {
    throw new Error(`No \`:root\` block found in ${source}.`);
  }

  for (const node of rootRules.flatMap((rule) => rule.nodes)) {
    if (node.type === "decl" && node.prop.startsWith("--")) {
      properties.set(node.prop, node.value);
    }
  }

  return properties;
}
