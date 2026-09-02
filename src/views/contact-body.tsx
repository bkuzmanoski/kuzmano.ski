import { useEffect, useRef, useState } from "react";

import { Alert } from "#/components/alert";
import { Button } from "#/components/button";
import { CopyButton } from "#/components/copy-button";
import { InputField, InputFieldValue } from "#/components/input-field";
import { Scrollbar } from "#/components/scrollbar";
import { Spinner } from "#/components/spinner";
import { TextArea, TextInput } from "#/components/text-input";
import { CONTACT_DISPLAY_NAME } from "#/config/contact";
import { useInputScrollSound } from "#/lib/audio/use-input-scroll-sound";
import { cx } from "#/lib/class-names";
import { CONTACT_SCHEMA, EMPTY_MESSAGE, MESSAGE_MAX_LENGTH } from "#/lib/contact/message";
import { CHARACTER_COUNT_VISIBLE_FROM, NO_ALERT, alertFor } from "#/lib/contact/prompt";
import type { Prompt } from "#/lib/contact/prompt";
import { SEND_FAILED_MESSAGE, sendMessage } from "#/lib/contact/server";
import { useContactEmailAddress } from "#/lib/contact/use-contact-email-address";
import { firstMessage } from "#/lib/forms/server";
import { useForm } from "#/lib/forms/use-form";
import { useInputField } from "#/lib/forms/use-input-field";
import { useCloseGuard, useCloseWindow } from "#/lib/hooks/use-close-window";
import { useScrollMetrics } from "#/lib/hooks/use-scroll-metrics";
import { mergeHandlers } from "#/lib/merge-handlers";

import styles from "./contact-body.module.css";

export const SENDING_MESSAGE = "Sending message…";

export function ContactBody() {
  const form = useForm({ initialValues: EMPTY_MESSAGE, schema: CONTACT_SCHEMA });
  const contactEmailAddress = useContactEmailAddress();
  const fromField = useInputField(form.visibleErrors.from);
  const messageField = useInputField(form.visibleErrors.message);
  const [isSending, setIsSending] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const fromFieldRef = useRef<HTMLInputElement>(null);
  const messageFieldRef = useRef<HTMLTextAreaElement>(null);
  const { metrics: messageMetrics, measure: measureMessage } = useScrollMetrics(messageFieldRef);
  const messageFieldScrollSound = useInputScrollSound<HTMLTextAreaElement>();
  const sendAttemptRef = useRef<AbortController | null>(null);

  const hasUnsavedInput = form.isDirty;
  const characterCount = MESSAGE_MAX_LENGTH - form.values.message.length;
  const isCharacterCountVisible = characterCount <= CHARACTER_COUNT_VISIBLE_FROM;
  const alert = prompt ? alertFor(prompt, contactEmailAddress) : NO_ALERT;

  const closeWindow = useCloseWindow();
  const forceCloseWindow = useCloseGuard(() => {
    if (!hasUnsavedInput && !isSending) {
      return false;
    }

    setPrompt({ kind: "discard" });

    return true;
  });

  // A textarea does not hold child boxes for the metrics' resize observer to watch,
  // so its scroll height is remeasured whenever the value it renders changes.
  useEffect(measureMessage, [form.values.message, measureMessage]);

  async function send() {
    const invalidFields = form.revealErrors();

    if (invalidFields) {
      const field = invalidFields.from ? "from" : "message";

      setPrompt({ kind: "incomplete", message: invalidFields[field] ?? SEND_FAILED_MESSAGE, field });

      return;
    }

    const controller = new AbortController();

    sendAttemptRef.current = controller;
    setIsSending(true);

    const result = await sendMessage(form.values, controller.signal);

    if (controller.signal.aborted) {
      return;
    }

    sendAttemptRef.current = null;
    setIsSending(false);

    if (result.status === "sent") {
      form.reset();
      setPrompt({ kind: "sent" });

      return;
    }

    setPrompt(
      result.status === "invalid"
        ? { kind: "failed", message: firstMessage(result.errors, SEND_FAILED_MESSAGE) }
        : { kind: "failed", message: result.message, suggestDirectEmail: true },
    );
  }

  function cancelSend() {
    sendAttemptRef.current?.abort();
    sendAttemptRef.current = null;
    setIsSending(false);
  }

  function closePrompt() {
    const focusField = prompt?.kind === "incomplete" ? prompt.field : null;

    setPrompt(null);

    if (focusField) {
      (focusField === "from" ? fromFieldRef : messageFieldRef).current?.focus();
    }
  }

  function confirmDiscard() {
    cancelSend();
    setPrompt(null);
    forceCloseWindow();
  }

  function confirmSent() {
    setPrompt(null);
    closeWindow?.();
  }

  function confirmPrompt() {
    switch (prompt?.kind) {
      case "discard":
        return confirmDiscard();

      case "sent":
        return confirmSent();

      default:
        return closePrompt();
    }
  }

  return (
    <>
      <form
        className={styles.contactBody}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <div className={styles.fields} inert={isSending}>
          <div className={styles.header}>
            <InputFieldValue label="To:" actions={<CopyButton value={contactEmailAddress} entity="email address" />}>
              {contactEmailAddress ?? CONTACT_DISPLAY_NAME}
            </InputFieldValue>
            <InputField label="From:" binding={fromField}>
              <TextInput
                {...fromField.control}
                {...form.handlers.from}
                ref={fromFieldRef}
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                spellCheck={false}
                type="email"
                required
                value={form.values.from}
              />
            </InputField>
          </div>
          <InputField label="Message:" binding={messageField} className={styles.message} labelHidden>
            <TextArea
              ref={messageFieldRef}
              placeholder="Write a message…"
              required
              value={form.values.message}
              {...messageField.control}
              {...form.handlers.message}
              {...mergeHandlers({ onScroll: measureMessage }, messageFieldScrollSound)}
            />
            <Scrollbar viewportRef={messageFieldRef} viewportId={messageField.control.id} metrics={messageMetrics} />
          </InputField>
        </div>
        <div className={styles.actions}>
          <span className={styles.characterCount}>{isCharacterCountVisible && characterCount.toLocaleString()}</span>
          <Button onClick={() => closeWindow?.()}>{!hasUnsavedInput || isSending ? "Cancel" : "Discard"}</Button>
          <Button type="submit" disabled={isSending}>
            Send
          </Button>
        </div>
        <div className={cx(styles.scrim, isSending && styles.sending)} role="status">
          {isSending && <Spinner label={SENDING_MESSAGE} />}
        </div>
      </form>
      <Alert
        variant={alert.variant}
        sound={alert.sound}
        message={alert.message}
        open={prompt !== null}
        primaryAction={{
          label: alert.primaryLabel,
          onAction: confirmPrompt,
        }}
        secondaryAction={alert.secondaryLabel ? { label: alert.secondaryLabel, onAction: closePrompt } : undefined}
      />
    </>
  );
}
