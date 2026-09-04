import { describe, expect, test, vi } from "vitest";

import { mergeRefs } from "./merge-refs.ts";

import type { RefObject } from "react";

const node = { id: "node" };

describe("mergeRefs", () => {
  test("attaches a ref object and a callback ref in argument order", () => {
    const calls: Array<string> = [];
    const object: RefObject<typeof node | null> = { current: null };
    const callback = (value: typeof node | null) => {
      calls.push(value === null ? "detach" : "attach");
    };

    mergeRefs(object, callback)(node);

    expect(object.current).toBe(node);
    expect(calls).toEqual(["attach"]);
  });

  test("clears a ref object and calls a cleanup-less callback ref with null on detach", () => {
    const object: RefObject<typeof node | null> = { current: null };
    const callback = vi.fn();

    mergeRefs(object, callback)(node)();

    expect(object.current).toBeNull();
    expect(callback).toHaveBeenLastCalledWith(null);
  });

  test("detaches a callback ref that returned a cleanup by invoking it, without a null call", () => {
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);

    mergeRefs(undefined, callback)(node)();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledExactlyOnceWith(node);
  });

  test("ignores a null or undefined ref", () => {
    const object: RefObject<typeof node | null> = { current: null };

    expect(() => mergeRefs(null, undefined)(node)()).not.toThrow();

    mergeRefs(object, undefined)(node);
    expect(object.current).toBe(node);
  });
});
