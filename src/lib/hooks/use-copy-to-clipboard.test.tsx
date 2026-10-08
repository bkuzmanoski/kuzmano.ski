import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { deferWrite } from "#/test-utils/clipboard.ts";

import { useCopyToClipboard } from "./use-copy-to-clipboard.ts";

const writeText = vi.fn<(value: string) => Promise<void>>();

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Starts two copies, of which the second starts while the first's write is pending.
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
