import { beforeEach, expect, test, vi } from "vitest";

import { CONTACT_ENDPOINT, sendMessage } from "./submit";

import type { ContactSubmission } from "./message";

const SUBMISSION: ContactSubmission = {
  from: "test@example.com",
  message: "Hello.",
  website: "",
  elapsedMs: 5_000,
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
  await sendMessage(SUBMISSION);

  const [url, init] = fetchMock.mock.calls[0]!;

  expect(url).toBe(CONTACT_ENDPOINT);
  expect(init?.method).toBe("POST");
  expect(JSON.parse(init?.body as string)).toEqual(SUBMISSION);
});

test.each([204, 200])("a %i response is treated as a successful send", async (status) => {
  respond(status);
  await expect(sendMessage(SUBMISSION)).resolves.toEqual({ status: "sent" });
});

test.each([
  [403, /couldn’t be sent/],
  [429, /too many messages/],
  [502, /couldn’t be sent/],
  [503, /couldn’t be sent/],
])("a %i response is treated as a failure with a message", async (status, message) => {
  respond(status);
  await expect(sendMessage(SUBMISSION)).resolves.toMatchObject({ status: "failed", message });
});

test("a network failure does not throw", async () => {
  fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
  await expect(sendMessage(SUBMISSION)).resolves.toMatchObject({ status: "failed" });
});

test("returns field errors from a rejected submission", async () => {
  respond(400, { errors: { from: "That doesn’t look like an email address." } });

  await expect(sendMessage(SUBMISSION)).resolves.toEqual({
    status: "invalid",
    errors: { from: "That doesn’t look like an email address." },
  });
});

test.each([
  ["a body that is not JSON", () => fetchMock.mockResolvedValue(new Response("nope", { status: 400 }))],
  ["a body with no errors", () => respond(400, { other: true })],
])("%s reports the submission as invalid", async (_label, arrange) => {
  arrange();
  await expect(sendMessage(SUBMISSION)).resolves.toEqual({ status: "invalid", errors: {} });
});

test("passes the abort signal to the request", async () => {
  respond(204);

  const controller = new AbortController();

  await sendMessage(SUBMISSION, controller.signal);

  expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);
});
