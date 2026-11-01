import { describe, expect, test } from "vitest";

import { MESSAGE_MAX_LENGTH } from "#/lib/contact/message.ts";
import { MAX_EMAIL_ADDRESS_LENGTH } from "#/lib/forms/validation.ts";
import { LIST_MAX_LENGTH, SOURCE_MAX_LENGTH } from "#/lib/waitlist/membership.ts";

import { MAX_BODY_LENGTH, exceedsMaxLength, isSameOrigin, isSameOriginFetch } from "./request.ts";

const ORIGIN = "https://example.com";
const ENDPOINT_URL = `${ORIGIN}/api/endpoint`;

/**
 * This character maximizes UTF-8 bytes within the form field limits, since it uses one UTF-16 code unit (the unit the
 * limits count) and three UTF-8 bytes (the unit the body guard counts). Four-byte characters use two UTF-16 code units,
 * so they produce fewer bytes per allowed code unit.
 */
const WIDEST_CHARACTER = "\u6f22";

const post = (headers: HeadersInit = {}) => new Request(ENDPOINT_URL, { method: "POST", headers });

const byteLength = (value: string) => new TextEncoder().encode(value).length;
const fieldOfMaximumLength = (limit: number) => WIDEST_CHARACTER.repeat(limit);
const declaring = (body: string) => post({ "content-length": String(byteLength(body)) });

describe("exceedsMaxLength", () => {
  test("returns `false` for a request that declares the maximum length", () => {
    expect(exceedsMaxLength(post({ "content-length": String(MAX_BODY_LENGTH) }))).toBe(false);
  });

  test("returns `true` for a request that declares one byte over the maximum", () => {
    expect(exceedsMaxLength(post({ "content-length": String(MAX_BODY_LENGTH + 1) }))).toBe(true);
  });

  test("returns `false` for a request that does not declare a content length", () => {
    expect(exceedsMaxLength(post())).toBe(false);
  });

  test.each([
    ["is not a number", "many"],
    ["has a unit", "512 bytes"],
    ["is negative", "-1"],
    ["is fractional", "1.5"],
  ])("returns `true` for a request whose declared content length %s", (_label, contentLength) => {
    expect(exceedsMaxLength(post({ "content-length": contentLength }))).toBe(true);
  });

  test("returns `false` for a body of exactly the maximum length", () => {
    expect(exceedsMaxLength("a".repeat(MAX_BODY_LENGTH))).toBe(false);
  });

  test("returns `true` for a body one byte over the maximum", () => {
    expect(exceedsMaxLength("a".repeat(MAX_BODY_LENGTH + 1))).toBe(true);
  });

  test("measures a body in bytes rather than characters", () => {
    const body = WIDEST_CHARACTER.repeat(MAX_BODY_LENGTH / 3 + 1);

    expect(body.length).toBeLessThan(MAX_BODY_LENGTH);
    expect(exceedsMaxLength(body)).toBe(true);
  });

  // The body guard measures UTF-8 bytes, while field limits measure UTF-16 code units. These tests build each form's
  // largest valid submission and fail if the body cap would reject it with a 413 before validation.
  test("returns `false` for a contact message of the maximum email address and message length", () => {
    const body = JSON.stringify({
      from: fieldOfMaximumLength(MAX_EMAIL_ADDRESS_LENGTH),
      message: fieldOfMaximumLength(MESSAGE_MAX_LENGTH),
    });

    expect(exceedsMaxLength(declaring(body))).toBe(false);
    expect(exceedsMaxLength(body)).toBe(false);
  });

  test("returns `false` for a waitlist membership of the maximum email address, list, and source length", () => {
    const body = JSON.stringify({
      emailAddress: fieldOfMaximumLength(MAX_EMAIL_ADDRESS_LENGTH),
      list: fieldOfMaximumLength(LIST_MAX_LENGTH),
      source: fieldOfMaximumLength(SOURCE_MAX_LENGTH),
    });

    expect(exceedsMaxLength(declaring(body))).toBe(false);
    expect(exceedsMaxLength(body)).toBe(false);
  });
});

describe("isSameOrigin", () => {
  test("returns `true` for a request sent by a page on this site", () => {
    expect(isSameOrigin(post({ origin: ORIGIN }))).toBe(true);
  });

  test.each([
    ["an unrelated site", "https://elsewhere.example"],
    ["a host the real host starts with", "https://example.co"],
    ["a host that ends with the real host", "https://not-example.com"],
    ["a host that extends the real origin", "https://example.com.elsewhere.example"],
  ])("returns `false` for a request sent by %s", (_label, origin) => {
    expect(isSameOrigin(post({ origin }))).toBe(false);
  });

  test("returns `false` for a request that does not declare an origin", () => {
    expect(isSameOrigin(post())).toBe(false);
  });
});

describe("isSameOriginFetch", () => {
  test("returns `true` for a request whose `Sec-Fetch-Site` header identifies it as same-origin", () => {
    expect(isSameOriginFetch(post({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  test.each([
    ["another site", "cross-site"],
    ["a sibling subdomain", "same-site"],
    ["the address bar or a bookmark", "none"],
  ])("returns `false` for a request whose `Sec-Fetch-Site` header identifies it as sent from %s", (_label, site) => {
    expect(isSameOriginFetch(post({ "sec-fetch-site": site }))).toBe(false);
  });

  test("returns `false` for a request that does not declare a `Sec-Fetch-Site` header", () => {
    expect(isSameOriginFetch(post())).toBe(false);
  });
});
