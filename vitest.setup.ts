import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

vi.stubGlobal("scrollTo", vi.fn());

afterEach(() => {
  cleanup();
});
