import { MESSAGE_MAX_LENGTH } from "./message";

import type { ContactFields } from "./message";

const CHARACTER_COUNT_VISIBILITY_THRESHOLD = 0.75;
const CHARACTER_COUNT_START_VALUE = Math.floor(MESSAGE_MAX_LENGTH * CHARACTER_COUNT_VISIBILITY_THRESHOLD);

/** What the compose window is currently asking the reader about, if anything. */
export type Prompt =
  | { kind: "discard" }
  | { kind: "incomplete"; message: string; field: keyof ContactFields }
  | { kind: "sent" }
  | { kind: "failed"; message: string; suggestDirectEmail?: boolean };

export interface PromptAlert {
  variant: "information" | "error";
  message: string;
  primaryLabel: string;
  secondaryLabel?: string;
}

/** Sentinel value for the alert component when there is no prompt. */
export const NO_ALERT: PromptAlert = { variant: "information", message: "", primaryLabel: "OK" };

/** `directEmailAddress` is offered as a fallback when a send fails outright. */
export function alertFor(prompt: Prompt, directEmailAddress: string): PromptAlert {
  switch (prompt.kind) {
    case "discard":
      return {
        variant: "information",
        message: "Discard this message?",
        primaryLabel: "Discard",
        secondaryLabel: "Cancel",
      };

    case "incomplete":
      return { variant: "error", message: prompt.message, primaryLabel: "OK" };

    case "sent":
      return {
        variant: "information",
        message: "Message sent!",
        primaryLabel: "OK",
      };

    case "failed":
      return {
        variant: "error",
        message: prompt.suggestDirectEmail
          ? `${prompt.message} You can write directly to ${directEmailAddress} instead.`
          : prompt.message,
        primaryLabel: "OK",
      };
  }
}

/**
 * How much of the message allowance is left, or `null` while
 * there is enough room that a count would only be noise.
 */
export function characterCountStatus(length: number): string | null {
  const remainingCharacters = MESSAGE_MAX_LENGTH - length;

  if (length < CHARACTER_COUNT_START_VALUE) {
    return null;
  }

  return remainingCharacters < 0
    ? `${(-remainingCharacters).toLocaleString()} over`
    : `${remainingCharacters.toLocaleString()} left`;
}
