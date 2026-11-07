/**
 * The message of a thrown `Error`, or the thrown value as a string, without the `Error: ` prefix that `String` adds.
 */
export const errorMessageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));
