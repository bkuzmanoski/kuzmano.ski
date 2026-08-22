/**
 * Minimal declarations for the Cloudflare Workers APIs used by this project.
 *
 * `wrangler types` does not declare `cloudflare:workers`, and its generated types also
 * redeclare browser globals such as `Response` and `ReadableStream`, which conflict with
 * the browser types used elsewhere in the project.
 *
 * Keep these declarations aligned with the runtime. To verify them against the generated
 * types, run:
 *
 *   npx wrangler types /tmp/worker-configuration.d.ts
 *
 * Last verified against workerd@1.20260811.1. The declarations follow the runtime shapes,
 * which differ from the published docs for `EmailAddress.name`.
 */
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

  /** The result of a successful send, including Cloudflare's assigned message ID. */
  export interface EmailSendResult {
    messageId: string;
  }

  /** A `send_email` binding for sending a message to the binding's configured recipient. */
  export interface SendEmailBinding {
    send: (builder: EmailMessageBuilder) => Promise<EmailSendResult>;
  }

  /** A `ratelimits` binding that reports whether a key is within its rate limit. */
  export interface RateLimitBinding {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  }

  /**
   * Optional Worker bindings used by the application.
   *
   * The names must match the bindings declared in `server/bindings.ts`.
   */
  export interface WorkerEnv {
    SEND_EMAIL?: SendEmailBinding;
    SEND_EMAIL_RATELIMIT?: RateLimitBinding;
    CONTACT_EMAIL_ADDRESS?: string;
    CONTACT_EMAIL_ADDRESS_RATELIMIT?: RateLimitBinding;
  }

  export const env: WorkerEnv;
}
