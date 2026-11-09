import { expect, test } from "vitest";

import { CONTENT_COMPONENTS, contentComponentNamesWhere, contentComponentOf } from "./content-components.ts";

test("`contentComponentOf` returns the facts of a listed component", () => {
  expect(contentComponentOf("Callout")).toBe(CONTENT_COMPONENTS.Callout);
});

test.each([
  ["an unlisted name", "Unlisted"],
  ["an inherited property of an object", "toString"],
  ["`null`", null],
])("`contentComponentOf` returns `undefined` for %s", (_label, name) => {
  expect(contentComponentOf(name)).toBeUndefined();
});

test("`contentComponentNamesWhere` returns the names of the components the predicate accepts, in listed order", () => {
  expect(contentComponentNamesWhere(({ childContent }) => childContent !== undefined)).toEqual([
    "ImageGallery",
    "ImageRow",
  ]);
});
