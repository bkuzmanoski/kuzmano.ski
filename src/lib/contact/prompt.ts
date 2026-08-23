import { MESSAGE_MAX_LENGTH } from "./message";

import type { ContactFields } from "./message";

const CHARACTER_COUNT_VISIBILITY_RATIO = 0.75;
export const CHARACTER_COUNT_VISIBLE_FROM =
  MESSAGE_MAX_LENGTH - Math.floor(MESSAGE_MAX_LENGTH * CHARACTER_COUNT_VISIBILITY_RATIO);

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

/**
 * `directEmailAddress` is offered as a fallback when a send fails outright. It is `null` until
 * the window has read it, so an alert raised before it arrives omits the email address.
 */
export function alertFor(prompt: Prompt, directEmailAddress: string | null): PromptAlert {
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
        message:
          prompt.suggestDirectEmail && directEmailAddress
            ? `${prompt.message} You can write directly to ${directEmailAddress} instead.`
            : prompt.message,
        primaryLabel: "OK",
      };
  }
}
