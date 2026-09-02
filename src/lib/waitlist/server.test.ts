import { beforeEach, expect, test, vi } from "vitest";

import { API } from "#/api";

import { joinWaitlist } from "./server";

import type { Membership } from "./membership";

const SUBMISSION: Membership = {
  emailAddress: "user@example.com",
  list: "List",
  source: "/collection/entry",
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

const respond = (status: number, body?: unknown) => {
  fetchMock.mockResolvedValue(body === undefined ? new Response(null, { status }) : Response.json(body, { status }));
};

test("the submission is posted as JSON to the endpoint", async () => {
  respond(204);
  await joinWaitlist(SUBMISSION);

  const [url, init] = fetchMock.mock.calls[0]!;

  expect(url).toBe(API.waitlist);
  expect(init?.method).toBe("POST");
  expect(JSON.parse(init?.body as string)).toEqual(SUBMISSION);
});

test.each([204, 200])("a %i response is treated as a recorded membership", async (status) => {
  respond(status);
  await expect(joinWaitlist(SUBMISSION)).resolves.toEqual({ status: "joined" });
});

test.each([
  [403, /couldn’t be joined/],
  [429, /too many lists/],
  [502, /couldn’t be joined/],
])("a %i response is treated as a failure with a message", async (status, message) => {
  respond(status);
  await expect(joinWaitlist(SUBMISSION)).resolves.toMatchObject({ status: "failed", message });
});

test("a network failure does not throw", async () => {
  fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
  await expect(joinWaitlist(SUBMISSION)).resolves.toMatchObject({ status: "failed" });
});

test("an invalid submission returns the endpoint's field errors", async () => {
  respond(400, { errors: { emailAddress: "That doesn’t look like an email address." } });

  await expect(joinWaitlist(SUBMISSION)).resolves.toEqual({
    status: "invalid",
    errors: { emailAddress: "That doesn’t look like an email address." },
  });
});

test("the abort signal is passed to the request", async () => {
  respond(204);

  const controller = new AbortController();

  await joinWaitlist(SUBMISSION, controller.signal);

  expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);
});
