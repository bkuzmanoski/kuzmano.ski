import { useEffect, useState } from "react";

import { readContactEmailAddress } from "./server";

/**
 * The published contact email address, or `null` if it has not been read.
 *
 * The lookup runs after mount rather than during render, so the email address
 * is absent from the prerendered page. After the first read, it is served from
 * this session's cache, so reopening the window does not trigger a network request.
 */
export function useContactEmailAddress(): string | null {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void readContactEmailAddress(controller.signal).then((resolved) => {
      if (!controller.signal.aborted) {
        setAddress(resolved);
      }
    });

    return () => controller.abort();
  }, []);

  return address;
}
