/* The map built by `build/content-assets.ts` from the client bundle. */
declare module "virtual:content-assets" {
  /** The URL of each content file's client chunk, keyed by its `import.meta.glob` path. */
  export const CONTENT_ASSETS: Record<string, string | undefined>;
}
