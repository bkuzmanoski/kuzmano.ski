import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import { EntryCoverImagesContext } from "#/lib/content/entry-cover-images.ts";
import { fakeCollection, fakeCoverImage, fakeEntry } from "#/test-utils/collection.ts";

import { EntryCoverImage } from "./entry-cover-image.tsx";

const COLLECTION = fakeCollection([fakeEntry("entry")]);
const ENTRY_KEY = COLLECTION.entryKeyOf("entry");

test("an entry with a cover image shows its thumbnail, with a `<source>` for each alternate format", () => {
  const coverImage = fakeCoverImage("entry");
  const { container } = render(
    <EntryCoverImagesContext value={{ [ENTRY_KEY]: coverImage }}>
      <EntryCoverImage entryKey={ENTRY_KEY} />
    </EntryCoverImagesContext>,
  );

  expect(container.querySelector("img")?.getAttribute("src")).toBe(coverImage.thumbnail.src);
  expect([...container.querySelectorAll("source")].map((source) => source.getAttribute("srcset"))).toEqual(
    coverImage.thumbnail.alternates.map(({ srcSet }) => srcSet),
  );
});

test("an entry without a cover image shows the placeholder glyph in place of a thumbnail", () => {
  const { container } = render(<EntryCoverImage entryKey={ENTRY_KEY} />);

  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("svg")).not.toBeNull();
});
