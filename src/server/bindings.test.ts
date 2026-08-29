import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vitest";

import {
  CONTACT_EMAIL_ADDRESS_BINDING,
  CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING,
  SEND_EMAIL_BINDING,
  SEND_EMAIL_RATELIMIT_BINDING,
} from "./bindings";

const source = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
const config = source.replaceAll(/^\s*\/\/.*$/gm, "");

const declares = (key: string) => config.includes(`"${key}"`);

test.each([SEND_EMAIL_BINDING, SEND_EMAIL_RATELIMIT_BINDING, CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING])(
  'wrangler.jsonc declares "%s"',
  (name) => {
    expect(declares(name)).toBe(true);
  },
);

test(`${CONTACT_EMAIL_ADDRESS_BINDING} is a secret`, () => {
  expect(declares(CONTACT_EMAIL_ADDRESS_BINDING)).toBe(false);
});

test("the mail binding does not pin a destination email address", () => {
  expect(declares("destination_address")).toBe(false);
});
