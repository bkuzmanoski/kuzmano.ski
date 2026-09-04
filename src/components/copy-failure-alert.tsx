import { Alert } from "./alert.tsx";

export function CopyFailureAlert({
  entity,
  open,
  onDismiss,
}: {
  entity: string;
  open: boolean;
  onDismiss: () => void;
}) {
  return (
    <Alert
      variant="error"
      message={`The ${entity} couldn’t be copied. Check your browser permissions.`}
      open={open}
      primaryAction={{ label: "OK", onAction: onDismiss }}
    />
  );
}
