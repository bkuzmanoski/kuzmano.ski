import { isIsoDate } from "#/lib/date";

export interface Frontmatter {
  title: string;
  description: string;
  category?: string;
  date: string;
  draft?: boolean;
}

export interface Page extends Frontmatter {
  slug: string;
}

export function parseFrontmatter(source: unknown, id: string): Frontmatter {
  if (typeof source !== "object" || source === null) {
    throw new Error(`Page "${id}" is missing a frontmatter block.`);
  }

  const { title, description, date, category, draft } = source as Record<string, unknown>;

  if (typeof title !== "string" || title.length === 0) {
    throw new Error(`Page "${id}" is missing a title.`);
  }

  if (typeof description !== "string" || description.length === 0) {
    throw new Error(`Page "${id}" is missing a description.`);
  }

  if (!isIsoDate(date)) {
    throw new Error(`Page "${id}" has a non-ISO date value: ${String(date)}`);
  }

  if (category !== undefined && typeof category !== "string") {
    throw new Error(`Page "${id}" has a non-string category value: ${JSON.stringify(category)}`);
  }

  if (draft !== undefined && typeof draft !== "boolean") {
    throw new Error(`Page "${id}" has a non-boolean draft value: ${JSON.stringify(draft)}`);
  }

  return { title, description, date, category, draft };
}
