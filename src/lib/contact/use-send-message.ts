import { useRef, useState } from "react";

import { firstMessage } from "../forms/client.ts";

import { SEND_FAILED_MESSAGE, sendMessage } from "./client.ts";

import type { ContactFields } from "./message.ts";

export interface SendFailure {
  message: string;
  /** `true` when the server could not send the message. */
  suggestDirectEmail: boolean;
}

export interface MessageSend {
  isSending: boolean;
  send: (fields: ContactFields) => Promise<void>;
  cancel: () => void;
}

export function useSendMessage({
  onSent,
  onFailure,
}: {
  onSent: () => void;
  onFailure: (failure: SendFailure) => void;
}): MessageSend {
  const [isSending, setIsSending] = useState(false);
  const sendAttemptRef = useRef<AbortController | null>(null);

  async function send(fields: ContactFields) {
    const sendController = new AbortController();

    sendAttemptRef.current = sendController;
    setIsSending(true);

    const sendResult = await sendMessage(fields, sendController.signal);

    if (sendController.signal.aborted) {
      return;
    }

    sendAttemptRef.current = null;
    setIsSending(false);

    if (sendResult.status === "sent") {
      onSent();
      return;
    }

    onFailure(
      sendResult.status === "invalid"
        ? { message: firstMessage(sendResult.errors, SEND_FAILED_MESSAGE), suggestDirectEmail: false }
        : { message: sendResult.message, suggestDirectEmail: true },
    );
  }

  function cancel() {
    sendAttemptRef.current?.abort();
    sendAttemptRef.current = null;
    setIsSending(false);
  }

  return { isSending, send, cancel };
}
