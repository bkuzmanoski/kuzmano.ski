import { describe, expect, test, vi } from "vitest";

import { readAuthoredContent } from "./authored-content.ts";
import { listedEntriesIn } from "./listing.ts";

const { readFileSync } = vi.hoisted(() => ({ readFileSync: vi.fn<(path: string, encoding: "utf8") => string>() }));

vi.mock("node:fs", () => ({ default: { readFileSync }, readFileSync }));

const collectionDirectory = { directoryName: "collection", fileNames: ["entry.mdx"], fileNamesBySubdirectoryName: {} };

describe("readAuthoredContent", () => {
  test("returns each listed entry with its frontmatter, and the draft flag and date from that frontmatter", () => {
    readFileSync.mockReturnValue("---\ntitle: A title\ndate: 2026-07-19\ndraft: true\n---\n");
    expect(readAuthoredContent([collectionDirectory]).collections[0]?.entries).toEqual([
      {
        ...listedEntriesIn(collectionDirectory)[0],
        frontmatter: { title: "A title", date: "2026-07-19", draft: true },
        draft: true,
        date: "2026-07-19",
      },
    ]);
  });

  test("returns an entry without a frontmatter block as published, with `null` frontmatter and an `undefined` date", () => {
    readFileSync.mockReturnValue("A body.\n");
    expect(readAuthoredContent([collectionDirectory]).collections[0]?.entries[0]).toMatchObject({
      frontmatter: null,
      draft: false,
      date: undefined,
    });
  });
});
