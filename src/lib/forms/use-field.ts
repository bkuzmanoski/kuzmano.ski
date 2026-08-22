import { useId } from "react";

/** Spread onto the control a field labels. */
export interface FieldControl {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

/** Everything a field and the control inside it have to agree on. */
export interface FieldBinding {
  control: FieldControl;
  errorId: string;
  error?: string;
}

/**
 * Ties a labelled field to its control.
 *
 * The binding is held by whoever renders the control rather than handed down by the
 * field, so the control stays ordinary JSX. Handing it down would make the field's
 * `children` a function, and a function closes over everything the control reads:
 * the React Compiler would then rebuild the control whenever any of it changes,
 * including the values of the other fields on the same form.
 */
export function useField(error?: string): FieldBinding {
  const id = useId();
  const errorId = `${id}-error`;

  return {
    control: { id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? errorId : undefined },
    errorId,
    error,
  };
}
