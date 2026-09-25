import { act } from "@testing-library/react";

import type { Mock } from "vitest";

/**
 * Makes the next call to `writeText` return a write that stays pending until the test calls
 * `succeed` or `fail`, so a later copy can start while it is pending. Each settles the write inside
 * `act`, so the updates that follow it are rendered.
 */
export function deferWrite(writeText: Mock<(value: string) => Promise<void>>) {
  let settleWrite: { resolve: () => void; reject: (error: Error) => void } | undefined;

  writeText.mockReturnValueOnce(
    new Promise<void>((resolve, reject) => {
      settleWrite = { resolve, reject };
    }),
  );

  return {
    succeed: () =>
      act(async () => {
        settleWrite?.resolve();
        await Promise.resolve();
      }),
    fail: () =>
      act(async () => {
        settleWrite?.reject(new Error("Denied"));
        await Promise.resolve();
      }),
  };
}
