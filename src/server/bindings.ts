// Names of the Worker bindings and variables used by the application.
//
// These names must stay in sync with `cloudflare.d.ts` and `wrangler.jsonc`.
// `bindings.test.ts` verifies the declarations match. A missing or renamed binding
// otherwise resolves to `undefined` at runtime and would cause submissions to appear
// successful without being processed.

export const SEND_EMAIL_BINDING = "SEND_EMAIL";
export const SEND_EMAIL_RATELIMIT_BINDING = "SEND_EMAIL_RATELIMIT";
export const CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING = "CONTACT_EMAIL_ADDRESS_RATELIMIT";
export const CONTACT_EMAIL_ADDRESS_BINDING = "CONTACT_EMAIL_ADDRESS";
export const NOTION_TOKEN_BINDING = "NOTION_TOKEN";
export const WAITLIST_DATA_SOURCE_BINDING = "WAITLIST_DATA_SOURCE_ID";
export const WAITLIST_RATELIMIT_BINDING = "WAITLIST_RATELIMIT";

export type RateLimitBindingName =
  | typeof SEND_EMAIL_RATELIMIT_BINDING
  | typeof CONTACT_EMAIL_ADDRESS_RATELIMIT_BINDING
  | typeof WAITLIST_RATELIMIT_BINDING;
