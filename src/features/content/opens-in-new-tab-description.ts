import { createContext, use } from "react";

/** Element ID of the "Opens in a new tab" description, or `undefined` outside `OpensInNewTabDescriptionProvider`. */
export const OpensInNewTabDescriptionIdContext = createContext<string | undefined>(undefined);

export const useOpensInNewTabDescriptionId = () => use(OpensInNewTabDescriptionIdContext);
