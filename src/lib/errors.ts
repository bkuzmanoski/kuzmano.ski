/** Returns an `Error`'s `message`, or `String(error)` for other thrown values (avoiding the `Error: ` prefix). */
export const errorMessageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));
