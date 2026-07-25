import styles from "./menu-bar.module.css";

const MENUS = ["File", "View", "Special"];

export function MenuBar() {
  return (
    <div className={styles.menuBar} role="menubar">
      <span className={styles.apple} role="menuitem">
        
      </span>
      {MENUS.map((label) => (
        <span key={label} className={styles.menu} role="menuitem">
          {label}
        </span>
      ))}
    </div>
  );
}
