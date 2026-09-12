import { SITE_URL } from "#/config/site.ts";
import { isRecord } from "#/lib/guards.ts";
import type { Membership } from "#/lib/waitlist/membership.ts";

import { NOTION_TOKEN_BINDING, WAITLIST_DATA_SOURCE_BINDING } from "./bindings.ts";
import { reportMissingBinding } from "./endpoint.ts";
import { workerEnv } from "./env.ts";

const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2026-03-11"; // Pinned: Notion changes the shape of a request between versions.
const REQUEST_TIMEOUT_MS = 5_000;

// The properties the waitlist data source must define (see `/README.md`).
const PROPERTY_NAMES = { emailAddress: "Email", list: "List", source: "Source" };

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

const reportUnavailable = (binding: string) => reportMissingBinding("waitlist_binding_missing", binding);

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
          { property: PROPERTY_NAMES.emailAddress, title: { equals: membership.emailAddress } },
          { property: PROPERTY_NAMES.list, rich_text: { equals: membership.list } },
        ],
      },
      page_size: 1,
    });

    if (!response.ok) {
      await reportFailure("waitlist_lookup_failed", response);
      return false;
    }

    const queryResult: unknown = await response.json();

    return isRecord(queryResult) && Array.isArray(queryResult.results) && queryResult.results.length > 0;
  } catch (error) {
    reportError("waitlist_lookup_failed", error);
    return false;
  }
}

/** Records a membership in the waitlist database. */
export async function recordMembership(membership: Membership): Promise<MembershipResult> {
  const notionCredentials = await credentials();

  if (!notionCredentials) {
    return "unavailable";
  }

  if (await isAlreadyRecorded(notionCredentials, membership)) {
    return "recorded";
  }

  let response: Response;

  try {
    response = await post("/pages", notionCredentials.token, {
      parent: { type: "data_source_id", data_source_id: notionCredentials.dataSourceId },
      properties: {
        [PROPERTY_NAMES.emailAddress]: { title: [{ text: { content: membership.emailAddress } }] },
        [PROPERTY_NAMES.list]: { rich_text: [{ text: { content: membership.list } }] },
        [PROPERTY_NAMES.source]: { url: new URL(membership.source, SITE_URL).href },
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
