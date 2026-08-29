import { describe, expect, test } from "vitest";

import { assertWellFormedXml } from "./xml.ts";

const FEED = '<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">';

describe("assertWellFormedXml", () => {
  test("accepts a well formed XML document", async () => {
    await expect(
      assertWellFormedXml(`${FEED}<title>Lorem &amp; Ipsum</title></feed>`, "/feed.xml"),
    ).resolves.toBeUndefined();
  });

  test("rejects an unescaped entity", async () => {
    await expect(assertWellFormedXml(`${FEED}<title>Lorem & Ipsum</title></feed>`, "/feed.xml")).rejects.toThrow(
      '"/feed.xml" is not well-formed XML',
    );
  });

  test("rejects an unclosed element", async () => {
    await expect(assertWellFormedXml(`${FEED}<title>Lorem Ipsum</feed>`, "/feed.xml")).rejects.toThrow(
      '"/feed.xml" is not well-formed XML',
    );
  });

  test("rejects a character XML does not allow", async () => {
    await expect(
      assertWellFormedXml(`${FEED}<title>Lorem${String.fromCharCode(12)} Ipsum</title></feed>`, "/feed.xml"),
    ).rejects.toThrow('"/feed.xml" is not well-formed XML');
  });
});
