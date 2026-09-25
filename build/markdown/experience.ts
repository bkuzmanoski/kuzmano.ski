import { EXPERIENCE_MONTH_FORMAT } from "#/config/content.ts";
import { dateFormatterOf } from "#/lib/datetime.ts";
import {
  DEFAULT_CAREER_TIMELINE_DIRECTION,
  careerTimelineModelFrom,
  orderedCareerTimelineRoles,
  roleDatesLabelOf,
} from "#/lib/experience/career-timeline.ts";
import type { CareerTimelineModel, CareerTimelineRole, Experience } from "#/lib/experience/career-timeline.ts";

import { listOf, paragraphOf, textNode, textParagraph } from "./nodes.ts";

import type { ContentNode } from "../content/markup/tree.ts";

const PRERENDER_MONTH_FORMAT = dateFormatterOf(EXPERIENCE_MONTH_FORMAT);

function roleMarkdownNodesFrom(careerTimelineRole: CareerTimelineRole): Array<ContentNode> {
  const { role } = careerTimelineRole;
  const nodes: Array<ContentNode> = [
    { type: "heading", depth: 2, children: [textNode(`${role.title}, ${role.organization}`)] },
    paragraphOf([
      {
        type: "emphasis",
        children: [textNode(roleDatesLabelOf(role, PRERENDER_MONTH_FORMAT))],
      },
    ]),
    textParagraph(role.summary),
  ];

  if (role.highlights?.length) {
    nodes.push(listOf(role.highlights.map((highlight) => [textParagraph(highlight)])));
  }

  if (role.link) {
    nodes.push(paragraphOf([{ type: "link", url: role.link.href, children: [textNode(role.link.label)] }]));
  }

  return nodes;
}

/** The roles the experience timeline draws from the experience record an entry imports, written as Markdown nodes. */
export function experienceMarkdownNodesFrom(value: unknown, quotedDataFilePath: string): Array<ContentNode> {
  const experience = value as Experience;

  let careerTimelineModel: CareerTimelineModel;

  try {
    careerTimelineModel = careerTimelineModelFrom(experience);
  } catch (cause) {
    throw new Error(`${quotedDataFilePath} is not a valid experience record: ${(cause as Error).message}`, { cause });
  }

  return orderedCareerTimelineRoles(careerTimelineModel.careerTimelineRoles, DEFAULT_CAREER_TIMELINE_DIRECTION).flatMap(
    roleMarkdownNodesFrom,
  );
}
