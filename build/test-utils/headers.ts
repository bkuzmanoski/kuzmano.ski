import { vi } from "vitest";

import type { AddHeadersRules, HeadersRule } from "../headers.ts";
import type { Plugin } from "vite";

/**
 * Calls the `buildStart` hook of the plugin `pluginFor` creates, in the environment named
 * `environmentName`, and returns the rules the hook adds to `_headers`.
 */
export function headersRulesAddedAtBuildStartBy(
  pluginFor: (options: { addHeadersRules: AddHeadersRules }) => Plugin,
  environmentName: string,
): Array<HeadersRule> {
  const addHeadersRules = vi.fn<AddHeadersRules>();

  (pluginFor({ addHeadersRules }).buildStart as (this: unknown) => void).call({
    environment: { name: environmentName },
  });

  return addHeadersRules.mock.calls.flatMap(([rules]) => rules);
}
