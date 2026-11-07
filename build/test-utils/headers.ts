import { vi } from "vitest";

import { hookOf } from "./plugin-hooks.ts";

import type { AddHeadersRules, HeadersRule } from "../headers.ts";
import type { ContextHook } from "./plugin-hooks.ts";
import type { Plugin } from "vite";

/**
 * Calls the `buildStart` hook of the plugin `pluginFor` creates, in the environment named `environmentName`, and
 * resolves to the rules the hook adds to `_headers`.
 */
export async function headersRulesAddedAtBuildStartBy(
  pluginFor: (options: { addHeadersRules: AddHeadersRules }) => Plugin,
  environmentName: string,
): Promise<Array<HeadersRule>> {
  const addHeadersRules = vi.fn<AddHeadersRules>();

  await hookOf<ContextHook>(pluginFor({ addHeadersRules }), "buildStart").call({
    environment: { name: environmentName },
  });

  return addHeadersRules.mock.calls.flatMap(([rules]) => rules);
}
