import { isIsoDate } from "../datetime.ts";
import { isRecord } from "../guards.ts";

export interface Frontmatter {
  title: string;
  description: string;
  category?: string;
  date: string;
  draft?: boolean;
}

const STRAIGHT_QUOTE_PATTERN = /["']/;

export function parseFrontmatter(input: unknown, path: string): Frontmatter {
  if (!isRecord(input)) {
    throw new Error(`"${path}" is missing a frontmatter block.`);
  }

  const { title, description, date, category, draft } = input;

  if (typeof title !== "string" || title.length === 0) {
    throw new Error(`"${path}" is missing a title.`);
  }

  if (typeof description !== "string" || description.length === 0) {
    throw new Error(`"${path}" is missing a description.`);
  }

  if (!isIsoDate(date)) {
    throw new Error(`"${path}" has a non-ISO date value: ${String(date)}`);
  }

  if (category !== undefined && typeof category !== "string") {
    throw new Error(`"${path}" has a non-string category value: ${JSON.stringify(category)}`);
  }

  // The `typographic-quotes` markdownlint rule checks the body's quotes but cannot report
  // a line in the frontmatter, so the frontmatter's prose fields are checked here.
  for (const [fieldName, value] of Object.entries({ title, description, category })) {
    if (value !== undefined && STRAIGHT_QUOTE_PATTERN.test(value)) {
      throw new Error(`"${path}" has a straight quote in its ${fieldName}: ${value}`);
    }
  }

  if (draft !== undefined && typeof draft !== "boolean") {
    throw new Error(`"${path}" has a non-boolean draft value: ${JSON.stringify(draft)}`);
  }

  return { title, description, date, category, draft };
}
