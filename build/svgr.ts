/**
 * `black` and `white` are reserved keywords for the foreground and background of
 * icons. They are replaced with CSS variables to allow for theming.
 *
 * The variables fall back to the pair a themed element already has, so an icon
 * inherits its context by default and only needs the properties set where it
 * must not follow the theme.
 */
export const svgrOptions = {
  replaceAttrValues: {
    black: "var(--icon-foreground, currentColor)",
    white: "var(--icon-background, var(--color-background))",
  },
};
