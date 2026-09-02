// This module has no imports, so pre-hydration scripts can use it (see `/build/inline-scripts.ts`).

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

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

export function clearStorage() {
  try {
    localStorage.clear();
  } catch {
    // Ignored.
  }
}
