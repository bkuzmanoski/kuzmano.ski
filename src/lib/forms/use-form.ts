import { useState } from "react";

import { isValid, validate } from "./validation";

import type { Errors, Schema } from "./validation";
import type { ChangeEvent } from "react";

export type FieldValues<TValues> = Record<keyof TValues, string>;

/** The handlers for one field. Held apart from its value so they never change. */
export interface FieldHandlers {
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
}

export interface Form<TValues extends FieldValues<TValues>> {
  values: TValues;
  handlers: Record<keyof TValues, FieldHandlers>;
  visibleErrors: Errors<TValues>; // An empty visibleErrors does not indicate validity; check `isValid` instead.
  isValid: boolean;
  isDirty: boolean;
  setValue: (name: keyof TValues, value: string) => void;
  revealErrors: () => Errors<TValues> | null;
  reset: () => void;
}

/**
 * Controlled fields validated against a schema.
 *
 * Errors are computed from the values during render rather than held as state.
 *
 * A field reports its error once visited, or once a submission has been attempted.
 *
 * A field is bound from two places rather than one: `handlers[name]`, which is fixed for
 * the life of the form, and `values[name]`, which changes only when that field changes.
 * A caller that spreads both onto a control gives the React Compiler two narrow
 * dependencies to watch, so typing in one field leaves the other fields untouched.
 *
 * `initialValues` and `schema` must be module constants, not call-site literals.
 * Both are compared by identity by `reset`, by `handlers`, and by the memo scopes
 * the React Compiler builds around this hook.
 *
 * The initial values and schema must remain fixed for the lifetime of the form;
 * reinitialization is not supported.
 *
 * Values are validated as typed, while the server validates them trimmed (see
 * `parseSubmission` in `lib/contact/message.ts`). Every rule either trims first or
 * measures length, so the client is stricter than the server.
 */
export function useForm<TValues extends FieldValues<TValues>>({
  initialValues,
  schema,
}: {
  initialValues: TValues;
  schema: Schema<TValues>;
}): Form<TValues> {
  const [values, setValues] = useState(initialValues);
  const [visited, setVisited] = useState<Partial<Record<keyof TValues, true>>>({});
  const [isSubmitAttempted, setIsSubmitAttempted] = useState(false);

  const errors = validate(schema, values);
  const visibleErrors: Errors<TValues> = {};

  for (const name of Object.keys(errors) as Array<keyof TValues>) {
    if (isSubmitAttempted || visited[name]) {
      visibleErrors[name] = errors[name];
    }
  }

  function setValue(name: keyof TValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  // Keyed off `initialValues` alone, so the whole record survives every value change.
  const handlers = Object.fromEntries(
    (Object.keys(initialValues) as Array<keyof TValues>).map((name) => [
      name,
      {
        onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          setValue(name, event.currentTarget.value),
        onBlur: () => setVisited((current) => ({ ...current, [name]: true })),
      },
    ]),
  ) as Record<keyof TValues, FieldHandlers>;

  return {
    values,
    handlers,
    visibleErrors,
    isValid: isValid(errors),
    isDirty: (Object.keys(initialValues) as Array<keyof TValues>).some((name) => values[name] !== initialValues[name]),
    setValue,
    reset: () => {
      setValues(initialValues);
      setVisited({});
      setIsSubmitAttempted(false);
    },
    revealErrors: () => {
      setIsSubmitAttempted(true);
      return isValid(errors) ? null : errors;
    },
  };
}
