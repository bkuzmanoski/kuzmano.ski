import { CopyButton } from "#/components/copy-button.tsx";
import { ShareButton } from "#/components/share-button.tsx";
import { ENTRY_DATE_FORMAT } from "#/config/content.ts";
import { NavigationButton } from "#/features/windows/navigation-button.tsx";
import { entrySiblings } from "#/lib/content/siblings.ts";
import { formatDate } from "#/lib/datetime.ts";
import { useCanShare } from "#/lib/hooks/use-can-share.ts";
import { useDateFormat } from "#/lib/hooks/use-date-format.ts";
import { languageAttributeInDocumentFor } from "#/site/language.ts";
import { canonicalUrl } from "#/site/metadata.ts";
import type { EntryTarget } from "#/site/windows.ts";

import styles from "./entry-toolbar.module.css";

export function EntryToolbar({ target }: { target: EntryTarget }) {
  const canShare = useCanShare();
  const dateFormat = useDateFormat(ENTRY_DATE_FORMAT);

  if (target.collectionRoute === null) {
    return null; // Standalone pages have no collection to step through, so they do not render a toolbar.
  }

  const { contentIndex, slug } = target;
  const frontmatter = contentIndex.frontmatterOf(slug);
  const url = canonicalUrl(contentIndex.routeOf(slug));
  const { previous, next } = entrySiblings(contentIndex, slug);

  return (
    <div className={styles.toolbar}>
      <div className={styles.navigation}>
        <NavigationButton variant="previous" label="Previous entry" route={previous} />
        <NavigationButton variant="next" label="Next entry" route={next} />
      </div>
      {frontmatter && (
        <time
          className={styles.date}
          dateTime={frontmatter.date}
          lang={languageAttributeInDocumentFor(dateFormat)} // Formatted in the browser's locale.
        >
          {formatDate(frontmatter.date, dateFormat)}
        </time>
      )}
      <div className={styles.actions}>
        <CopyButton value={url} entity="link" variant="url" label="Copy link" />
        {canShare && <ShareButton url={url} title={frontmatter?.title} />}
      </div>
    </div>
  );
}
