import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Cloudflare applies the rules in `_headers` to the static assets it serves.
// Each plugin writes the rules for the files it emits.

const HEADERS_FILE_NAME = "_headers";

export interface HeadersRule {
  description: string;
  pathPatterns: Array<string>;
  headers: Record<string, string>;
}

export const headersRuleText = ({ description, pathPatterns, headers }: HeadersRule) =>
  [
    `# ${description}`,
    ...pathPatterns.flatMap((pathPattern) => [
      pathPattern,
      ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`),
    ]),
  ].join("\n");

export function headersWithRules(headersFileText: string, rules: Array<HeadersRule>): string {
  const addedRuleTexts = rules.map(headersRuleText).filter((ruleText) => !headersFileText.includes(ruleText));
  return `${[headersFileText.trimEnd(), ...addedRuleTexts].filter(Boolean).join("\n\n")}\n`;
}

/** Adds rules to the `_headers` file in a build's output, creating the file when no earlier step has written one. */
export async function addHeadersRules(outputDirectoryAbsolutePath: string, rules: Array<HeadersRule>) {
  const headersAbsolutePath = join(outputDirectoryAbsolutePath, HEADERS_FILE_NAME);
  const headersFileText = await readFile(headersAbsolutePath, "utf8").catch((cause: unknown) => {
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") {
      return "";
    }

    throw cause;
  });

  await writeFile(headersAbsolutePath, headersWithRules(headersFileText, rules));
}
