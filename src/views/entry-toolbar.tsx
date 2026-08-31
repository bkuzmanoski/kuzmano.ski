import { CopyButton } from "#/components/copy-button";
import { NavigationButton } from "#/components/navigation-button";
import { ENTRY_DATE_FORMAT } from "#/config/content";
import { entrySiblings } from "#/content/entry-navigation";
import type { EntryTarget } from "#/content/window-registry";
import { formatDate } from "#/lib/date";
import { useDateFormat } from "#/lib/hooks/use-date-format";
import { canonicalUrl } from "#/metadata";

import styles from "./entry-toolbar.module.css";

export function EntryToolbar({ target }: { target: EntryTarget }) {
  const dateFormat = useDateFormat(ENTRY_DATE_FORMAT);

  if (target.collectionRoute === null) {
    return null; // Standalone entries have no collection to step through, so they do not render a toolbar.
  }

  const { contentIndex, slug } = target;
  const frontmatter = contentIndex.frontmatterOf(slug);
  const { previous, next } = entrySiblings(contentIndex, slug);

  return (
    <div className={styles.toolbar}>
      <div className={styles.navigation}>
        <NavigationButton variant="previous" label="Previous entry" route={previous} />
        <NavigationButton variant="next" label="Next entry" route={next} />
      </div>
      {frontmatter && (
        <time className={styles.date} dateTime={frontmatter.date}>
          {formatDate(frontmatter.date, dateFormat)}
        </time>
      )}
      <CopyButton
        value={canonicalUrl(contentIndex.routeOf(slug))}
        entity="link"
        variant="link"
        label="Copy link"
        className={styles.copyButton}
      />
    </div>
  );
}
