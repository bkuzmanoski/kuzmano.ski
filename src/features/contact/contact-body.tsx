import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Alert } from "#/components/alert.tsx";
import { Button } from "#/components/button.tsx";
import { CopyButton } from "#/components/copy-button.tsx";
import { InputField } from "#/components/input-field.tsx";
import { LoadingIndicator } from "#/components/loading-indicator.tsx";
import { Scrollbar } from "#/components/scrollbar.tsx";
import { TextArea, TextInput } from "#/components/text-input.tsx";
import { CONTACT_DISPLAY_NAME } from "#/config/contact.ts";
import { DOCUMENT_LANGUAGE, PRERENDER_LOCALE } from "#/config/site.ts";
import { useInputScrollSound } from "#/lib/audio/use-input-scroll-sound.ts";
import { cx } from "#/lib/class-names.ts";
import {
  CHARACTER_COUNT_VISIBLE_FROM,
  characterCountDescription,
  characterCountStatus,
} from "#/lib/contact/character-count.ts";
import { SEND_FAILED_MESSAGE, sendMessage } from "#/lib/contact/client.ts";
import { CONTACT_SCHEMA, EMPTY_MESSAGE, MESSAGE_MAX_LENGTH } from "#/lib/contact/message.ts";
import { NO_ALERT, alertFor } from "#/lib/contact/prompt.ts";
import type { Prompt } from "#/lib/contact/prompt.ts";
import { useContactEmailAddress } from "#/lib/contact/use-contact-email-address.ts";
import { firstMessage } from "#/lib/forms/client.ts";
import { useForm } from "#/lib/forms/use-form.ts";
import { useInputField } from "#/lib/forms/use-input-field.ts";
import { useLocale } from "#/lib/hooks/use-locale.ts";
import { useScrollMetrics } from "#/lib/hooks/use-scroll-metrics.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { useCloseGuard, useCloseWindow } from "#/lib/window-manager/use-close-window.ts";

import styles from "./contact-body.module.css";

export const SENDING_MESSAGE = "Sending message…";

// The screen reader text around the character count is an English sentence, so its numbers
// are written in the document's language rather than the browser's locale.
const SCREEN_READER_NUMBER_FORMAT = new Intl.NumberFormat(DOCUMENT_LANGUAGE);

export function ContactBody() {
  const form = useForm({ initialValues: EMPTY_MESSAGE, schema: CONTACT_SCHEMA });
  const contactEmailAddress = useContactEmailAddress();
  const characterCountId = useId();
  const characterCount = MESSAGE_MAX_LENGTH - form.values.message.length;
  const isCharacterCountVisible = characterCount <= CHARACTER_COUNT_VISIBLE_FROM;
  const toField = useInputField();
  const fromField = useInputField(form.visibleErrors.from);
  const messageField = useInputField(form.visibleErrors.message, {
    describedBy: isCharacterCountVisible ? characterCountId : undefined,
  });
  const [isSending, setIsSending] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const fromFieldRef = useRef<HTMLInputElement>(null);
  const messageFieldRef = useRef<HTMLTextAreaElement>(null);
  const { metrics: messageMetrics, measure: measureMessage } = useScrollMetrics(messageFieldRef);
  const messageFieldScrollSound = useInputScrollSound<HTMLTextAreaElement>();
  const sendAttemptRef = useRef<AbortController | null>(null);
  const elementFocusedAtSendRef = useRef<HTMLElement | null>(null);
  const visibleNumberFormat = new Intl.NumberFormat(useLocale(PRERENDER_LOCALE));

  const hasUnsavedInput = form.isDirty;
  const promptAlert = prompt ? alertFor(prompt, contactEmailAddress) : NO_ALERT;

  const closeWindow = useCloseWindow();
  const forceCloseWindow = useCloseGuard(() => {
    if (!hasUnsavedInput && !isSending) {
      return false;
    }

    setPrompt({ kind: "discard" });

    return true;
  });

  // A textarea does not contain child boxes for the metrics' resize observer to watch,
  // so its scroll height is remeasured whenever the value it renders changes.
  useEffect(measureMessage, [form.values.message, measureMessage]);

  async function send() {
    const invalidFields = form.revealErrors();

    if (invalidFields) {
      const firstInvalidField = invalidFields.from ? "from" : "message";

      setPrompt({
        kind: "incomplete",
        message: invalidFields[firstInvalidField] ?? SEND_FAILED_MESSAGE,
        field: firstInvalidField,
      });

      return;
    }

    const sendController = new AbortController();

    sendAttemptRef.current = sendController;
    elementFocusedAtSendRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    setIsSending(true);

    const sendResult = await sendMessage(form.values, sendController.signal);

    if (sendController.signal.aborted) {
      return;
    }

    sendAttemptRef.current = null;
    setIsSending(false);

    if (sendResult.status === "sent") {
      form.reset();
      setPrompt({ kind: "sent" });

      return;
    }

    setPrompt(
      sendResult.status === "invalid"
        ? { kind: "failed", message: firstMessage(sendResult.errors, SEND_FAILED_MESSAGE) }
        : { kind: "failed", message: sendResult.message, suggestDirectEmail: true },
    );
  }

  function cancelSend() {
    sendAttemptRef.current?.abort();
    sendAttemptRef.current = null;
    setIsSending(false);
  }

  function closePrompt() {
    const invalidField = prompt?.kind === "incomplete" ? prompt.field : null;

    flushSync(() => setPrompt(null));

    if (invalidField) {
      (invalidField === "from" ? fromFieldRef : messageFieldRef).current?.focus();
    } else if (prompt?.kind === "failed") {
      elementFocusedAtSendRef.current?.focus();
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
            <InputField label="To:" binding={toField}>
              <TextInput
                {...toField.control}
                readOnly
                tabIndex={-1}
                spellCheck={false}
                value={contactEmailAddress ?? CONTACT_DISPLAY_NAME}
              />
              <CopyButton value={contactEmailAddress} entity="email address" />
            </InputField>
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
          <span id={characterCountId} className={styles.characterCount}>
            {isCharacterCountVisible && (
              <>
                <span aria-hidden>{visibleNumberFormat.format(characterCount)}</span>
                <span className={styles.hidden}>
                  {characterCountDescription(characterCount, SCREEN_READER_NUMBER_FORMAT)}
                </span>
              </>
            )}
          </span>
          <span className={styles.hidden} role="status">
            {characterCountStatus(characterCount, SCREEN_READER_NUMBER_FORMAT)}
          </span>
          <Button onClick={() => closeWindow?.()}>{!hasUnsavedInput || isSending ? "Cancel" : "Discard"}</Button>
          <Button type="submit" disabled={isSending}>
            Send
          </Button>
        </div>
        <div className={cx(styles.scrim, isSending && styles.sending)} role="status">
          {isSending && <LoadingIndicator label={SENDING_MESSAGE} />}
        </div>
      </form>
      <Alert
        variant={promptAlert.variant}
        sound={promptAlert.sound}
        message={promptAlert.message}
        open={prompt !== null}
        primaryAction={{
          label: promptAlert.primaryLabel,
          onAction: confirmPrompt,
        }}
        secondaryAction={
          promptAlert.secondaryLabel ? { label: promptAlert.secondaryLabel, onAction: closePrompt } : undefined
        }
      />
    </>
  );
}
