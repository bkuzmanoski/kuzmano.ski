import { describe, expect, test } from "vitest";

import type { Experience } from "#/lib/experience/career-timeline.ts";

import { experienceMarkdownNodesFrom } from "./experience.ts";
import { markdownFrom } from "./nodes.ts";

const EXPERIENCE: Experience = {
  asOf: "2026-09",
  disciplines: [{ id: "discipline", name: "Discipline", accentColor: "blue" }],
  roles: [
    {
      title: "Oldest Role",
      organization: "Oldest Organization",
      disciplines: ["discipline"],
      start: "2015-01",
      end: "2018-06",
      summary: "A summary of the oldest role.",
    },
    {
      title: "Newest Role",
      organization: "Newest Organization",
      disciplines: ["discipline"],
      start: "2024-03",
      end: null,
      summary: "A summary of the newest role.",
      highlights: ["A first highlight.", "A second highlight."],
      link: { label: "Read the entry", href: "/collection/entry" },
    },
  ],
};
const QUOTED_DATA_FILE_PATH = '"entry.data.ts"';

const markdownOf = (value: unknown) => markdownFrom(experienceMarkdownNodesFrom(value, QUOTED_DATA_FILE_PATH));

describe("experienceMarkdownNodesFrom", () => {
  test("writes each role newest first under a second-level heading", () => {
    expect(markdownOf(EXPERIENCE)).toBe(`## Newest Role, Newest Organization

_Mar 2024–Present_

A summary of the newest role.

- A first highlight.
- A second highlight.

[Read the entry](/collection/entry)

## Oldest Role, Oldest Organization

_Jan 2015–June 2018_

A summary of the oldest role.
`);
  });

  test("throws when the `asOf` month is not written as `YYYY-MM`, naming the file and the value", () => {
    expect(() => markdownOf({ ...EXPERIENCE, asOf: "soon" })).toThrow(
      '"entry.data.ts" is not a valid experience record: Expected a month as "YYYY-MM", but received "soon".',
    );
  });
});
