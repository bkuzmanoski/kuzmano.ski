import { expect, test, vi } from "vitest";

import { sharedLoad } from "./shared-load.ts";

test("callers share one load until `clear` discards it", async () => {
  const load = vi.fn(() => Promise.resolve("value"));
  const shared = sharedLoad(load);

  await Promise.all([shared.get(), shared.get()]);
  shared.clear();
  await shared.get();

  expect(load).toHaveBeenCalledTimes(2);
});

test("a rejected load discards itself, so the next caller retries", async () => {
  const load = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error("Failed.")).mockResolvedValue("value");
  const shared = sharedLoad(load);

  await expect(shared.get()).rejects.toThrow("Failed.");
  await expect(shared.get()).resolves.toBe("value");
});

test("a load that rejects after `clear` leaves the newer load in place", async () => {
  let rejectFirstLoad: (cause: Error) => void = () => undefined;

  const load = vi
    .fn<() => Promise<string>>()
    .mockReturnValueOnce(new Promise((_resolve, reject) => (rejectFirstLoad = reject)))
    .mockResolvedValue("value");
  const shared = sharedLoad(load);
  const firstLoad = shared.get();

  shared.clear();

  const newerLoad = shared.get();

  rejectFirstLoad(new Error("Failed."));
  await expect(firstLoad).rejects.toThrow("Failed.");

  expect(shared.current()).toBe(newerLoad);
});
