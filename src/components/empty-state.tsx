import styles from "./empty-state.module.css";

export function EmptyState({ message }: { message: string }) {
  return <p className={styles.emptyState}>{message}</p>;
}
