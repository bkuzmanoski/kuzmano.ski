/** Theme colors resolved from `/src/styles.css`. */
declare module "virtual:theme-colors" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- A top-level import would make this an invalid module augmentation.
  export const THEME_COLORS: import("../build/stylesheet/theme-colors.ts").ThemeColors;
}
