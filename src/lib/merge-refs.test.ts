import { describe, expect, test, vi } from "vitest";

import { mergeRefs } from "./merge-refs.ts";

import type { RefObject } from "react";

const node = { id: "node" };

describe("mergeRefs", () => {
  test("attaches a ref object and a callback ref in argument order", () => {
    const callOrder: Array<string> = [];
    let current: typeof node | null = null;
    const refObject: RefObject<typeof node | null> = {
      get current() {
        return current;
      },
      set current(value: typeof node | null) {
        callOrder.push("ref object");
        current = value;
      },
    };

    mergeRefs(refObject, () => {
      callOrder.push("callback ref");
    })(node);

    expect(refObject.current).toBe(node);
    expect(callOrder).toEqual(["ref object", "callback ref"]);
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
