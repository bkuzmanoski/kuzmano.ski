import type { Ref } from "react";

type Detach = () => void;

function attach<T>(ref: Ref<T> | undefined, node: T | null): Detach | null {
  if (typeof ref === "function") {
    const cleanup = ref(node);
    return typeof cleanup === "function" ? cleanup : () => ref(null);
  }

  if (ref) {
    ref.current = node;

    return () => {
      ref.current = null;
    };
  }

  return null;
}

/**
 * Combines two refs into one callback ref, so a single element can populate both a component's
 * own ref and a ref supplied by its caller. Refs are attached in argument order.
 *
 * React does not call a callback ref a second time with `null` when that ref returned a cleanup
 * function, so each ref is detached by the mechanism it registered: the cleanup function it
 * returned, or otherwise a call with `null`. Applying one mechanism to both cases would leave a
 * ref pointing at a removed element, or invoke a cleanup twice.
 */
export function mergeRefs<T>(first: Ref<T> | undefined, second: Ref<T> | undefined): (node: T | null) => Detach {
  return (node) => {
    const detaches = [attach(first, node), attach(second, node)];
    return () => {
      for (const detach of detaches) {
        detach?.();
      }
    };
  };
}
