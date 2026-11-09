import type { Plugin } from "vite";

/** The names of the members of `Plugin` that are hooks, either as a function or as an object with a `handler`. */
type PluginHookName = {
  [TName in keyof Plugin]-?: NonNullable<Plugin[TName]> extends
    ((...args: never) => unknown) | { handler: (...args: never) => unknown }
    ? TName
    : never;
}[keyof Plugin];

export type ResolveIdHook = (source: string) => string | null;
export type LoadHook<TContext = unknown> = (this: TContext, id: string) => Promise<string | null>;

/**
 * A hook invoked by a test with a context but no arguments, such as `generateBundle` when it does not use the bundle.
 */
export type ContextHook<TContext = unknown> = (this: TContext) => void | Promise<void>;

/**
 * Returns the `hookName` hook of `plugin`, or the handler of an object hook, as `THook`. `THook` declares only the
 * context and arguments a test supplies, so a test can call the hook outside Vite.
 *
 * Throws, naming the plugin, when the plugin does not have the hook.
 */
export function hookOf<THook extends (...args: never) => unknown>(plugin: Plugin, hookName: PluginHookName): THook {
  const hook: unknown = plugin[hookName];
  const handler: unknown = typeof hook === "object" && hook !== null && "handler" in hook ? hook.handler : hook;

  if (typeof handler !== "function") {
    throw new Error(`\`${plugin.name}\` does not have the \`${hookName}\` hook.`);
  }

  return handler as THook;
}
