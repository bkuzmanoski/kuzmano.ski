import { SITE_URL } from "#/config/site";
import { isRecord } from "#/lib/guards";
import type { Membership } from "#/lib/waitlist/membership";

import { NOTION_TOKEN_BINDING, WAITLIST_DATA_SOURCE_BINDING } from "./bindings";
import { workerEnv } from "./env";

const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2026-03-11"; // Pinned: Notion changes the shape of a request between versions.
const REQUEST_TIMEOUT_MS = 5_000;

/**
 * The properties the waitlist data source must define (see `/README.md`).
 */
const PROPERTY = { emailAddress: "Email", list: "List", source: "Source" };

/**
 * `throttled` means Notion is rate limiting or overloaded, so the join may succeed on a retry.
 * Every other failure is a misconfiguration that cannot recover, so it collapses to `unavailable`
 * and the diagnosis is left to the log.
 */
export type MembershipResult = "recorded" | "throttled" | "unavailable";

interface Credentials {
  token: string;
  dataSourceId: string;
}

const RETRYABLE_STATUSES = new Set([429, 529]); // Rate limited; overloaded.

function reportUnavailable(binding: string): "unavailable" {
  console.error({
    event: "waitlist_binding_missing",
    binding,
    message: `The worker could not access \`${binding}\``,
  });
  return "unavailable";
}

async function reportFailure(event: string, response: Response) {
  console.error({
    event,
    status: response.status,
    message: await response.text().catch(() => ""), // Notion explains a rejection in the body.
  });
}

function reportError(event: string, error: unknown) {
  console.error({ event, message: error instanceof Error ? error.message : String(error) });
}

/** The token and data source the Worker writes memberships to, or `null` when either is missing. */
async function credentials(): Promise<Credentials | null> {
  let env;

  try {
    env = await workerEnv();
  } catch {
    reportUnavailable("the Workers environment");
    return null;
  }

  const token = env[NOTION_TOKEN_BINDING];
  const dataSourceId = env[WAITLIST_DATA_SOURCE_BINDING];

  if (!token) {
    reportUnavailable(NOTION_TOKEN_BINDING);
    return null;
  }

  if (!dataSourceId) {
    reportUnavailable(WAITLIST_DATA_SOURCE_BINDING);
    return null;
  }

  return { token, dataSourceId };
}

const post = (path: string, token: string, body: unknown) =>
  fetch(`${NOTION_API_URL}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "notion-version": NOTION_VERSION,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

/** Whether the address is already on this waitlist. */
async function isAlreadyRecorded({ token, dataSourceId }: Credentials, membership: Membership): Promise<boolean> {
  try {
    const response = await post(`/data_sources/${dataSourceId}/query`, token, {
      filter: {
        and: [
          { property: PROPERTY.emailAddress, title: { equals: membership.emailAddress } },
          { property: PROPERTY.list, rich_text: { equals: membership.list } },
        ],
      },
      page_size: 1,
    });

    if (!response.ok) {
      await reportFailure("waitlist_lookup_failed", response);
      return false;
    }

    const body: unknown = await response.json();

    return isRecord(body) && Array.isArray(body.results) && body.results.length > 0;
  } catch (error) {
    reportError("waitlist_lookup_failed", error);
    return false;
  }
}

/** Records a membership in the waitlist database. */
export async function recordMembership(membership: Membership): Promise<MembershipResult> {
  const notion = await credentials();

  if (!notion) {
    return "unavailable";
  }

  if (await isAlreadyRecorded(notion, membership)) {
    return "recorded";
  }

  let response: Response;

  try {
    response = await post("/pages", notion.token, {
      parent: { type: "data_source_id", data_source_id: notion.dataSourceId },
      properties: {
        [PROPERTY.emailAddress]: { title: [{ text: { content: membership.emailAddress } }] },
        [PROPERTY.list]: { rich_text: [{ text: { content: membership.list } }] },
        [PROPERTY.source]: { url: new URL(membership.source, SITE_URL).href },
      },
    });
  } catch (error) {
    reportError("waitlist_join_failed", error);
    return "unavailable";
  }

  if (response.ok) {
    return "recorded";
  }

  await reportFailure("waitlist_join_failed", response);

  return RETRYABLE_STATUSES.has(response.status) ? "throttled" : "unavailable";
}
