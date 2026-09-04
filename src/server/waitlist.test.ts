import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { SITE_URL } from "#/config/site.ts";
import type { Membership } from "#/lib/waitlist/membership.ts";

import { NOTION_TOKEN_BINDING, WAITLIST_DATA_SOURCE_BINDING } from "./bindings.ts";
import { recordMembership } from "./waitlist.ts";

const env = vi.hoisted(() => ({ current: {}, fails: false }));

vi.mock("./env.ts", () => ({
  workerEnv: () => (env.fails ? Promise.reject(new Error("No bindings.")) : Promise.resolve(env.current)),
}));

const TOKEN = "notion-token";
const DATA_SOURCE_ID = "data-source-id";
const MEMBERSHIP: Membership = { emailAddress: "user@example.com", list: "List", source: "/collection/entry" };

const fetchMock = vi.fn<typeof fetch>();

// The module makes up to two requests: it looks the email address up, then writes the row.
const lookupCall = () => fetchMock.mock.calls[0]!;
const writeCall = () => fetchMock.mock.calls[1]!;
const bodyOf = (call: Parameters<typeof fetch>) => JSON.parse(call[1]?.body as string) as Record<string, unknown>;

const respondToLookup = (results: Array<unknown>) => {
  fetchMock.mockResolvedValueOnce(Response.json({ results }));
};
const respondToWrite = (status: number) => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status }));
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  respondToLookup([]);
  respondToWrite(200);
  env.fails = false;
  env.current = { [NOTION_TOKEN_BINDING]: TOKEN, [WAITLIST_DATA_SOURCE_BINDING]: DATA_SOURCE_ID };
  vi.spyOn(console, "error").mockReturnValue();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("a membership is written to the configured data source", async () => {
  await expect(recordMembership(MEMBERSHIP)).resolves.toBe("recorded");

  const [url, request] = writeCall();

  expect(url).toBe("https://api.notion.com/v1/pages");
  expect(request?.method).toBe("POST");
  expect(bodyOf(writeCall())).toEqual({
    parent: { type: "data_source_id", data_source_id: DATA_SOURCE_ID },
    properties: {
      Email: { title: [{ text: { content: MEMBERSHIP.emailAddress } }] },
      List: { rich_text: [{ text: { content: MEMBERSHIP.list } }] },
      Source: { url: `${SITE_URL}${MEMBERSHIP.source}` },
    },
  });
});

test("every request includes the token and the pinned API version", async () => {
  await recordMembership(MEMBERSHIP);

  for (const [, request] of fetchMock.mock.calls) {
    expect(request?.headers).toMatchObject({
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      "notion-version": expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as string,
    });
  }
});

test("the address is looked up on its own waitlist before it is written", async () => {
  await recordMembership(MEMBERSHIP);

  const [url] = lookupCall();

  expect(url).toBe(`https://api.notion.com/v1/data_sources/${DATA_SOURCE_ID}/query`);
  expect(bodyOf(lookupCall())).toMatchObject({
    filter: {
      and: [
        { property: "Email", title: { equals: MEMBERSHIP.emailAddress } },
        { property: "List", rich_text: { equals: MEMBERSHIP.list } },
      ],
    },
  });
});

test("an address already on the list is recorded without writing a second row", async () => {
  fetchMock.mockReset();
  respondToLookup([{ object: "page", id: "an-existing-row" }]);

  await expect(recordMembership(MEMBERSHIP)).resolves.toBe("recorded");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each([
  ["fails", () => fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))],
  ["throws", () => fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))],
  ["responds with a body that is not JSON", () => fetchMock.mockResolvedValueOnce(new Response("nope"))],
])("the membership is written when the lookup %s", async (_label, arrangeLookup) => {
  fetchMock.mockReset();
  arrangeLookup();
  respondToWrite(200);

  await expect(recordMembership(MEMBERSHIP)).resolves.toBe("recorded");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test.each([
  [429, "throttled"],
  [529, "throttled"],
  [400, "unavailable"],
  [401, "unavailable"],
  [404, "unavailable"],
  [500, "unavailable"],
])("a %i response from Notion produces %s", async (status, result) => {
  fetchMock.mockReset();
  respondToLookup([]);
  respondToWrite(status);

  await expect(recordMembership(MEMBERSHIP)).resolves.toBe(result);
  expect(console.error).toHaveBeenCalled();
});

test("a write that throws responds with unavailable", async () => {
  fetchMock.mockReset();
  respondToLookup([]);
  fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

  await expect(recordMembership(MEMBERSHIP)).resolves.toBe("unavailable");
});

test.each([
  ["token", { [WAITLIST_DATA_SOURCE_BINDING]: DATA_SOURCE_ID }, NOTION_TOKEN_BINDING],
  ["data source", { [NOTION_TOKEN_BINDING]: TOKEN }, WAITLIST_DATA_SOURCE_BINDING],
])("a missing %s binding is reported without a request to Notion", async (_label, partial, binding) => {
  env.current = partial;

  await expect(recordMembership(MEMBERSHIP)).resolves.toBe("unavailable");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ binding }));
});

test("an unreachable Workers environment responds with unavailable", async () => {
  env.fails = true;

  await expect(recordMembership(MEMBERSHIP)).resolves.toBe("unavailable");
  expect(fetchMock).not.toHaveBeenCalled();
});
