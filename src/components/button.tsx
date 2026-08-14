import styles from "./button.module.css";

import type { ComponentPropsWithoutRef } from "react";

export function Button({ children, ...props }: ComponentPropsWithoutRef<"button">) {
  return (
    <button {...props} type="button" className={styles.button}>
      {children}
    </button>
  );
}
