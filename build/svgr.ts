/**
 * `black` and `white` are reserved keywords for the foreground and background of
 * icons. They are replaced with CSS variables to allow for theming.
 */
export const svgrOptions = {
  replaceAttrValues: {
    black: "var(--color-icon-foreground)",
    white: "var(--color-icon-background)",
  },
};
