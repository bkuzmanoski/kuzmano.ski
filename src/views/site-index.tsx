import { DESTINATIONS, DESTINATION_ORDER } from "#/config/navigation";
import type { DestinationId } from "#/config/navigation";
import { collections } from "#/content";

import styles from "./site-index.module.css";

function destinationLinks(id: DestinationId) {
  const { route, title } = DESTINATIONS[id];
  const entries = collections[route.slice(1)]?.list() ?? [];

  return (
    <li key={id}>
      <a href={route} tabIndex={-1}>
        {title}
      </a>
      {entries.length > 0 && (
        <ul>
          {entries.map(({ slug, title: entryTitle }) => (
            <li key={slug}>
              <a href={`${route}/${slug}`} tabIndex={-1}>
                {entryTitle}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Provides a prerendered list of links so every page is discoverable without hydration.
 *
 * The list is visually hidden but remains available to assistive technology and
 * crawlers. It is excluded from the tab order to avoid making invisible links part of
 * normal keyboard navigation.
 */
export function SiteIndex() {
  return (
    <nav className={styles.siteIndex} aria-label="All pages">
      <ul>{DESTINATION_ORDER.map(destinationLinks)}</ul>
    </nav>
  );
}
