export interface Frontmatter {
  title: string;
  description: string;
  date: string;
  draft?: boolean;
}

export interface ContentEntry extends Frontmatter {
  slug: string;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function parseFrontmatter(source: unknown, id: string): Frontmatter {
  if (typeof source !== "object" || source === null) {
    throw new Error(`[CONTENT] Entry '${id}' is missing a frontmatter block`);
  }

  const { title, description, date, draft } = source as Record<string, unknown>;

  if (typeof title !== "string" || title.length === 0) {
    throw new Error(`[CONTENT] Entry '${id}' is missing a title`);
  }

  if (typeof description !== "string" || description.length === 0) {
    throw new Error(`[CONTENT] Entry '${id}' is missing a description`);
  }

  if (!isIsoDate(date)) {
    throw new Error(`[CONTENT] Entry '${id}' has a non-ISO date value: ${String(date)}`);
  }

  if (draft !== undefined && typeof draft !== "boolean") {
    throw new Error(`[CONTENT] Entry '${id}' has a non-boolean draft value: ${String(draft)}`);
  }

  return { title, description, date, draft };
}
