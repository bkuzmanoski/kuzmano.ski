import { toRootRelative } from "./paths.ts";

import type { Logger, LoggerEvent, SourceLocation } from "babel-plugin-react-compiler";
import type { Plugin } from "vite";

/** A function the React Compiler met but could not optimize. */
export interface CompilerBailout {
  file: string;
  line: number | null;
  reason: string;
}

// A location is `GeneratedSource` (a symbol) for a node the compiler synthesised itself.
const lineOf = (location: SourceLocation | null | undefined) =>
  typeof location === "object" && location !== null ? location.start.line : null;

const functionLine = (event: LoggerEvent) => ("fnLoc" in event ? lineOf(event.fnLoc) : null);

/**
 * Reads a bailout out of a compiler event, or `null` for an event that reports no bailout.
 *
 * A bailout leaves the whole enclosing component or hook uncompiled: every value it
 * builds is rebuilt on every render, and every consumer downstream of those values
 * re-renders with it.
 *
 * `CompileSkip` is not a bailout. The compiler only logs it for an opt-out directive.
 */
export function bailoutFrom(filename: string | null, event: LoggerEvent): CompilerBailout | null {
  const file = filename === null ? "unknown file" : toRootRelative(filename);

  switch (event.kind) {
    case "CompileError":
      return {
        file,
        line: lineOf(event.detail.primaryLocation()) ?? functionLine(event),
        reason: [event.detail.reason, event.detail.description].filter(Boolean).join(": "),
      };

    case "PipelineError":
      return { file, line: functionLine(event), reason: event.data };

    default:
      return null;
  }
}

/** One line per bailout, in the order the compiler met them. */
export const formatBailouts = (bailouts: Array<CompilerBailout>) =>
  bailouts.map(({ file, line, reason }) => `  ${file}${line === null ? "" : `:${line}`} — ${reason}`).join("\n");

/**
 * A logger to hand to `reactCompilerPreset`, paired with a plugin that fails the
 * build on anything it collected.
 *
 * The `react-hooks` lint rules catch the bailouts they know how to describe (see
 * `/eslint.config.ts`); this catches the rest, against the code the build ships.
 */
export function reactCompilerBailouts(): { logger: Logger; plugin: Plugin } {
  const bailouts: Array<CompilerBailout> = [];

  return {
    logger: {
      logEvent(filename, event) {
        const bailout = bailoutFrom(filename, event);

        if (bailout) {
          bailouts.push(bailout);
        }
      },
    },
    plugin: {
      name: "kuzmano.ski:react-compiler-bailouts",
      apply: "build",
      applyToEnvironment: (environment) => environment.name === "client",
      buildEnd(error) {
        if (error || bailouts.length === 0) {
          return; // A failed build has already reported why, and its bailouts are incomplete.
        }

        this.error(
          `The React Compiler could not optimize ${bailouts.length} ` +
            `function${bailouts.length === 1 ? "" : "s"}, leaving ${bailouts.length === 1 ? "it" : "them"} ` +
            `to re-render unmemoized:\n${formatBailouts(bailouts)}`,
        );
      },
    },
  };
}
