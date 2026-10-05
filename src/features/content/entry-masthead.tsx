import { useId } from "react";

import { ControlledCopyButton } from "#/components/copy-button.tsx";
import { ShareButton } from "#/components/share-button.tsx";
import { ENTRY_DATE_FORMAT } from "#/config/content.ts";
import { formatDate } from "#/lib/datetime.ts";
import { useIsHydrated } from "#/lib/hooks/use-client-value.ts";
import { useDateFormat } from "#/lib/hooks/use-date-format.ts";
import { languageAttributeInDocumentFor } from "#/site/language.ts";
import { canonicalUrl } from "#/site/metadata.ts";
import type { CollectionEntryTarget } from "#/site/windows.ts";

import { ContentLink } from "./content-link.tsx";
import { useEntryClipboard } from "./entry-clipboard.ts";
import styles from "./entry-masthead.module.css";

export function EntryMasthead({ target: { collection, slug } }: { target: CollectionEntryTarget }) {
  const copyControlId = useId();
  const entryClipboard = useEntryClipboard();
  const dateFormat = useDateFormat(ENTRY_DATE_FORMAT);
  const isHydrated = useIsHydrated();

  const frontmatter = collection.frontmatterOf(slug);
  const url = canonicalUrl(collection.routeOf(slug));

  return (
    <div className={styles.masthead} data-entry-masthead data-content-default-styles="off" data-feed-omit>
      <p className={styles.facts}>
        <ContentLink href={collection.route} className={styles.collectionLink}>
          {collection.title}
        </ContentLink>
        {frontmatter && (
          <time dateTime={frontmatter.date} lang={languageAttributeInDocumentFor(dateFormat)}>
            {formatDate(frontmatter.date, dateFormat)}
          </time>
        )}
        {frontmatter?.category !== undefined && <span>{frontmatter.category}</span>}
      </p>
      <div className={styles.actions}>
        <ControlledCopyButton
          copyStatus={entryClipboard?.copyStatusOf(copyControlId) ?? null}
          disabled={!isHydrated || entryClipboard === null}
          announcesConfirmation={false}
          variant="url"
          label="Copy link"
          onCopy={() => entryClipboard?.copyToClipboard(copyControlId, url, "link")}
          onDidHide={() => entryClipboard?.clearCopyConfirmationOf(copyControlId)}
        />
        <ShareButton url={url} title={frontmatter?.title} disabled={!isHydrated} className={styles.shareButton} />
      </div>
    </div>
  );
}
