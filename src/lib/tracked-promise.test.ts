import { expect, test } from "vitest";

import { trackPromise } from "./tracked-promise";

test("a promise is marked pending until it settles", () => {
  const neverSettles = new Promise<string>(() => undefined);
  expect(trackPromise(neverSettles).status).toBe("pending");
});

test("a fulfilled promise contains its value, which is how `use()` reads it without suspending", async () => {
  const tracked = trackPromise(Promise.resolve("content"));

  await tracked;

  expect(tracked.status).toBe("fulfilled");
  expect(tracked.value).toBe("content");
});

test("a rejected promise contains its reason", async () => {
  const failure = new Error("Content not found");
  const tracked = trackPromise(Promise.reject(failure));

  await expect(tracked).rejects.toThrow(failure);

  expect(tracked.status).toBe("rejected");
  expect(tracked.reason).toBe(failure);
});

test("the promise handed back is the one passed in, as React reads the state off that object", () => {
  const promise = Promise.resolve("content");
  expect(trackPromise(promise)).toBe(promise);
});
