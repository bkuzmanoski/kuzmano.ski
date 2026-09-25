import { MESSAGE_MAX_LENGTH } from "./message.ts";

export const CHARACTER_COUNT_VISIBLE_FROM = MESSAGE_MAX_LENGTH - Math.floor(MESSAGE_MAX_LENGTH * 0.75);

const formattedCharacterCount = (count: number, numberFormat: Intl.NumberFormat) =>
  `${numberFormat.format(count)} ${count === 1 ? "character" : "characters"}`;

export function characterCountDescription(remainingCharacterCount: number, numberFormat: Intl.NumberFormat): string {
  return remainingCharacterCount < 0
    ? `${formattedCharacterCount(-remainingCharacterCount, numberFormat)} over the limit`
    : `${formattedCharacterCount(remainingCharacterCount, numberFormat)} left`;
}
/**
 * The text of the character count's status region. It changes only when the remaining characters
 * cross `CHARACTER_COUNT_VISIBLE_FROM` or the limit, so a screen reader announces those two
 * points rather than every keystroke.
 */
export function characterCountStatus(remainingCharacterCount: number, numberFormat: Intl.NumberFormat): string {
  if (remainingCharacterCount < 0) {
    return `Over the ${numberFormat.format(MESSAGE_MAX_LENGTH)}-character limit`;
  }

  return remainingCharacterCount <= CHARACTER_COUNT_VISIBLE_FROM
    ? `${numberFormat.format(CHARACTER_COUNT_VISIBLE_FROM)} or fewer characters left`
    : "";
}
