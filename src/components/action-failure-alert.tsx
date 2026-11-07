import { Alert } from "./alert.tsx";

const FAILED_ACTION_PARTICIPLES = { copy: "copied", share: "shared" } as const;

export function ActionFailureAlert({
  action,
  entity,
  isPermissionDenied,
  open,
  onDismiss,
}: {
  action: keyof typeof FAILED_ACTION_PARTICIPLES;
  entity: string;
  /** Whether the browser denied permission for the action. */
  isPermissionDenied: boolean;
  open: boolean;
  onDismiss: () => void;
}) {
  const failure = `The ${entity} couldn’t be ${FAILED_ACTION_PARTICIPLES[action]}.`;

  return (
    <Alert
      variant="error"
      message={isPermissionDenied ? `${failure} Check your browser permissions.` : failure}
      open={open}
      primaryAction={{ label: "OK", onAction: onDismiss }}
    />
  );
}
