import { createContext, use } from "react";

/** The ID of the "Opens in a new tab" description, or `undefined` outside an entry's body. */
export const OpensInNewTabDescriptionIdContext = createContext<string | undefined>(undefined);

export const useOpensInNewTabDescriptionId = () => use(OpensInNewTabDescriptionIdContext);
