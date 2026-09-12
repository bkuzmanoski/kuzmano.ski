import { expect, test } from "vitest";

import { trackPromise } from "./tracked-promise.ts";

test("a promise is marked pending until it settles", () => {
  const neverSettles = new Promise<string>(() => undefined);
  expect(trackPromise(neverSettles).status).toBe("pending");
});

test("a fulfilled promise contains its value, which is how `use()` reads it without suspending", async () => {
  const trackedPromise = trackPromise(Promise.resolve("content"));

  await trackedPromise;

  expect(trackedPromise.status).toBe("fulfilled");
  expect(trackedPromise.value).toBe("content");
});

test("a rejected promise contains its reason", async () => {
  const rejectionReason = new Error("Content not found");
  const trackedPromise = trackPromise(Promise.reject(rejectionReason));

  await expect(trackedPromise).rejects.toThrow(rejectionReason);

  expect(trackedPromise.status).toBe("rejected");
  expect(trackedPromise.reason).toBe(rejectionReason);
});

test("the promise handed back is the one passed in, as React reads the state off that object", () => {
  const promise = Promise.resolve("content");
  expect(trackPromise(promise)).toBe(promise);
});
