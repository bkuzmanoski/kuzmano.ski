import { describe, expect, test } from "vitest";

import { fromRoot } from "./paths.ts";
import { formatOptimizationFailures, optimizationFailureFrom } from "./react-compiler.ts";

import type { LoggerEvent } from "babel-plugin-react-compiler";

const sourceLocationAt = (line: number) => ({
  start: { line, column: 0, index: 0 },
  end: { line, column: 0, index: 0 },
});

const compileError = (reason: string, description: string | null, line: number | null): LoggerEvent =>
  ({
    kind: "CompileError",
    fnLoc: sourceLocationAt(1),
    detail: { reason, description, primaryLocation: () => (line === null ? null : sourceLocationAt(line)) },
  }) as unknown as LoggerEvent;

describe("optimizationFailureFrom", () => {
  test("returns the root-relative file path, primary location line, and reason of a compile error", () => {
    expect(
      optimizationFailureFrom(fromRoot("src/source-a.ts"), compileError("Handle ??= operators", null, 78)),
    ).toEqual({
      filePath: "src/source-a.ts",
      line: 78,
      reason: "Handle ??= operators",
    });
  });

  test("returns a reason joining a compile error's reason and description with a colon", () => {
    expect(
      optimizationFailureFrom(fromRoot("src/source-a.ts"), compileError("Todo", "Rewrite hoisted references", 4))
        ?.reason,
    ).toBe("Todo: Rewrite hoisted references");
  });

  test("returns the function's line for a compile error without a primary location", () => {
    expect(optimizationFailureFrom(fromRoot("src/source-a.ts"), compileError("Todo", null, null))?.line).toBe(1);
  });

  test("returns the root-relative file path, function line, and data of a pipeline error", () => {
    const pipelineErrorEvent = {
      kind: "PipelineError",
      fnLoc: sourceLocationAt(9),
      data: "Bad assumption",
    } as unknown as LoggerEvent;
    expect(optimizationFailureFrom(fromRoot("src/source-a.ts"), pipelineErrorEvent)).toEqual({
      filePath: "src/source-a.ts",
      line: 9,
      reason: "Bad assumption",
    });
  });

  test('returns "unknown file" as the file path for a `null` absolute path', () => {
    expect(optimizationFailureFrom(null, compileError("Todo", null, 1))?.filePath).toBe("unknown file");
  });

  test("returns `null` for a `CompileSuccess` or `CompileSkip` event", () => {
    const compileSuccessEvent = {
      kind: "CompileSuccess",
      fnLoc: sourceLocationAt(1),
      fnName: "Component",
    } as unknown as LoggerEvent;
    const compileSkipEvent = {
      kind: "CompileSkip",
      fnLoc: sourceLocationAt(1),
      reason: "'use no memo'",
      loc: null,
    } as unknown as LoggerEvent;

    expect(optimizationFailureFrom(fromRoot("src/source-a.ts"), compileSuccessEvent)).toBeNull();
    expect(optimizationFailureFrom(fromRoot("src/source-a.ts"), compileSkipEvent)).toBeNull();
  });
});

describe("formatOptimizationFailures", () => {
  test("outputs one diagnostic line per optimization failure, without a line number when the line is `null`", () => {
    expect(
      formatOptimizationFailures([
        { filePath: "src/source-a.ts", line: 7, reason: "Handle ??=" },
        { filePath: "src/source-b.tsx", line: null, reason: "Rewrite hoisted references" },
      ]),
    ).toBe("  src/source-a.ts:7 — Handle ??=\n  src/source-b.tsx — Rewrite hoisted references");
  });
});
