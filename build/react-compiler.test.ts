import { expect, test } from "vitest";

import { fromRoot } from "./paths.ts";
import { bailoutFrom, formatBailouts } from "./react-compiler.ts";

import type { LoggerEvent } from "babel-plugin-react-compiler";

const at = (line: number) => ({ start: { line, column: 0, index: 0 }, end: { line, column: 0, index: 0 } });

const compileError = (reason: string, description: string | null, line: number | null): LoggerEvent =>
  ({
    kind: "CompileError",
    fnLoc: at(1),
    detail: { reason, description, primaryLocation: () => (line === null ? null : at(line)) },
  }) as unknown as LoggerEvent;

test("reports a compile error against the source that caused it", () => {
  expect(
    bailoutFrom(fromRoot("src/lib/hooks/use-pointer-drag.ts"), compileError("Handle ??= operators", null, 78)),
  ).toEqual({ file: "src/lib/hooks/use-pointer-drag.ts", line: 78, reason: "Handle ??= operators" });
});

test("joins a description onto the reason", () => {
  expect(bailoutFrom(fromRoot("src/a.ts"), compileError("Todo", "Rewrite hoisted references", 4))?.reason).toBe(
    "Todo: Rewrite hoisted references",
  );
});

test("falls back to the function when the error carries no location", () => {
  expect(bailoutFrom(fromRoot("src/a.ts"), compileError("Todo", null, null))?.line).toBe(1);
});

test("reports a pipeline error", () => {
  const event = { kind: "PipelineError", fnLoc: at(9), data: "Bad assumption" } as unknown as LoggerEvent;
  expect(bailoutFrom(fromRoot("src/a.ts"), event)).toEqual({ file: "src/a.ts", line: 9, reason: "Bad assumption" });
});

test("names a file the compiler could not attribute", () => {
  expect(bailoutFrom(null, compileError("Todo", null, 1))?.file).toBe("unknown file");
});

test("passes over events that report no bailout", () => {
  const success = { kind: "CompileSuccess", fnLoc: at(1), fnName: "Window" } as unknown as LoggerEvent;
  const optedOut = { kind: "CompileSkip", fnLoc: at(1), reason: "'use no memo'", loc: null } as unknown as LoggerEvent;

  expect(bailoutFrom(fromRoot("src/a.ts"), success)).toBeNull();
  expect(bailoutFrom(fromRoot("src/a.ts"), optedOut)).toBeNull();
});

test("formats one line per bailout", () => {
  expect(
    formatBailouts([
      { file: "src/a.ts", line: 7, reason: "Handle ??=" },
      { file: "src/b.tsx", line: null, reason: "Rewrite hoisted references" },
    ]),
  ).toBe("  src/a.ts:7 — Handle ??=\n  src/b.tsx — Rewrite hoisted references");
});
