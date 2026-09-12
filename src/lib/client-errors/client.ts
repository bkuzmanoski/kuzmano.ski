import { API } from "#/api.ts";

/** A browser-side failure to record on the server. */
export interface ClientErrorReport {
  kind: string; // Where the failure was caught, so reports can be grouped.
  message: string;
  route: string;
  stack?: string;
}

/**
 * Records a failure on the server without throwing.
 *
 * `sendBeacon` is preferred because the browser can send it while the page is being unloaded.
 * If the browser refuses the beacon, `fetch` with `keepalive` provides a fallback. Reporting is
 * best effort: a failure to report must not replace the error the caller is already handling.
 */
export function reportClientError(report: ClientErrorReport) {
  try {
    const serializedReport = JSON.stringify(report);
    const reportBlob = new Blob([serializedReport], { type: "application/json" });

    if (navigator.sendBeacon(API.clientErrors, reportBlob)) {
      return;
    }

    fetch(API.clientErrors, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: serializedReport,
      keepalive: true,
    }).catch(() => {
      // Ignored.
    });
  } catch {
    // Ignored.
  }
}
