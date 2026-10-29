interface MenuShortcut {
  code: string;
  label: string;
}

export type MenuItem =
  | ({
      kind: "action";
      label: string;
      accessory?: MenuItemAccessory;
    } & (
      | { href?: undefined; target?: undefined; disabled?: boolean; action: () => void; shortcut?: MenuShortcut }
      | { href: string; target?: "_blank"; disabled?: undefined; action: () => void; shortcut?: MenuShortcut }
      | { href: string; target?: "_blank"; disabled?: undefined; action?: undefined; shortcut?: undefined }
    ))
  | { kind: "separator" };

export type MenuItemAccessory = "download" | "external-link";

/** Combines non-empty item groups into a single list, inserting separators between groups. */
export const joinedWithSeparators = (groups: Array<Array<MenuItem>>): Array<MenuItem> =>
  groups
    .filter((group) => group.length > 0)
    .flatMap((group, index) => [...(index > 0 ? [{ kind: "separator" } as const] : []), ...group]);
