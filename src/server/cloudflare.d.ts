// Minimal declarations for the Cloudflare Workers APIs used by this project.
//
// `wrangler types` does not declare `cloudflare:workers`, and its generated types also
// redeclare browser globals such as `Response` and `ReadableStream`, which conflict with
// the browser types used elsewhere in the project.
//
// Keep these declarations aligned with the runtime. To verify them against the generated
// types, run:
//
//   npx wrangler types /tmp/worker-configuration.d.ts
//
// Last verified against workerd@1.20260811.1. The declarations follow the runtime shapes,
// which differ from the published docs for `EmailAddress.name`.
declare module "cloudflare:workers" {
  export interface EmailAddress {
    name: string;
    email: string;
  }

  export interface EmailMessageBuilder {
    from: string | EmailAddress;
    to: string | EmailAddress;
    replyTo?: string | EmailAddress;
    subject: string;
    headers?: Record<string, string>;
    text?: string;
  }

  export interface SendEmailBinding {
    send: (builder: EmailMessageBuilder) => Promise<{ messageId: string }>;
  }

  export interface RateLimitBinding {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  }

  /** Worker bindings, keyed by the names declared in `server/bindings.ts`. */
  /* eslint-disable @typescript-eslint/consistent-type-imports -- A top-level import would make this an invalid module augmentation. */
  export type WorkerEnv = Partial<Record<typeof import("./bindings.ts").SEND_EMAIL_BINDING, SendEmailBinding>> &
    Partial<Record<import("./bindings.ts").RateLimitBindingName, RateLimitBinding>> &
    Partial<Record<import("./bindings.ts").SecretName, string>>;
  /* eslint-enable @typescript-eslint/consistent-type-imports */

  export const env: WorkerEnv;
}
