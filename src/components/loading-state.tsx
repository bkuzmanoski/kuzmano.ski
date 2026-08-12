import styles from "./loading-state.module.css";
import { Spinner } from "./spinner";

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className={styles.loadingState}>
      <Spinner label={label} />
    </div>
  );
}
