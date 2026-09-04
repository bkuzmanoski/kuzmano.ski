import { useState } from "react";

import { playSuccess } from "../audio/sounds.ts";
import { firstMessage } from "../forms/client.ts";

import { joinWaitlist } from "./client.ts";

import type { WaitlistFields } from "./membership.ts";

export const JOIN_FAILED_MESSAGE = "The waitlist couldn’t be joined.";

type JoinState = "idle" | "joining" | "joined";

export interface WaitlistJoin {
  state: JoinState;
  join: (fields: WaitlistFields) => Promise<void>;
}

export function useJoinWaitlist({
  list,
  source,
  onFailure,
}: {
  list: string;
  source: string;
  onFailure: (message: string) => void;
}): WaitlistJoin {
  const [state, setState] = useState<JoinState>("idle");

  async function join({ emailAddress }: WaitlistFields) {
    setState("joining");

    const result = await joinWaitlist({
      emailAddress,
      list: list.trim().length > 0 ? list : source,
      source,
    });

    if (result.status === "joined") {
      playSuccess();
      setState("joined");

      return;
    }

    setState("idle");
    onFailure(result.status === "invalid" ? firstMessage(result.errors, JOIN_FAILED_MESSAGE) : result.message);
  }

  return { state, join };
}
