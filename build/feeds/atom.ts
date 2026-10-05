import { toXml } from "xast-util-to-xml";
import { x } from "xastscript";

import { FEED_MEDIA_TYPE, HTML_MEDIA_TYPE, MARKDOWN_MEDIA_TYPE } from "#/config/media-types.ts";
import { midnightTimestampIn } from "#/lib/datetime.ts";

export interface FeedEntry {
  title: string;
  description: string;
  url: string;
  markdownUrl: string;
  date: string; // ISO calendar date as defined in the content frontmatter.
  category: string | undefined;
  content: string;
}

export interface Feed {
  title: string;
  subtitle: string;
  author: string;
  authorUrl: string;
  icon: string;
  logo: string;
  url: string;
  selfUrl: string;
  updated: string;
  timeZone: string;
  entries: Array<FeedEntry>;
}

// eslint-disable-next-line no-control-regex -- The pattern intentionally matches control characters.
const FORBIDDEN_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
const LONE_SURROGATES = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const CDATA_END = /]]>/g;

const removeForbiddenCharacters = (value: string) =>
  value.replace(FORBIDDEN_CHARACTERS, "").replace(LONE_SURROGATES, "");
const link = (rel: string, type: string, href: string) =>
  x("link", { rel, type, href: removeForbiddenCharacters(href) });

// `x` reads any object in its second argument as attributes, so an element whose children are
// elements passes them as an array rather than as separate arguments.
const entryElement = (
  { title, description, url, markdownUrl, date, category, content }: FeedEntry,
  timestamp: (date: string) => string,
) =>
  x("entry", [
    x("title", removeForbiddenCharacters(title)),
    x("id", removeForbiddenCharacters(url)),
    link("alternate", HTML_MEDIA_TYPE, url),
    link("alternate", MARKDOWN_MEDIA_TYPE, markdownUrl),
    x("published", timestamp(date)),
    x("updated", timestamp(date)),
    category ? x("category", { term: removeForbiddenCharacters(category) }) : undefined,
    x("summary", removeForbiddenCharacters(description)),
    x("content", { type: "html" }, removeForbiddenCharacters(content)),
  ]);

/** Serializes a feed as Atom 1.0. */
export function atomFeed({
  title,
  subtitle,
  author,
  authorUrl,
  icon,
  logo,
  url,
  selfUrl,
  updated,
  timeZone,
  entries,
}: Feed): string {
  const timestamp = (date: string) => midnightTimestampIn(timeZone, date);
  const feedTree = x(null, [
    {
      type: "instruction",
      name: "xml",
      value: 'version="1.0" encoding="utf-8"',
    },
    x("feed", { xmlns: "http://www.w3.org/2005/Atom" }, [
      x("title", removeForbiddenCharacters(title)),
      subtitle ? x("subtitle", removeForbiddenCharacters(subtitle)) : undefined,
      x("id", removeForbiddenCharacters(url)),
      x("icon", removeForbiddenCharacters(icon)),
      x("logo", removeForbiddenCharacters(logo)),
      link("self", FEED_MEDIA_TYPE, selfUrl),
      link("alternate", HTML_MEDIA_TYPE, url),
      x("updated", timestamp(updated)),
      x("author", [x("name", removeForbiddenCharacters(author)), x("uri", removeForbiddenCharacters(authorUrl))]),
      ...entries.map((entry) => entryElement(entry, timestamp)),
    ]),
  ]);
  return toXml(feedTree, { closeEmptyElements: true, tightClose: true }).replace(CDATA_END, "]]&gt;");
}
