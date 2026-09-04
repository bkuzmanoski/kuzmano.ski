import { MAX_EMAIL_ADDRESS_LENGTH, emailAddress, maxLength, required } from "./validation.ts";

import type { Rule } from "./validation.ts";

export const EMAIL_ADDRESS_RULES: ReadonlyArray<Rule<string>> = [
  required("Enter your email address."),
  maxLength(MAX_EMAIL_ADDRESS_LENGTH, "That email address is too long."),
  emailAddress("That doesn’t look like an email address."),
];
