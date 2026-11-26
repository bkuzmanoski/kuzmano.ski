import { visit } from "unist-util-visit";
import { describe, expect, test } from "vitest";

import { transformedTreeOf } from "../../test-utils/mdx.ts";

import { elementNameOf, stringAttributeOf } from "./tree.ts";

import type { ContentNode } from "./tree.ts";

async function listRolesIn(source: string): Promise<Array<["ul" | "ol", string | null]>> {
  const transformedTree = await transformedTreeOf(source);
  const listRoles: Array<["ul" | "ol", string | null]> = [];

  visit(transformedTree, (node: ContentNode) => {
    const elementName = elementNameOf(node);

    if (elementName === "ul" || elementName === "ol") {
      listRoles.push([elementName, stringAttributeOf(node, "role")]);
    }
  });

  return listRoles;
}

describe("rehypeListRoles", () => {
  test("sets the `role` attribute of a Markdown list and of a list nested in it to `list`", async () => {
    expect(
      await listRolesIn(`
- An item.
  - A nested item.
`),
    ).toEqual([
      ["ul", "list"],
      ["ul", "list"],
    ]);
  });

  test("sets the `role` attribute of a `<ul>` authored as JSX to `list`", async () => {
    expect(await listRolesIn(`<ul><li>An item.</li></ul>`)).toEqual([["ul", "list"]]);
  });

  test("leaves an authored `role` attribute of a `<ul>` unchanged", async () => {
    expect(await listRolesIn(`<ul role="tablist"><li>An item.</li></ul>`)).toEqual([["ul", "tablist"]]);
  });

  test("leaves an `<ol>` without the `role` attribute", async () => {
    expect(await listRolesIn(`1. An item.`)).toEqual([["ol", null]]);
  });
});
