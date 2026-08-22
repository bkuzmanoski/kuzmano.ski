import { describe, expect, test } from "vitest";

import { emailAddress, firstError, isEmailAddress, maxLength, required, validate } from "./validation";

import type { Schema } from "./validation";

describe("required", () => {
  const rule = required("Required.");

  test("rejects an empty or whitespace-only value", () => {
    expect(rule("")).toBe("Required.");
    expect(rule("   \n\t ")).toBe("Required.");
  });

  test("accepts any non-empty value", () => {
    expect(rule("a")).toBeNull();
  });
});

describe("maxLength", () => {
  const rule = maxLength(3, "Too long.");

  test("counts whitespace as part of the value", () => {
    expect(rule("abc")).toBeNull();
    expect(rule("abcd")).toBe("Too long.");
    expect(rule("  a")).toBeNull();
  });
});

describe("isEmailAddress", () => {
  test.each([
    "a@b.co",
    "test@kuzmano.ski",
    "first.last@example.com",
    "plus+addressing@example.co.nz",
    "tag_underscore-hyphen@sub.domain.example",
    "  padded@example.com  ",
  ])('accepts "%j"', (value) => {
    expect(isEmailAddress(value)).toBe(true);
  });

  test.each([
    "",
    "no-at-sign",
    "@example.com",
    "missing-domain@",
    "no-tld@example",
    "trailing-dot@example.com.",
    "double..dot@example.com",
    "spaces in@example.com",
    "with,comma@example.com",
    "newline@example.com\nBcc: someone@else.com", // The shape a header injection would take.
    "hyphen@-example.com",
  ])('rejects "%j"', (value) => {
    expect(isEmailAddress(value)).toBe(false);
  });

  test("rejects an address that exceeds SMTP's maximum length", () => {
    const label = `${"b".repeat(60)}.`;

    expect(isEmailAddress(`${"a".repeat(64)}@${label.repeat(2)}com`)).toBe(true); // 190 characters.
    expect(isEmailAddress(`${"a".repeat(64)}@${label.repeat(4)}com`)).toBe(false); // 312 characters.
  });

  test("rejects a domain label longer than 63 characters", () => {
    expect(isEmailAddress(`a@${"b".repeat(64)}.com`)).toBe(false);
  });

  test("rejects a local part longer than 64 characters", () => {
    expect(isEmailAddress(`${"a".repeat(65)}@example.com`)).toBe(false);
  });
});

describe("emailAddress", () => {
  const rule = emailAddress("Not an address.");

  test("allows an empty value, leaving emptiness for `required` to report", () => {
    expect(rule("")).toBeNull();
    expect(rule("nope")).toBe("Not an address.");
  });
});

describe("firstError", () => {
  test("reports one reason at a time, in the order the rules are defined", () => {
    const rules = [required("Required."), maxLength(2, "Too long.")];

    expect(firstError(rules, "")).toBe("Required.");
    expect(firstError(rules, "abc")).toBe("Too long.");
    expect(firstError(rules, "ab")).toBeNull();
  });
});

describe("validate", () => {
  interface Fields {
    name: string;
    email: string;
  }

  const schema: Schema<Fields> = {
    name: [required("Enter a name.")],
    email: [required("Enter an address."), emailAddress("Not an address.")],
  };

  test("reports the first failure for every invalid field", () => {
    expect(validate(schema, { name: "", email: "nope" })).toEqual({
      name: "Enter a name.",
      email: "Not an address.",
    });
  });

  test("omits valid fields, so an empty result means valid", () => {
    expect(validate(schema, { name: "Test", email: "test@example.com" })).toEqual({});
  });
});
