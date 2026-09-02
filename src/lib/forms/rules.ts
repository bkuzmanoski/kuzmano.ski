import { MAX_ADDRESS_LENGTH, emailAddress, maxLength, required } from "./validation";

import type { Rule } from "./validation";

export const EMAIL_ADDRESS_RULES: ReadonlyArray<Rule<string>> = [
  required("Enter your email address."),
  maxLength(MAX_ADDRESS_LENGTH, "That email address is too long."),
  emailAddress("That doesn’t look like an email address."),
];
