import { toXml } from "xast-util-to-xml";
import { x } from "xastscript";

import { FEED_TYPE } from "#/config/site.ts";

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
  icon: string;
  logo: string;
  url: string;
  selfUrl: string;
  updated: string;
  entries: Array<FeedEntry>;
}

// eslint-disable-next-line no-control-regex -- The pattern intentionally matches control characters.
const FORBIDDEN_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
const LONE_SURROGATES = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const CDATA_END = /]]>/g;

const removeForbiddenCharacters = (value: string) =>
  value.replace(FORBIDDEN_CHARACTERS, "").replace(LONE_SURROGATES, "");
const timestamp = (date: string) => `${date}T00:00:00Z`; // Converts a day-only date to the RFC 3339 timestamp Atom requires; midnight UTC is used because no time of day is known.
const link = (rel: string, type: string, href: string) =>
  x("link", { rel, type, href: removeForbiddenCharacters(href) });

// `x` reads any object in its second argument as attributes, so an element whose children are
// elements passes them as an array rather than as separate arguments.
const entryElement = ({ title, description, url, markdownUrl, date, category, content }: FeedEntry) =>
  x("entry", [
    x("title", removeForbiddenCharacters(title)),
    x("id", removeForbiddenCharacters(url)),
    link("alternate", "text/html", url),
    link("alternate", "text/markdown", markdownUrl),
    x("published", timestamp(date)),
    x("updated", timestamp(date)),
    category ? x("category", { term: removeForbiddenCharacters(category) }) : undefined,
    x("summary", removeForbiddenCharacters(description)),
    x("content", { type: "html" }, removeForbiddenCharacters(content)),
  ]);

/** Serializes a feed as Atom 1.0. */
export function atomFeed({ title, subtitle, author, icon, logo, url, selfUrl, updated, entries }: Feed): string {
  const feedTree = x(null, [
    {
      type: "instruction",
      name: "xml",
      value: 'version="1.0" encoding="utf-8"',
    },
    x("feed", { xmlns: "http://www.w3.org/2005/Atom" }, [
      x("title", removeForbiddenCharacters(title)),
      x("subtitle", removeForbiddenCharacters(subtitle)),
      x("id", removeForbiddenCharacters(url)),
      x("icon", removeForbiddenCharacters(icon)),
      x("logo", removeForbiddenCharacters(logo)),
      link("self", FEED_TYPE, selfUrl),
      link("alternate", "text/html", url),
      x("updated", timestamp(updated)),
      x("author", [x("name", removeForbiddenCharacters(author))]),
      ...entries.map(entryElement),
    ]),
  ]);
  return toXml(feedTree, { closeEmptyElements: true, tightClose: true }).replace(CDATA_END, "]]&gt;");
}
