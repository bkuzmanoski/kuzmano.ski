import type { SyntheticEvent } from "react";

type Handler = (event: SyntheticEvent) => void;

type Merged<TBags extends Array<object>> = TBags extends [infer TFirst, ...infer TRest extends Array<object>]
  ? TFirst & Merged<TRest>
  : unknown;

/**
 * Combines bags of event handler props. Handlers run in the order the bags are given.
 *
 * Every handler still runs once if one of them prevents the default: a later handler that wants to stand aside for an
 * earlier one can read `event.defaultPrevented`.
 */
export function mergeHandlers<TBags extends Array<object>>(...bags: TBags): Merged<TBags> {
  const mergedHandlers: Record<string, Handler | undefined> = {};

  for (const bag of bags) {
    for (const [name, handler] of Object.entries(bag as Record<string, Handler | undefined>)) {
      const earlierHandler = mergedHandlers[name];

      mergedHandlers[name] =
        earlierHandler && handler
          ? (event) => {
              earlierHandler(event);
              handler(event);
            }
          : (handler ?? earlierHandler);
    }
  }

  return mergedHandlers as Merged<TBags>;
}
