import { createElement } from "react";

import type { ContentSource } from "#/lib/content/catalog";

import type { MDXContent } from "mdx/types";

export const CONTENT_ROOT = "/content";

export interface FakeDocument {
  frontmatter?: unknown;
  styles?: { page?: string };
  asset?: string;
  body?: MDXContent;
}

const DATE = "2026-07-19";

const fakeBody =
  (path: string): MDXContent =>
  () =>
    createElement("p", null, `The body of ${path}.`);

export function frontmatterOf(title: string, overrides: Record<string, unknown> = {}) {
  return { title, description: `About ${title}.`, date: DATE, ...overrides };
}

export function fakeContentSource(
  documents: Record<string, FakeDocument>,
  overrides: Partial<ContentSource> = {},
): ContentSource {
  const source: ContentSource = {
    root: CONTENT_ROOT,
    frontmatter: {},
    content: {},
    styles: {},
    assets: {},
  };

  for (const [key, document] of Object.entries(documents)) {
    const path = `${CONTENT_ROOT}/${key}`;
    const body = document.body ?? fakeBody(path);

    source.frontmatter[path] = { default: document.frontmatter ?? frontmatterOf(key.replace(/\.mdx$/, "")) };
    source.content[path] = () => Promise.resolve({ default: body });

    if (document.styles) {
      const styles = document.styles;
      source.styles[path.replace(/\.mdx$/, ".module.css")] = () => Promise.resolve({ default: styles });
    }

    if (document.asset) {
      source.assets[path] = document.asset;
    }
  }

  return { ...source, ...overrides };
}
