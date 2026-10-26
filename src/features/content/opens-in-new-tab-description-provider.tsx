import { useId } from "react";

import { OpensInNewTabDescriptionIdContext } from "./opens-in-new-tab-description.ts";

import type { ReactNode } from "react";

/** Renders a shared "Opens in a new tab" description used by links in entries. */
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
