import { ENTRY_DATE_FORMAT } from "#/config/content.ts";
import { cx } from "#/lib/class-names.ts";
import { entrySiblings } from "#/lib/content/entry-siblings.ts";
import { markdownPath } from "#/lib/content/paths.ts";
import { formatDate } from "#/lib/datetime.ts";
import { useDateFormat } from "#/lib/hooks/use-date-format.ts";
import type { Collection, Entry } from "#/site/catalog.ts";
import { collectionFeedOf } from "#/site/feeds.ts";
import { languageAttributeInDocumentFor } from "#/site/language.ts";
import { hasMarkdownRepresentation } from "#/site/markdown-negotiation.ts";
import type { CollectionEntryTarget } from "#/site/windows.ts";

import { ContentLink } from "./content-link.tsx";
import styles from "./entry-colophon.module.css";

type SiblingDirection = "newer" | "older";

const SIBLING_DIRECTION_LABELS: Record<SiblingDirection, string> = { newer: "Newer", older: "Older" };

function SiblingLink({
  collection,
  entry,
  direction,
}: {
  collection: Collection;
  entry: Entry;
  direction: SiblingDirection;
}) {
  const dateFormat = useDateFormat(ENTRY_DATE_FORMAT);
  return (
    <ContentLink
      href={collection.routeOf(entry.slug)}
      className={cx(styles.siblingLink, direction === "newer" && styles.newer)}
    >
      {/* The spaces separate the parts of that name (they are not rendered). */}
      <span className={styles.siblingDirection}>{SIBLING_DIRECTION_LABELS[direction]}</span>{" "}
      <span className={styles.siblingTitle}>{entry.title}</span>{" "}
      <time className={styles.siblingDate} dateTime={entry.date} lang={languageAttributeInDocumentFor(dateFormat)}>
        {formatDate(entry.date, dateFormat)}
      </time>
    </ContentLink>
  );
}

export function EntryColophon({ target: { collection, slug } }: { target: CollectionEntryTarget }) {
  const { newer, older } = entrySiblings(collection, slug);
  const feed = collectionFeedOf(collection.route);
  const hasMarkdown = hasMarkdownRepresentation(collection.frontmatterOf(slug));

  return (
    <footer
      className={styles.colophon}
      data-entry-colophon
      data-content-default-styles="off"
      data-content-span="rail"
      data-content-space="loose"
      data-feed-omit
    >
      {(hasMarkdown || feed) && (
        <>
          <p className={styles.label}>Formats</p>
          <p className={styles.formats} data-content-default-styles="on">
            {hasMarkdown && <ContentLink href={markdownPath(collection.routeOf(slug))}>Markdown</ContentLink>}
            {feed && <ContentLink href={feed.path}>Atom feed</ContentLink>}
          </p>
        </>
      )}
      {(older !== null || newer !== null) && (
        <nav className={styles.siblings} aria-label="More entries">
          {older ? (
            <SiblingLink collection={collection} entry={older} direction="older" />
          ) : (
            <div className={styles.siblingPlaceholder} aria-hidden />
          )}
          {newer ? (
            <SiblingLink collection={collection} entry={newer} direction="newer" />
          ) : (
            <div className={styles.siblingPlaceholder} aria-hidden />
          )}
        </nav>
      )}
    </footer>
  );
}
