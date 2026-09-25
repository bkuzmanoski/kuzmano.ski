import { DESTINATION_ORDER } from "#/config/navigation.ts";
import type { DestinationId } from "#/config/navigation.ts";
import { DESTINATIONS } from "#/site/navigation.ts";

import styles from "./site-index.module.css";

function destinationLink(id: DestinationId) {
  const { route, title } = DESTINATIONS[id];

  return (
    <li key={id}>
      <a href={route}>{title}</a>
    </li>
  );
}

/**
 * Provides a prerendered list of links so every destination is discoverable without hydration. Only the
 * top-level routes are listed; each collection's own document lists its entries, so a crawler reaches
 * them one hop further in. The list is visually hidden and inert.
 */
export function SiteIndex() {
  return (
    <nav className={styles.siteIndex} inert>
      <ul>{DESTINATION_ORDER.map(destinationLink)}</ul>
    </nav>
  );
}
