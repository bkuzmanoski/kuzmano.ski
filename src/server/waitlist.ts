import { SITE_URL } from "#/config/site.ts";
import { isRecord } from "#/lib/guards.ts";
import type { Membership } from "#/lib/waitlist/membership.ts";

import { NOTION_TOKEN_BINDING, WAITLIST_DATA_SOURCE_BINDING } from "./bindings.ts";
import { workerEnv } from "./env.ts";
import { errorMessageOf, logServerEvent, reportMissingBinding } from "./log.ts";

import type { ServerLogEvent } from "./log.ts";

const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2026-03-11"; // Pinned: Notion changes the shape of a request between versions.
const DATA_SOURCE_PROPERTY_NAMES = { emailAddress: "Email", list: "List", source: "Source" }; // The properties the waitlist data source must define (see `/README.md`).
const REQUEST_TIMEOUT_MS = 5_000;
const RETRYABLE_STATUS_CODES = new Set([429, 529]); // Rate limited; overloaded.

/**
 * `throttled` means Notion is rate limiting or overloaded, so the join may succeed on a retry.
 * Every other failure is a misconfiguration that cannot recover, so it collapses to `unavailable`
 * and the diagnosis is left to the log.
 */
export type MembershipResult = "recorded" | "throttled" | "unavailable";

interface NotionCredentials {
  token: string;
  dataSourceId: string;
}

const reportMissingWaitlistBinding = (binding: string) => reportMissingBinding("waitlist_binding_missing", binding);

type WaitlistFailureEvent = Extract<ServerLogEvent, `waitlist_${string}_failed`>;

async function reportFailedResponse(event: WaitlistFailureEvent, response: Response) {
  logServerEvent(event, {
    status: response.status,
    message: await response.text().catch(() => ""), // Notion explains a rejection in the body.
  });
}

function reportFailedRequest(event: WaitlistFailureEvent, error: unknown) {
  logServerEvent(event, { message: errorMessageOf(error) });
}

async function readNotionCredentials(): Promise<NotionCredentials | null> {
  let env;

  try {
    env = await workerEnv();
  } catch {
    reportMissingWaitlistBinding("the Workers environment");
    return null;
  }

  const token = env[NOTION_TOKEN_BINDING];
  const dataSourceId = env[WAITLIST_DATA_SOURCE_BINDING];

  if (!token) {
    reportMissingWaitlistBinding(NOTION_TOKEN_BINDING);
    return null;
  }

  if (!dataSourceId) {
    reportMissingWaitlistBinding(WAITLIST_DATA_SOURCE_BINDING);
    return null;
  }

  return { token, dataSourceId };
}

const postToNotion = (path: string, token: string, body: unknown) =>
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
async function isAlreadyRecorded({ token, dataSourceId }: NotionCredentials, membership: Membership): Promise<boolean> {
  try {
    const response = await postToNotion(`/data_sources/${dataSourceId}/query`, token, {
      filter: {
        and: [
          { property: DATA_SOURCE_PROPERTY_NAMES.emailAddress, title: { equals: membership.emailAddress } },
          { property: DATA_SOURCE_PROPERTY_NAMES.list, rich_text: { equals: membership.list } },
        ],
      },
      page_size: 1,
    });

    if (!response.ok) {
      await reportFailedResponse("waitlist_lookup_failed", response);
      return false;
    }

    const queryResult: unknown = await response.json();

    return isRecord(queryResult) && Array.isArray(queryResult.results) && queryResult.results.length > 0;
  } catch (error) {
    reportFailedRequest("waitlist_lookup_failed", error);
    return false;
  }
}

/** Records a membership in the waitlist database. */
export async function recordMembership(membership: Membership): Promise<MembershipResult> {
  const credentials = await readNotionCredentials();

  if (!credentials) {
    return "unavailable";
  }

  if (await isAlreadyRecorded(credentials, membership)) {
    return "recorded";
  }

  let response: Response;

  try {
    response = await postToNotion("/pages", credentials.token, {
      parent: { type: "data_source_id", data_source_id: credentials.dataSourceId },
      properties: {
        [DATA_SOURCE_PROPERTY_NAMES.emailAddress]: { title: [{ text: { content: membership.emailAddress } }] },
        [DATA_SOURCE_PROPERTY_NAMES.list]: { rich_text: [{ text: { content: membership.list } }] },
        [DATA_SOURCE_PROPERTY_NAMES.source]: { url: new URL(membership.source, SITE_URL).href },
      },
    });
  } catch (error) {
    reportFailedRequest("waitlist_join_failed", error);
    return "unavailable";
  }

  if (response.ok) {
    return "recorded";
  }

  await reportFailedResponse("waitlist_join_failed", response);

  return RETRYABLE_STATUS_CODES.has(response.status) ? "throttled" : "unavailable";
}
