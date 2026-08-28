import { describe, expect, test } from "vitest";

import { cx } from "./class-names";

describe("cx", () => {
  test("joins the values it is given", () => {
    expect(cx("one", "two", "three")).toBe("one two three");
  });

  test("drops falsy values without leaving stray separators", () => {
    expect(cx("one", false, null, undefined, "", 0, "two")).toBe("one two");
  });

  test("keeps a conditional class only while its condition holds", () => {
    const isActive = (name: string) => name === "two";
    expect(cx("one", isActive("two") && "two", isActive("three") && "three")).toBe("one two");
  });

  test("returns an empty string when given no arguments or only falsy values", () => {
    expect(cx()).toBe("");
    expect(cx(false, null, undefined)).toBe("");
  });

  test("flattens arrays to any depth", () => {
    expect(cx(["one", ["two", [false, "three"]]], "four")).toBe("one two three four");
  });

  test("takes the truthy keys of an object", () => {
    expect(cx({ one: true, two: 0, three: "yes", four: undefined })).toBe("one three");
  });

  test("mixes every form in one call", () => {
    expect(cx("one", ["two", { three: true, four: false }], { five: 1 })).toBe("one two three five");
  });

  test("renders numbers", () => {
    expect(cx(1, ["2"])).toBe("1 2");
  });

  test("ignores a bare boolean", () => {
    expect(cx(true, "one")).toBe("one");
  });
});
