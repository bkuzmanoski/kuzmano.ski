import { describe, expect, test } from "vitest";

import { parseFrontmatter } from "./schema";

const VALID_FRONTMATTER = { title: "Title", description: "Description", date: "2026-07-30" };

describe("parseFrontmatter", () => {
  test("accepts the required fields", () => {
    expect(parseFrontmatter(VALID_FRONTMATTER, "test-path")).toEqual({
      ...VALID_FRONTMATTER,
      category: undefined,
      draft: undefined,
    });
  });

  test("keeps a category when it is present", () => {
    expect(parseFrontmatter({ ...VALID_FRONTMATTER, category: "CSS" }, "test-path").category).toBe("CSS");
  });

  test("leaves the category undefined when it is absent", () => {
    expect(parseFrontmatter(VALID_FRONTMATTER, "test-path").category).toBeUndefined();
  });

  test("rejects a non-string category", () => {
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, category: 7 }, "test-path")).toThrow(/category/);
  });

  test("keeps the draft flag", () => {
    expect(parseFrontmatter({ ...VALID_FRONTMATTER, draft: true }, "test-path").draft).toBe(true);
  });

  test("rejects a non-boolean draft", () => {
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, draft: "yes" }, "test-path")).toThrow(/draft/);
  });

  test("rejects a missing frontmatter block", () => {
    expect(() => parseFrontmatter(null, "test-path")).toThrow(/frontmatter block/);
    expect(() => parseFrontmatter(undefined, "test-path")).toThrow(/frontmatter block/);
  });

  test("rejects a missing title or description", () => {
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, title: "" }, "test-path")).toThrow(/title/);
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, description: undefined }, "test-path")).toThrow(
      /description/,
    );
  });

  test("accepts an ISO calendar date", () => {
    expect(parseFrontmatter({ ...VALID_FRONTMATTER, date: "2028-02-29" }, "test-path").date).toBe("2028-02-29");
  });

  test("rejects a date that is not ISO", () => {
    for (const date of ["last tuesday", "2026/08/19", "Aug 19 2026", "08/19/2026", "2026-8-9"]) {
      expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, date }, "test-path")).toThrow(/ISO date/);
    }
  });

  test("rejects a date that does not exist on the calendar", () => {
    for (const date of ["2026-02-30", "2026-13-01", "2026-00-10"]) {
      expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, date }, "test-path")).toThrow(/ISO date/);
    }
  });

  test("rejects a date carrying a time component", () => {
    expect(() => parseFrontmatter({ ...VALID_FRONTMATTER, date: "2026-08-19T10:00:00Z" }, "test-path")).toThrow(
      /ISO date/,
    );
  });

  test("names the entry in the message", () => {
    expect(() => parseFrontmatter(null, "./tech-notes/test.mdx")).toThrow(/\.\/tech-notes\/test\.mdx/);
  });
});
