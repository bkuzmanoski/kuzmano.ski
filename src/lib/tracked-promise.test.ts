import { expect, test } from "vitest";

import { trackPromise } from "./tracked-promise.ts";

test("a promise is marked pending until it settles", () => {
  const neverSettles = new Promise<string>(() => undefined);
  expect(trackPromise(neverSettles).status).toBe("pending");
});

test("a fulfilled promise is marked fulfilled and contains its value", async () => {
  const trackedPromise = trackPromise(Promise.resolve("content"));

  await trackedPromise;

  // `use()` reads `status` and `value` to return a settled promise's value without suspending.
  expect(trackedPromise.status).toBe("fulfilled");
  expect(trackedPromise.value).toBe("content");
});

test("a rejected promise is marked rejected and contains its reason", async () => {
  const rejectionReason = new Error("Content not found");
  const trackedPromise = trackPromise(Promise.reject(rejectionReason));

  await expect(trackedPromise).rejects.toThrow(rejectionReason);

  expect(trackedPromise.status).toBe("rejected");
  expect(trackedPromise.reason).toBe(rejectionReason);
});

test("the returned promise is the one passed in", () => {
  const promise = Promise.resolve("content");
  expect(trackPromise(promise)).toBe(promise); // React reads the status and value from the promise object it is given, so it has to be the same object.
});
