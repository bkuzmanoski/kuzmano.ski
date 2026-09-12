import { CLIENT_ENVIRONMENT } from "./environments.ts";
import { toRootRelative } from "./paths.ts";

import type { Logger, LoggerEvent, SourceLocation } from "babel-plugin-react-compiler";
import type { Plugin } from "vite";

export interface CompilerOptimizationFailure {
  filePath: string;
  line: number | null;
  reason: string;
}

const lineOf = (location: SourceLocation | null | undefined) =>
  typeof location === "object" && location !== null ? location.start.line : null; // A location is `GeneratedSource` (a symbol) for a node the compiler synthesised itself.
const functionLine = (event: LoggerEvent) => ("fnLoc" in event ? lineOf(event.fnLoc) : null);

export function optimizationFailureFrom(
  absolutePath: string | null,
  event: LoggerEvent,
): CompilerOptimizationFailure | null {
  const filePath = absolutePath === null ? "unknown file" : toRootRelative(absolutePath);

  switch (event.kind) {
    case "CompileError":
      return {
        filePath,
        line: lineOf(event.detail.primaryLocation()) ?? functionLine(event),
        reason: [event.detail.reason, event.detail.description].filter(Boolean).join(": "),
      };

    case "PipelineError":
      return { filePath, line: functionLine(event), reason: event.data };

    default:
      return null;
  }
}

export const formatOptimizationFailures = (failures: Array<CompilerOptimizationFailure>) =>
  failures
    .map(({ filePath, line, reason }) => `  ${filePath}${line === null ? "" : `:${line}`} — ${reason}`)
    .join("\n");

/** A logger for `reactCompilerPreset` that collects optimization failures and a Vite plugin that reports them at the end of the build. */
export function reactCompilerOptimizationFailures(): { logger: Logger; plugin: Plugin } {
  const failures: Array<CompilerOptimizationFailure> = [];
  return {
    logger: {
      logEvent(absolutePath, event) {
        const failure = optimizationFailureFrom(absolutePath, event);

        if (failure) {
          failures.push(failure);
        }
      },
    },
    plugin: {
      name: "kuzmano.ski:react-compiler-optimization-failures",
      apply: "build",
      applyToEnvironment: (environment) => environment.name === CLIENT_ENVIRONMENT,
      buildEnd(error) {
        if (error || failures.length === 0) {
          return;
        }

        this.error(
          `The React Compiler could not optimize ${failures.length} function${failures.length === 1 ? "" : "s"}:\n${formatOptimizationFailures(failures)}`,
        );
      },
    },
  };
}
