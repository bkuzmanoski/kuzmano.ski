import { describe, expect, test, vi } from "vitest";

import { SESSION_STORAGE, clearStorage, readStored, readStoredJson, removeStored, writeStored } from "./storage.ts";

const PRIVATE_MODE_ERROR = new DOMException("The operation is insecure.", "SecurityError");
const QUOTA_ERROR = new DOMException("The quota has been exceeded.", "QuotaExceededError");

function stubStorageThrowing(error: DOMException) {
  const fail = () => {
    throw error;
  };

  vi.stubGlobal("localStorage", { getItem: fail, setItem: fail, removeItem: fail, clear: fail });
}

describe("readStored", () => {
  test("returns the value stored for the key", () => {
    localStorage.setItem("theme", "dark");
    expect(readStored("theme")).toBe("dark");
  });

  test("returns `null` when reading throws", () => {
    stubStorageThrowing(PRIVATE_MODE_ERROR);
    expect(readStored("theme")).toBeNull();
  });
});

describe("readStoredJson", () => {
  test("parses the value stored for the key", () => {
    localStorage.setItem("icon-positions", JSON.stringify({ first: { top: 8, right: 16 } }));
    expect(readStoredJson("icon-positions")).toEqual({ first: { top: 8, right: 16 } });
  });

  test("returns `null` for a key that has never been written", () => {
    expect(readStoredJson("icon-positions")).toBeNull();
  });

  test("returns `null` for a stored value that is not valid JSON", () => {
    localStorage.setItem("icon-positions", "{ truncated");
    expect(readStoredJson("icon-positions")).toBeNull();
  });

  test("returns `null` when reading throws", () => {
    stubStorageThrowing(PRIVATE_MODE_ERROR);
    expect(readStoredJson("icon-positions")).toBeNull();
  });
});

describe("writeStored", () => {
  test("stores the value under the key", () => {
    writeStored("theme", "dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  test("returns without throwing when storing throws", () => {
    stubStorageThrowing(QUOTA_ERROR);
    expect(() => writeStored("theme", "dark")).not.toThrow();
  });
});

describe("removeStored", () => {
  test("removes the value stored under the key and leaves the values under other keys unchanged", () => {
    localStorage.setItem("theme", "dark");
    localStorage.setItem("sound", "off");

    removeStored("theme");

    expect(localStorage.getItem("theme")).toBeNull();
    expect(localStorage.getItem("sound")).toBe("off");

    localStorage.clear();
  });

  test("returns without throwing when removing throws", () => {
    stubStorageThrowing(PRIVATE_MODE_ERROR);
    expect(() => removeStored("theme")).not.toThrow();
  });
});

describe("clearStorage", () => {
  test("removes every stored value", () => {
    localStorage.setItem("theme", "dark");
    localStorage.setItem("sound", "off");

    clearStorage();

    expect(localStorage.length).toBe(0);
  });

  test("returns without throwing when clearing throws", () => {
    stubStorageThrowing(PRIVATE_MODE_ERROR);
    expect(() => clearStorage()).not.toThrow();
  });
});

describe("storage that throws when read", () => {
  const throwOnRead = () => {
    throw PRIVATE_MODE_ERROR;
  };

  test.each([
    ["readStored", () => readStored("theme")],
    ["readStoredJson", () => readStoredJson("theme")],
    ["writeStored", () => writeStored("theme", "dark")],
    ["removeStored", () => removeStored("theme")],
    ["clearStorage", () => clearStorage()],
  ])("`%s` returns without throwing when reading `localStorage` throws", (_name, callStorage) => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(throwOnRead);
    expect(callStorage).not.toThrow();
  });

  test("`readStored` returns `null` when reading `sessionStorage` throws", () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(throwOnRead);
    expect(readStored("theme", SESSION_STORAGE)).toBeNull();
  });
});
