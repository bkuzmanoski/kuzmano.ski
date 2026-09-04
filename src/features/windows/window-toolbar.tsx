import { EntryToolbar } from "#/features/content/entry-toolbar.tsx";
import { resolveWindow } from "#/site/windows.ts";

export function WindowToolbar({ route }: { route: string }) {
  const target = resolveWindow(route);

  switch (target?.id) {
    case "entry":
      return <EntryToolbar target={target} />;

    default:
      return null;
  }
}
