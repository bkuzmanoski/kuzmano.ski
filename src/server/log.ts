/** The failures the Worker logs, each as an object with an `event` property. */
export type ServerLogEvent =
  | "client_error"
  | "contact_binding_missing"
  | "contact_delivery_failed"
  | "edge_cache_read_failed"
  | "edge_cache_store_failed"
  | "github_binding_missing"
  | "github_contributions_failed"
  | "waitlist_binding_missing"
  | "waitlist_join_failed"
  | "waitlist_lookup_failed";

type MissingBindingEvent = Extract<ServerLogEvent, `${string}_binding_missing`>;

export function logServerEvent(event: ServerLogEvent, fields: Record<string, unknown>) {
  console.error({ event, ...fields });
}

/** Logs a binding or secret the Worker could not reach. */
export function reportMissingBinding(event: MissingBindingEvent, binding: string) {
  logServerEvent(event, { binding, message: `The worker could not access \`${binding}\`` });
}

/** The message of a thrown `Error`, or the thrown value as a string, without the `Error: ` prefix `String` adds. */
export const errorMessageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));
