import { CONTINUE, visit } from "unist-util-visit";

import { quotedEntryPathOf } from "./tree.ts";

import type { EntryVFile } from "./tree.ts";
import type { Root } from "hast";

interface CodeFenceAttributeSpec {
  valuePattern: RegExp;
  valueDescription: string; // Completes the "Expected …" message when `valuePattern` rejects a value.
  preAttributeName: `data-${string}`; // The `<pre>` attribute that `rehypeCodeFenceAttributes` assigns this value to.
}

const CODE_FENCE_ATTRIBUTE_SPECS = {
  gist: {
    valuePattern: /^[0-9a-f]+$/,
    valueDescription: "a gist ID of lowercase hexadecimal digits",
    preAttributeName: "data-gist-id", // `CodeBlock` uses this to link to the gist (see `/src/features/content/code-block.tsx`).
  },
} satisfies Record<string, CodeFenceAttributeSpec>;

export type CodeFenceAttributeName = keyof typeof CODE_FENCE_ATTRIBUTE_SPECS;
export type CodeFenceAttributes = ReadonlyMap<CodeFenceAttributeName, string>;

const isCodeFenceAttributeName = (name: string): name is CodeFenceAttributeName =>
  Object.hasOwn(CODE_FENCE_ATTRIBUTE_SPECS, name);

/**
 * Parses a code fence's meta string into supported `name=value` or `name="value"` attributes, in authored order.
 *
 * Returns an empty map when no meta string is provided. Throws if the syntax is invalid, an attribute is
 * unsupported or repeated, or a value fails its attribute's validation, naming the entry in `file`.
 */
export function codeFenceAttributesIn(meta: string | null | undefined, file: EntryVFile): CodeFenceAttributes {
  const attributePattern = /\s*(?<name>[A-Za-z][\w-]*)=(?<value>"[^"]*"|[^\s"]+)\s*/y; // Matches one `name=value` or `name="value"` pair at the sticky position, with the whitespace around it.
  const attributes = new Map<CodeFenceAttributeName, string>();
  const trimmedMeta = meta?.trim() ?? "";

  while (attributePattern.lastIndex < trimmedMeta.length) {
    const position = attributePattern.lastIndex;
    const match = attributePattern.exec(trimmedMeta);

    if (match?.groups === undefined) {
      throw new Error(
        `${quotedEntryPathOf(file)} has a code fence with "${trimmedMeta.slice(position)}" in its meta string. Expected \`name=value\` or \`name="value"\` pairs.`,
      );
    }

    const { name, value: authoredValue } = match.groups as { name: string; value: string }; // The pattern requires both groups.
    const value = authoredValue.startsWith('"') ? authoredValue.slice(1, -1) : authoredValue;

    if (!isCodeFenceAttributeName(name)) {
      throw new Error(
        `${quotedEntryPathOf(file)} has a code fence that sets the attribute "${name}". Expected one of: ${Object.keys(CODE_FENCE_ATTRIBUTE_SPECS).join(", ")}.`,
      );
    }

    if (attributes.has(name)) {
      throw new Error(
        `${quotedEntryPathOf(file)} has a code fence that sets the attribute \`${name}\` more than once.`,
      );
    }

    const { valuePattern, valueDescription } = CODE_FENCE_ATTRIBUTE_SPECS[name];

    if (!valuePattern.test(value)) {
      throw new Error(
        `${quotedEntryPathOf(file)} has a code fence that sets \`${name}\` to "${value}". Expected ${valueDescription}.`,
      );
    }

    attributes.set(name, value);
  }

  return attributes;
}

/** Validates supported code-fence meta attributes and applies them to each `<pre>`. */
export function rehypeCodeFenceAttributes() {
  return function transform(tree: Root, file: EntryVFile) {
    visit(tree, "element", (element) => {
      const [code] = element.children;

      if (element.tagName !== "pre" || code?.type !== "element" || code.tagName !== "code") {
        return CONTINUE;
      }

      for (const [name, value] of codeFenceAttributesIn(code.data?.meta, file)) {
        element.properties[CODE_FENCE_ATTRIBUTE_SPECS[name].preAttributeName] = value;
      }

      return CONTINUE;
    });
  };
}
