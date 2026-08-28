import type { SyntheticEvent } from "react";

type Handler = (event: SyntheticEvent) => void;

/**
 * Combines two bags of event handler props. Handlers run in the order the bags are given.
 *
 * Every handler still runs once if one of them prevents the default: a later handler that
 * wants to stand aside for an earlier one can read `event.defaultPrevented`.
 */
export function mergeHandlers<TFirst extends object, TSecond extends object>(
  first: TFirst,
  second: TSecond,
): TFirst & TSecond {
  const merged = { ...first } as Record<string, Handler | undefined>;

  for (const name of Object.keys(second)) {
    const before = merged[name];
    const after = (second as Record<string, Handler | undefined>)[name];

    merged[name] =
      before && after
        ? (event) => {
            before(event);
            after(event);
          }
        : (after ?? before);
  }

  return merged as TFirst & TSecond;
}
