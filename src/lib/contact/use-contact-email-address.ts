import { useEffect, useState } from "react";

import { readContactEmailAddress } from "./client.ts";

/**
 * Returns the published contact email address, or `null` until loaded.
 *
 * Fetches after mount so the address is omitted from prerendered HTML, then serves subsequent reads from the session
 * cache.
 */
export function useContactEmailAddress(): string | null {
  const [emailAddress, setEmailAddress] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void readContactEmailAddress(controller.signal).then((resolvedEmailAddress) => {
      if (!controller.signal.aborted) {
        setEmailAddress(resolvedEmailAddress);
      }
    });

    return () => controller.abort();
  }, []);

  return emailAddress;
}
