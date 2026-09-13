import { describe, expect, test, vi } from "vitest";

import { mergeRefs } from "./merge-refs.ts";

import type { RefObject } from "react";

const node = { id: "node" };

describe("mergeRefs", () => {
  test("attaches a ref object and a callback ref in argument order", () => {
    const callOrder: Array<string> = [];
    const refObject: RefObject<typeof node | null> = { current: null };
    const callback = (value: typeof node | null) => {
      callOrder.push(value === null ? "detach" : "attach");
    };

    mergeRefs(refObject, callback)(node);

    expect(refObject.current).toBe(node);
    expect(callOrder).toEqual(["attach"]);
  });

  test("clears a ref object and calls a cleanup-less callback ref with `null` on detach", () => {
    const refObject: RefObject<typeof node | null> = { current: null };
    const callback = vi.fn();

    mergeRefs(refObject, callback)(node)();

    expect(refObject.current).toBeNull();
    expect(callback).toHaveBeenLastCalledWith(null);
  });

  test("detaches a callback ref that returned a cleanup by calling the cleanup instead of calling the ref with `null`", () => {
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);

    mergeRefs(undefined, callback)(node)();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledExactlyOnceWith(node);
  });

  test("ignores a `null` or `undefined` ref", () => {
    const refObject: RefObject<typeof node | null> = { current: null };

    expect(() => mergeRefs(null, undefined)(node)()).not.toThrow();

    mergeRefs(refObject, undefined)(node);
    expect(refObject.current).toBe(node);
  });
});
