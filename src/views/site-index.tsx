import { DESTINATIONS, DESTINATION_ORDER } from "#/config/navigation";
import type { DestinationId } from "#/config/navigation";

import styles from "./site-index.module.css";

function destinationLink(id: DestinationId) {
  const { route, title } = DESTINATIONS[id];

  return (
    <li key={id}>
      <a href={route} tabIndex={-1}>
        {title}
      </a>
    </li>
  );
}

/**
 * Provides a prerendered list of links so every page is discoverable without hydration.
 *
 * Only root routes are listed; each collection page enumerates its own entries, so
 * crawlers reach them one hop further in.
 *
 * The list is visually hidden but remains available to assistive technology. It is  excluded
 * from the tab order to avoid making invisible links part of normal keyboard navigation.
 */
export function SiteIndex() {
  return (
    <nav className={styles.siteIndex} aria-label="All pages">
      <ul>{DESTINATION_ORDER.map(destinationLink)}</ul>
    </nav>
  );
}
