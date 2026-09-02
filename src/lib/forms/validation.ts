// React-agnostic so that the same rules run in the browser to
// guide the user and on the server to enforce the contract.

export type Rule<TValue> = (value: TValue) => string | null;
export type Schema<TValues> = { readonly [K in keyof TValues]: ReadonlyArray<Rule<TValues[K]>> };
export type Errors<TValues> = Partial<Record<keyof TValues, string>>;

export const required =
  (message: string): Rule<string> =>
  (value) =>
    value.trim().length > 0 ? null : message;

export const isWithinLengthLimit = (value: string, limit: number) => value.length <= limit;

export const maxLength =
  (limit: number, message: string): Rule<string> =>
  (value) =>
    isWithinLengthLimit(value, limit) ? null : message;

/**
 * The shape of accepted email addresses: a dot-atom local part and a dotted domain of
 * letter-digit-hyphen labels and a strict subset of RFC 5322. Quoted local parts
 * comments and address literals are legal but rejected.
 *
 * This catches a typo before the message is sent. Whether an email address can
 * receive mail is left for the mail server to determine.
 */
const ATOM = String.raw`[A-Za-z0-9!#$%&'*+/=?^_\`{|}~-]+`;
const LABEL = String.raw`[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?`;
const EMAIL = new RegExp(String.raw`^${ATOM}(?:\.${ATOM})*@(?:${LABEL}\.)+[A-Za-z]{2,63}$`);
const MAX_LOCAL_LENGTH = 64;

/** The longest address RFC 5321 allows. */
export const MAX_ADDRESS_LENGTH = 254;

export function isEmailAddress(value: string): boolean {
  const emailAddress = value.trim();
  const at = emailAddress.lastIndexOf("@");

  return (
    emailAddress.length <= MAX_ADDRESS_LENGTH &&
    at > 0 &&
    at <= MAX_LOCAL_LENGTH &&
    !emailAddress.endsWith(".") &&
    EMAIL.test(emailAddress)
  );
}

export const emailAddress =
  (message: string): Rule<string> =>
  (value) =>
    value.trim().length === 0 || isEmailAddress(value) ? null : message;

export function firstError<TValue>(rules: ReadonlyArray<Rule<TValue>>, value: TValue): string | null {
  for (const rule of rules) {
    const message = rule(value);

    if (message !== null) {
      return message;
    }
  }

  return null;
}

/** Every field's first failure. An empty result means the values satisfy the schema. */
export function validate<TValues extends object>(schema: Schema<TValues>, values: TValues): Errors<TValues> {
  const errors: Errors<TValues> = {};

  for (const name of Object.keys(schema) as Array<keyof TValues>) {
    const message = firstError(schema[name], values[name]);

    if (message !== null) {
      errors[name] = message;
    }
  }

  return errors;
}

export const isValid = <TValues extends object>(errors: Errors<TValues>) => Object.keys(errors).length === 0;
