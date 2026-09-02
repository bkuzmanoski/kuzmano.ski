import { resolveWindow } from "#/site/windows";

import { EntryToolbar } from "./entry-toolbar";

export function WindowToolbar({ route }: { route: string }) {
  const target = resolveWindow(route);

  switch (target?.id) {
    case "entry":
      return <EntryToolbar target={target} />;

    default:
      return null;
  }
}
