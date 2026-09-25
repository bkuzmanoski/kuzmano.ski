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
export function useInputField(error?: string, { describedBy }: { describedBy?: string } = {}): InputFieldBinding {
  const id = useId();
  const errorId = `${id}-error`;
  const descriptionIds = [error ? errorId : undefined, describedBy].filter((descriptionId) => descriptionId);

  return {
    control: {
      id,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": descriptionIds.length > 0 ? descriptionIds.join(" ") : undefined,
    },
    errorId,
    error,
  };
}
