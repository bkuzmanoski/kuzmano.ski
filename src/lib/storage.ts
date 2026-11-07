// Has no imports because pre-hydration scripts bundle this module (see `/build/inline-scripts.ts`).

type StorageArea = () => Storage;

const LOCAL_STORAGE: StorageArea = () => localStorage;
export const SESSION_STORAGE: StorageArea = () => sessionStorage;

export function readStored(key: string, storageArea = LOCAL_STORAGE): string | null {
  try {
    return storageArea().getItem(key);
  } catch {
    return null;
  }
}

export function readStoredJson(key: string, storageArea = LOCAL_STORAGE): unknown {
  try {
    const rawValue = storageArea().getItem(key);
    return rawValue === null ? null : JSON.parse(rawValue);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string, storageArea = LOCAL_STORAGE) {
  try {
    storageArea().setItem(key, value);
  } catch {
    // Ignored.
  }
}

export function removeStored(key: string, storageArea = LOCAL_STORAGE) {
  try {
    storageArea().removeItem(key);
  } catch {
    // Ignored.
  }
}

export function clearStorage(storageArea = LOCAL_STORAGE) {
  try {
    storageArea().clear();
  } catch {
    // Ignored.
  }
}
