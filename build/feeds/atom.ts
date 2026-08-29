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

const HTML_ESCAPE_VALUES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

// eslint-disable-next-line no-control-regex -- The pattern intentionally matches control characters.
const FORBIDDEN_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
const LONE_SURROGATES = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

const escapeXml = (value: string) =>
  value
    .replace(FORBIDDEN_CHARACTERS, "")
    .replace(LONE_SURROGATES, "")
    .replace(/[&<>"']/g, (character) => HTML_ESCAPE_VALUES[character]!);
const element = (name: string, value: string, attributes = "") => `<${name}${attributes}>${escapeXml(value)}</${name}>`;
const link = (rel: string, type: string, href: string) =>
  `<link rel="${rel}" type="${type}" href="${escapeXml(href)}"/>`;
const timestamp = (date: string) => `${date}T00:00:00Z`; // Widens a calendar date to the RFC 3339 timestamp Atom requires. Content is dated by day, so the time of day is not known; midnight UTC stands in for it.
const entryXml = ({ title, description, url, markdownUrl, date, category, content }: FeedEntry) =>
  [
    "  <entry>",
    `    ${element("title", title)}`,
    `    ${element("id", url)}`,
    `    ${link("alternate", "text/html", url)}`,
    `    ${link("alternate", "text/markdown", markdownUrl)}`,
    `    ${element("published", timestamp(date))}`,
    `    ${element("updated", timestamp(date))}`,
    ...(category ? [`    <category term="${escapeXml(category)}"/>`] : []),
    `    ${element("summary", description)}`,
    `    ${element("content", content, ' type="html"')}`,
    "  </entry>",
  ].join("\n");

/** Serializes a feed as Atom 1.0. */
export function atomFeed({ title, subtitle, author, icon, logo, url, selfUrl, updated, entries }: Feed): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  ${element("title", title)}`,
    `  ${element("subtitle", subtitle)}`,
    `  ${element("id", url)}`,
    `  ${element("icon", icon)}`,
    `  ${element("logo", logo)}`,
    `  ${link("self", "application/atom+xml", selfUrl)}`,
    `  ${link("alternate", "text/html", url)}`,
    `  ${element("updated", timestamp(updated))}`,
    `  <author>${element("name", author)}</author>`,
    ...entries.map(entryXml),
    "</feed>",
    "",
  ].join("\n");
}
