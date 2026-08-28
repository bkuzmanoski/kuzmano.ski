import { beforeEach, expect, test, vi } from "vitest";

import { CONTACT_EMAIL_ADDRESS_STORAGE_KEY, readContactEmailAddress } from "./address";
import { CONTACT_ENDPOINT } from "./endpoint";

const EMAIL_ADDRESS = "inbox@example.com";

const fetchMock = vi.fn<typeof fetch>();

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse({ emailAddress: EMAIL_ADDRESS }));
});

test("the email address is read from the contact endpoint", async () => {
  await expect(readContactEmailAddress()).resolves.toBe(EMAIL_ADDRESS);
  expect(fetchMock.mock.calls[0]![0]).toBe(CONTACT_ENDPOINT);
});

test("stores the email address for the session so reopening the window does not trigger another request", async () => {
  await expect(readContactEmailAddress()).resolves.toBe(EMAIL_ADDRESS);
  expect(sessionStorage.getItem(CONTACT_EMAIL_ADDRESS_STORAGE_KEY)).toBe(EMAIL_ADDRESS);
  await expect(readContactEmailAddress()).resolves.toBe(EMAIL_ADDRESS);
  expect(fetchMock).toHaveBeenCalledOnce();
});

test("an email address stored by an earlier window is returned without a request", async () => {
  sessionStorage.setItem(CONTACT_EMAIL_ADDRESS_STORAGE_KEY, EMAIL_ADDRESS);

  await expect(readContactEmailAddress()).resolves.toBe(EMAIL_ADDRESS);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("an abort signal is passed to the request", async () => {
  const controller = new AbortController();

  await readContactEmailAddress(controller.signal);

  expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);
});

test.each([
  ["the request fails", () => fetchMock.mockRejectedValue(new Error("Offline."))],
  ["the endpoint refuses the read", () => fetchMock.mockResolvedValue(new Response(null, { status: 403 }))],
  ["the response is not JSON", () => fetchMock.mockResolvedValue(new Response("nope", { status: 200 }))],
  ["the response has no email address", () => fetchMock.mockResolvedValue(jsonResponse({}))],
  ["the email address is not a string", () => fetchMock.mockResolvedValue(jsonResponse({ emailAddress: 42 }))],
])("does not return an email address when %s", async (_label, arrange) => {
  arrange();

  await expect(readContactEmailAddress()).resolves.toBeNull();
  expect(sessionStorage.getItem(CONTACT_EMAIL_ADDRESS_STORAGE_KEY)).toBeNull(); // Not cached, so the next open retries.
});

test("a read succeeds even when session storage is unavailable", async () => {
  const denied = () => {
    throw new Error("Denied.");
  };
  const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(denied);
  const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(denied);

  await expect(readContactEmailAddress()).resolves.toBe(EMAIL_ADDRESS);

  setItem.mockRestore();
  getItem.mockRestore();
});
