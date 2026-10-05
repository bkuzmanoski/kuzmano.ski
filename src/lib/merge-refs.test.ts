import { describe, expect, test, vi } from "vitest";

import { mergeRefs } from "./merge-refs.ts";

import type { RefObject } from "react";

const NODE = { id: "node" };

describe("mergeRefs", () => {
  test("attaches a ref object and a callback ref in argument order", () => {
    const callOrder: Array<string> = [];
    let current: typeof NODE | null = null;
    const refObject: RefObject<typeof NODE | null> = {
      get current() {
        return current;
      },
      set current(value: typeof NODE | null) {
        callOrder.push("ref object");
        current = value;
      },
    };

    mergeRefs(refObject, () => {
      callOrder.push("callback ref");
    })(NODE);

    expect(refObject.current).toBe(NODE);
    expect(callOrder).toEqual(["ref object", "callback ref"]);
  });

  test("clears a ref object and calls a cleanup-less callback ref with `null` on detach", () => {
    const refObject: RefObject<typeof NODE | null> = { current: null };
    const callback = vi.fn();

    mergeRefs(refObject, callback)(NODE)();

    expect(refObject.current).toBeNull();
    expect(callback).toHaveBeenLastCalledWith(null);
  });

  test("detaches a callback ref that returned a cleanup by calling the cleanup instead of calling the ref with `null`", () => {
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);

    mergeRefs(undefined, callback)(NODE)();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledExactlyOnceWith(NODE);
  });

  test("ignores a `null` or `undefined` ref", () => {
    const refObject: RefObject<typeof NODE | null> = { current: null };

    expect(() => mergeRefs(null, undefined)(NODE)()).not.toThrow();

    mergeRefs(refObject, undefined)(NODE);
    expect(refObject.current).toBe(NODE);
  });
});
