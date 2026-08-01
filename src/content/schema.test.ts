import { describe, expect, test } from "vitest";

import { parseFrontmatter } from "./schema";

const VALID_FRONTMATTER = { title: "Title", description: "Description", date: "2026-07-30" };

describe("parseFrontmatter", () => {
  test("accepts the required fields", () => {
    expect(parseFrontmatter(VALID_FRONTMATTER, "id")).toEqual({
      ...VALID_FRONTMATTER,
      category: undefined,
      draft: undefined,
    });
  });

  test("keeps a category when it is present", () => {
    expect(parseFrontmatter({ ...VALID_FRONTMATTER, category: "CSS" }, "id").category).toBe("CSS");
  });

  test("leaves the category undefined when it is absent", () => {
    expect(parseFrontmatter(VALID_FRONTMATTER, "id").category).toBeUndefined();
  });

  test("rejects a non-string category", () => {
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, category: 7 }, "id")).toThrow(/category/);
  });

  test("keeps the draft flag", () => {
    expect(parseFrontmatter({ ...VALID_FRONTMATTER, draft: true }, "id").draft).toBe(true);
  });

  test("rejects a non-boolean draft", () => {
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, draft: "yes" }, "id")).toThrow(/draft/);
  });

  test("rejects a missing frontmatter block", () => {
    expect(() => parseFrontmatter(null, "id")).toThrow(/frontmatter block/);
    expect(() => parseFrontmatter(undefined, "id")).toThrow(/frontmatter block/);
  });

  test("rejects a missing title or description", () => {
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, title: "" }, "id")).toThrow(/title/);
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, description: undefined }, "id")).toThrow(/description/);
  });

  test("rejects a date that is not ISO", () => {
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, date: "last tuesday" }, "id")).toThrow(/ISO date/);
  });

  test("names the entry in the message", () => {
    expect(() => parseFrontmatter(null, "./tech-notes/test.mdx")).toThrow(/\.\/tech-notes\/test\.mdx/);
  });
});
