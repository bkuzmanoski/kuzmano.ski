import { describe, expect, test } from "vitest";

import { parseFrontmatter } from "./frontmatter.ts";

const VALID_FRONTMATTER = { title: "Title", description: "Description", date: "2026-07-30" };

describe("parseFrontmatter", () => {
  test("accepts the required fields", () => {
    expect(parseFrontmatter(VALID_FRONTMATTER, "path")).toEqual({
      ...VALID_FRONTMATTER,
      category: undefined,
      draft: undefined,
    });
  });

  test("keeps a category when it is present", () => {
    expect(parseFrontmatter({ ...VALID_FRONTMATTER, category: "Category" }, "path").category).toBe("Category");
  });

  test("leaves the category undefined when it is absent", () => {
    expect(parseFrontmatter(VALID_FRONTMATTER, "path").category).toBeUndefined();
  });

  test("rejects a non-string category", () => {
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, category: 7 }, "path")).toThrow(/category/);
  });

  test("keeps the draft flag", () => {
    expect(parseFrontmatter({ ...VALID_FRONTMATTER, draft: true }, "path").draft).toBe(true);
  });

  test("rejects a non-boolean draft", () => {
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, draft: "yes" }, "path")).toThrow(/draft/);
  });

  test("rejects a missing frontmatter block", () => {
    expect(() => parseFrontmatter(null, "path")).toThrow(/frontmatter block/);
    expect(() => parseFrontmatter(undefined, "path")).toThrow(/frontmatter block/);
  });

  test("rejects a missing title or description", () => {
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, title: "" }, "path")).toThrow(/title/);
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, description: undefined }, "path")).toThrow(/description/);
  });

  test("accepts an ISO calendar date", () => {
    expect(parseFrontmatter({ ...VALID_FRONTMATTER, date: "2028-02-29" }, "path").date).toBe("2028-02-29");
  });

  test("rejects a date that is not ISO", () => {
    for (const date of ["last tuesday", "2026/08/19", "Aug 19 2026", "08/19/2026", "2026-8-9"]) {
      expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, date }, "path")).toThrow(/ISO date/);
    }
  });

  test("rejects a date that does not exist on the calendar", () => {
    for (const date of ["2026-02-30", "2026-13-01", "2026-00-10"]) {
      expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, date }, "path")).toThrow(/ISO date/);
    }
  });

  test("rejects a date with a time component", () => {
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, date: "2026-08-19T10:00:00Z" }, "path")).toThrow(/ISO date/);
  });

  test("names the entry in the message", () => {
    expect(() => parseFrontmatter(null, "./collection/entry.mdx")).toThrow(/\.\/collection\/entry\.mdx/);
  });
});
