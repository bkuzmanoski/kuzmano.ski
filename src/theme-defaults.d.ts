/** The default theme chroma scale declared in `/src/styles.css`. */
declare module "virtual:theme-defaults" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- A top-level import would make this an invalid module augmentation.
  export const THEME_DEFAULTS: import("./lib/settings/theme-tint.ts").ThemeDefaults;
}
