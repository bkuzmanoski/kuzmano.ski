import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { deferWrite } from "#/test-utils/clipboard.ts";

import { useCopyToClipboard } from "./use-copy-to-clipboard.ts";

const writeText = vi.fn<(value: string) => Promise<void>>();

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
});

// Starts a second copy while the first clipboard write is still pending.
function startTwoCopies() {
  const firstWrite = deferWrite(writeText);
  const secondWrite = deferWrite(writeText);
  const { result } = renderHook(() => useCopyToClipboard<{ name: string }>());

  act(() => {
    void result.current.copy("first value", { name: "first" });
    void result.current.copy("second value", { name: "second" });
  });

  return { result, firstWrite, secondWrite };
}

test("a write that succeeds after a second copy has started does not confirm the second copy", async () => {
  const { result, firstWrite, secondWrite } = startTwoCopies();

  await firstWrite.succeed();

  expect(result.current.latestClipboardCopy).toMatchObject({ name: "second", status: "copying" });

  await secondWrite.fail();

  expect(result.current.latestClipboardCopy).toMatchObject({ name: "second", status: "failed" });
});

test("a write that fails after a second copy has started does not fail the second copy", async () => {
  const { result, firstWrite, secondWrite } = startTwoCopies();

  await secondWrite.succeed();
  await firstWrite.fail();

  expect(result.current.latestClipboardCopy).toMatchObject({ name: "second", status: "copied" });
});

test("`confirmedClipboardCopyNumber` is `null` until the latest copy's write succeeds, then counts from `1` the copies that were the latest when their writes succeeded", async () => {
  const { result, firstWrite, secondWrite } = startTwoCopies();

  await firstWrite.succeed();

  expect(result.current.confirmedClipboardCopyNumber).toBeNull();

  await secondWrite.succeed();

  expect(result.current.confirmedClipboardCopyNumber).toBe(1);

  const failedWrite = deferWrite(writeText);

  act(() => {
    void result.current.copy("failed value", { name: "failed" });
  });
  await failedWrite.fail();

  expect(result.current.confirmedClipboardCopyNumber).toBeNull();

  const thirdWrite = deferWrite(writeText);

  act(() => {
    void result.current.copy("third value", { name: "third" });
  });
  await thirdWrite.succeed();

  expect(result.current.confirmedClipboardCopyNumber).toBe(2);
});
