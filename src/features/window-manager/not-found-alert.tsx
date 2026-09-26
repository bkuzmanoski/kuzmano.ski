import { Alert } from "#/components/alert.tsx";
import { NOT_FOUND_DOCUMENT_TITLE } from "#/config/site.ts";
import { useNotFoundRoute, useWindowActions } from "#/lib/window-manager/context.ts";

export function NotFoundAlert() {
  const notFoundRoute = useNotFoundRoute();
  const { dismissNotFoundAlert } = useWindowActions();

  return (
    <Alert
      label={NOT_FOUND_DOCUMENT_TITLE}
      sound="none"
      message={`This page doesn’t exist. Try finding the page you were looking for in the “Go” menu.`}
      open={notFoundRoute !== null}
      primaryAction={{ label: "OK", onAction: dismissNotFoundAlert }}
    />
  );
}
