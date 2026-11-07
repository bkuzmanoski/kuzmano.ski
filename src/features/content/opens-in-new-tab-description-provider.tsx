import { useId } from "react";

import { OpensInNewTabDescriptionIdContext } from "./opens-in-new-tab-description.ts";

import type { ReactNode } from "react";

/** Provides a shared "Opens in a new tab" description to wrapped links. */
export function OpensInNewTabDescriptionProvider({ children }: { children: ReactNode }) {
  const id = useId();
  return (
    <OpensInNewTabDescriptionIdContext value={id}>
      {children}
      <span id={id} hidden>
        Opens in a new tab
      </span>
    </OpensInNewTabDescriptionIdContext>
  );
}
