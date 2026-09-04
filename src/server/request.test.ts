import { describe, expect, test } from "vitest";

import { MESSAGE_MAX_LENGTH } from "#/lib/contact/message.ts";
import { MAX_EMAIL_ADDRESS_LENGTH } from "#/lib/forms/validation.ts";
import { LIST_MAX_LENGTH, SOURCE_MAX_LENGTH } from "#/lib/waitlist/membership.ts";

import { MAX_BODY_LENGTH, exceedsMaxLength, isSameOrigin, isSameSite } from "./request.ts";

const ORIGIN = "https://example.com";
const URL = `${ORIGIN}/api/endpoint`;

// This character maximizes UTF-8 bytes within the form field limits: it uses one UTF-16 code unit
// (the unit the limits count) and three UTF-8 bytes (the unit the body guard counts). Four-byte
// characters use two UTF-16 code units, so they produce fewer bytes per allowed code unit.
const WIDEST_CHARACTER = "\u6f22";

const post = (headers: HeadersInit = {}) => new Request(URL, { method: "POST", headers });

const byteLength = (value: string) => new TextEncoder().encode(value).length;
const fieldOfMaximumLength = (limit: number) => WIDEST_CHARACTER.repeat(limit);
const declaring = (body: string) => post({ "content-length": String(byteLength(body)) });

describe("exceedsMaxLength", () => {
  test("a request that declares the maximum length is accepted", () => {
    expect(exceedsMaxLength(post({ "content-length": String(MAX_BODY_LENGTH) }))).toBe(false);
  });

  test("a request that declares one byte over the maximum is refused", () => {
    expect(exceedsMaxLength(post({ "content-length": String(MAX_BODY_LENGTH + 1) }))).toBe(true);
  });

  test("a request that declares no content length is measured as empty", () => {
    expect(exceedsMaxLength(post())).toBe(false);
  });

  test.each([
    ["is not a number", "many"],
    ["has a unit", "512 bytes"],
    ["is negative", "-1"],
    ["is fractional", "1.5"],
  ])("a request whose declared content length %s is refused", (_label, contentLength) => {
    expect(exceedsMaxLength(post({ "content-length": contentLength }))).toBe(true);
  });

  test("a body of exactly the maximum length is accepted", () => {
    expect(exceedsMaxLength("a".repeat(MAX_BODY_LENGTH))).toBe(false);
  });

  test("a body one byte over the maximum is refused", () => {
    expect(exceedsMaxLength("a".repeat(MAX_BODY_LENGTH + 1))).toBe(true);
  });

  test("a body is measured in bytes rather than characters", () => {
    const body = WIDEST_CHARACTER.repeat(MAX_BODY_LENGTH / 3 + 1);

    expect(body.length).toBeLessThan(MAX_BODY_LENGTH);
    expect(exceedsMaxLength(body)).toBe(true);
  });
});

describe("isSameOrigin", () => {
  test("a request sent by a page on this site is accepted", () => {
    expect(isSameOrigin(post({ origin: ORIGIN }))).toBe(true);
  });

  test.each([
    ["an unrelated site", "https://elsewhere.example"],
    ["a host the real host starts with", "https://example.co"],
    ["a host that ends with the real host", "https://not-example.com"],
    ["a host that extends the real origin", "https://example.com.elsewhere.example"],
  ])("a request sent by %s is refused", (_label, origin) => {
    expect(isSameOrigin(post({ origin }))).toBe(false);
  });

  test("a request that declares no origin is refused", () => {
    expect(isSameOrigin(post())).toBe(false);
  });
});

describe("isSameSite", () => {
  test("a request the browser labels same-origin is accepted", () => {
    expect(isSameSite(post({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  test.each([
    ["another site", "cross-site"],
    ["a sibling subdomain", "same-site"],
    ["the address bar or a bookmark", "none"],
  ])("a request the browser labels as %s is refused", (_label, site) => {
    expect(isSameSite(post({ "sec-fetch-site": site }))).toBe(false);
  });

  test("a request from a client that sends no fetch metadata is refused", () => {
    expect(isSameSite(post())).toBe(false);
  });
});

// The body guard measures UTF-8 bytes, while field limits measure UTF-16 code units. These tests build each
// form's largest valid submission and fail if the body cap would reject it with a 413 before validation.
describe("the body limit admits every submission the forms accept", () => {
  test("a contact message of the maximum email address and message length is accepted", () => {
    const body = JSON.stringify({
      from: fieldOfMaximumLength(MAX_EMAIL_ADDRESS_LENGTH),
      message: fieldOfMaximumLength(MESSAGE_MAX_LENGTH),
    });

    expect(exceedsMaxLength(declaring(body))).toBe(false);
    expect(exceedsMaxLength(body)).toBe(false);
  });

  test("a waitlist membership of the maximum email address, list and source length is accepted", () => {
    const body = JSON.stringify({
      emailAddress: fieldOfMaximumLength(MAX_EMAIL_ADDRESS_LENGTH),
      list: fieldOfMaximumLength(LIST_MAX_LENGTH),
      source: fieldOfMaximumLength(SOURCE_MAX_LENGTH),
    });

    expect(exceedsMaxLength(declaring(body))).toBe(false);
    expect(exceedsMaxLength(body)).toBe(false);
  });
});
