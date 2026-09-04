import { CopyButton } from "#/components/copy-button.tsx";
import { ENTRY_DATE_FORMAT } from "#/config/content.ts";
import { NavigationButton } from "#/features/windows/navigation-button.tsx";
import { entrySiblings } from "#/lib/content/siblings.ts";
import { formatDate } from "#/lib/date.ts";
import { useDateFormat } from "#/lib/hooks/use-date-format.ts";
import { canonicalUrl } from "#/site/metadata.ts";
import type { EntryTarget } from "#/site/windows.ts";

import styles from "./entry-toolbar.module.css";

export function EntryToolbar({ target }: { target: EntryTarget }) {
  const dateFormat = useDateFormat(ENTRY_DATE_FORMAT);

  if (target.collectionRoute === null) {
    return null; // Standalone pages have no collection to step through, so they do not render a toolbar.
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
