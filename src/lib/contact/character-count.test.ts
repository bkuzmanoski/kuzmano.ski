import { expect, test } from "vitest";

import { CHARACTER_COUNT_VISIBLE_FROM, characterCountDescription, characterCountStatus } from "./character-count.ts";
import { MESSAGE_MAX_LENGTH } from "./message.ts";

const NUMBER_FORMAT = new Intl.NumberFormat("en");

test("the character count description names the characters left, or the characters over the limit", () => {
  expect(characterCountDescription(1_000, NUMBER_FORMAT)).toBe("1,000 characters left");
  expect(characterCountDescription(1, NUMBER_FORMAT)).toBe("1 character left");
  expect(characterCountDescription(0, NUMBER_FORMAT)).toBe("0 characters left");
  expect(characterCountDescription(-1, NUMBER_FORMAT)).toBe("1 character over the limit");
  expect(characterCountDescription(-12, NUMBER_FORMAT)).toBe("12 characters over the limit");
});

test("the character count description and status write their numbers in the number format they are given", () => {
  const numberFormat = new Intl.NumberFormat("de-DE");

  expect(characterCountDescription(1_000, numberFormat)).toBe("1.000 characters left");
  expect(characterCountStatus(-1, numberFormat)).toBe(
    `Over the ${numberFormat.format(MESSAGE_MAX_LENGTH)}-character limit`,
  );
});

test("the character count status is empty above the visibility threshold, and the same text throughout each range below it", () => {
  const thresholdStatus = characterCountStatus(CHARACTER_COUNT_VISIBLE_FROM, NUMBER_FORMAT);
  const overLimitStatus = characterCountStatus(-1, NUMBER_FORMAT);

  expect(characterCountStatus(CHARACTER_COUNT_VISIBLE_FROM + 1, NUMBER_FORMAT)).toBe("");
  expect(thresholdStatus).not.toBe("");
  expect(characterCountStatus(0, NUMBER_FORMAT)).toBe(thresholdStatus);
  expect(overLimitStatus).toBe(`Over the ${NUMBER_FORMAT.format(MESSAGE_MAX_LENGTH)}-character limit`);
  expect(characterCountStatus(-MESSAGE_MAX_LENGTH, NUMBER_FORMAT)).toBe(overLimitStatus);
});
