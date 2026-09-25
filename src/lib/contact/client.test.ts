import { beforeEach, describe, expect, test, vi } from "vitest";

import { API_ROUTES } from "#/api-routes.ts";
import { jsonBodyOfFirstRequest, respondWith } from "#/test-utils/fetch.ts";

import { CONTACT_EMAIL_ADDRESS_STORAGE_KEY, readContactEmailAddress, sendMessage } from "./client.ts";

import type { ContactFields } from "./message.ts";

const EMAIL_ADDRESS = "inbox@example.com";
const SUBMISSION: ContactFields = {
  from: "test@example.com",
  message: "Hello.",
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

describe("readContactEmailAddress", () => {
  beforeEach(() => {
    respondWith(fetchMock, 200, { emailAddress: EMAIL_ADDRESS });
  });

  test("the email address is read from the contact endpoint", async () => {
    await expect(readContactEmailAddress()).resolves.toBe(EMAIL_ADDRESS);
    expect(fetchMock.mock.calls[0]![0]).toBe(API_ROUTES.contact);
  });

  test("the email address is stored for the session, and a second read does not request it again", async () => {
    await expect(readContactEmailAddress()).resolves.toBe(EMAIL_ADDRESS);
    expect(sessionStorage.getItem(CONTACT_EMAIL_ADDRESS_STORAGE_KEY)).toBe(EMAIL_ADDRESS);
    await expect(readContactEmailAddress()).resolves.toBe(EMAIL_ADDRESS);
    expect(fetchMock).toHaveBeenCalledOnce(); // Reopening the contact window reads the email address again.
  });

  test("an email address already stored for the session is returned without a request", async () => {
    sessionStorage.setItem(CONTACT_EMAIL_ADDRESS_STORAGE_KEY, EMAIL_ADDRESS);

    await expect(readContactEmailAddress()).resolves.toBe(EMAIL_ADDRESS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("the abort signal is passed to the request", async () => {
    const controller = new AbortController();

    await readContactEmailAddress(controller.signal);

    expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);
  });

  test.each([
    ["the request fails", () => fetchMock.mockRejectedValue(new Error("Offline."))],
    ["the endpoint refuses the read", () => respondWith(fetchMock, 403)],
    ["the response is not JSON", () => fetchMock.mockResolvedValue(new Response("nope", { status: 200 }))],
    ["the response has no email address", () => respondWith(fetchMock, 200, {})],
    ["the email address is not a string", () => respondWith(fetchMock, 200, { emailAddress: 42 })],
  ])("`null` is returned, and an email address is not stored for the session, when %s", async (_label, arrange) => {
    arrange();

    await expect(readContactEmailAddress()).resolves.toBeNull();
    expect(sessionStorage.getItem(CONTACT_EMAIL_ADDRESS_STORAGE_KEY)).toBeNull(); // Not cached, so the next open retries.
  });

  test("the email address is returned when session storage throws", async () => {
    const throwDenied = () => {
      throw new Error("Denied.");
    };
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(throwDenied);
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(throwDenied);

    await expect(readContactEmailAddress()).resolves.toBe(EMAIL_ADDRESS);

    setItem.mockRestore();
    getItem.mockRestore();
  });
});

describe("sendMessage", () => {
  test("the submission is posted as JSON to the endpoint", async () => {
    respondWith(fetchMock, 204);
    await sendMessage(SUBMISSION);

    const [url, init] = fetchMock.mock.calls[0]!;

    expect(url).toBe(API_ROUTES.contact);
    expect(init?.method).toBe("POST");
    expect(jsonBodyOfFirstRequest(fetchMock)).toEqual(SUBMISSION);
  });

  test.each([204, 200])("a %i response is treated as a successful send", async (status) => {
    respondWith(fetchMock, status);
    await expect(sendMessage(SUBMISSION)).resolves.toEqual({ status: "sent" });
  });

  test.each([
    [403, /couldn’t be sent/],
    [429, /too many messages/],
    [502, /couldn’t be sent/],
    [503, /couldn’t be sent/],
  ])("a %i response is treated as a failure with a message", async (status, message) => {
    respondWith(fetchMock, status);
    await expect(sendMessage(SUBMISSION)).resolves.toMatchObject({ status: "failed", message });
  });

  test("a network error is treated as a failure rather than thrown", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(sendMessage(SUBMISSION)).resolves.toMatchObject({ status: "failed" });
  });

  test("a 400 response is treated as an invalid submission with the field errors returned by the endpoint", async () => {
    respondWith(fetchMock, 400, { errors: { from: "That doesn’t look like an email address." } });

    await expect(sendMessage(SUBMISSION)).resolves.toEqual({
      status: "invalid",
      errors: { from: "That doesn’t look like an email address." },
    });
  });

  test("the abort signal is passed to the request", async () => {
    respondWith(fetchMock, 204);

    const controller = new AbortController();

    await sendMessage(SUBMISSION, controller.signal);

    expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);
  });
});
