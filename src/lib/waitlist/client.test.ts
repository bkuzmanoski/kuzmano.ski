import { beforeEach, expect, test, vi } from "vitest";

import { API_ROUTES } from "#/api-routes.ts";
import { jsonBodyOfFirstRequest, respondWith } from "#/test-utils/fetch.ts";

import { joinWaitlist } from "./client.ts";

import type { Membership } from "./membership.ts";

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

test("the submission is posted as JSON to the endpoint", async () => {
  respondWith(fetchMock, 204);
  await joinWaitlist(SUBMISSION);

  const [url, init] = fetchMock.mock.calls[0]!;

  expect(url).toBe(API_ROUTES.waitlist);
  expect(init?.method).toBe("POST");
  expect(jsonBodyOfFirstRequest(fetchMock)).toEqual(SUBMISSION);
});

test.each([204, 200])("a %i response is treated as a recorded membership", async (status) => {
  respondWith(fetchMock, status);
  await expect(joinWaitlist(SUBMISSION)).resolves.toEqual({ status: "joined" });
});

test.each([
  [403, /couldn’t be joined/],
  [429, /too many lists/],
  [502, /couldn’t be joined/],
])("a %i response is treated as a failure with a message", async (status, message) => {
  respondWith(fetchMock, status);
  await expect(joinWaitlist(SUBMISSION)).resolves.toMatchObject({ status: "failed", message });
});

test("a network error is treated as a failure rather than thrown", async () => {
  fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
  await expect(joinWaitlist(SUBMISSION)).resolves.toMatchObject({ status: "failed" });
});

test("a 400 response is treated as an invalid submission with the field errors returned by the endpoint", async () => {
  respondWith(fetchMock, 400, { errors: { emailAddress: "That doesn’t look like an email address." } });

  await expect(joinWaitlist(SUBMISSION)).resolves.toEqual({
    status: "invalid",
    errors: { emailAddress: "That doesn’t look like an email address." },
  });
});

test("the abort signal is passed to the request", async () => {
  respondWith(fetchMock, 204);

  const controller = new AbortController();

  await joinWaitlist(SUBMISSION, controller.signal);

  expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);
});
