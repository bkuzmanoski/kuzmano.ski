import { useId } from "react";

/** Props to spread onto the control a field labels. */
export interface InputFieldControl {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

/** The IDs and error state shared by a field and its control. */
export interface InputFieldBinding {
  control: InputFieldControl;
  errorId: string;
  error?: string;
}

/** Binds a field to the control it labels. */
export function useInputField(error?: string): InputFieldBinding {
  const id = useId();
  const errorId = `${id}-error`;

  return {
    control: { id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? errorId : undefined },
    errorId,
    error,
  };
}
