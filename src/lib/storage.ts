/* This module has no imports, so the pre-hydration scripts can share it (see
 * `build/inline-script.ts`). Storage can be blocked entirely (cookies disabled),
 * so every access stays behind a try. */

/** The stored value, or null when it is absent or storage is unavailable. */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The stored JSON, parsed, or null when absent, invalid, or storage is unavailable. */
export function readStoredJson(key: string): unknown {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue === null ? null : JSON.parse(rawValue);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignored.
  }
}
