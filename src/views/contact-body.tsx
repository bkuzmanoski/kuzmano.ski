import { useEffect, useRef, useState } from "react";

import { Alert } from "#/components/alert";
import { Button } from "#/components/button";
import { ComposeField, ComposeValue } from "#/components/compose-field";
import { CopyButton } from "#/components/copy-button";
import { Scrollbar } from "#/components/scrollbar";
import { Spinner } from "#/components/spinner";
import { TextArea, TextInput } from "#/components/text-input";
import { CONTACT_DISPLAY_NAME } from "#/config/contact";
import { playFieldScroll, playScrollStep } from "#/lib/audio/scroll";
import { playError, playSuccess } from "#/lib/audio/sounds";
import { cx } from "#/lib/class-names";
import { CONTACT_SCHEMA, EMPTY_MESSAGE } from "#/lib/contact/message";
import { NO_ALERT, alertFor, characterCountStatus } from "#/lib/contact/prompt";
import type { Prompt } from "#/lib/contact/prompt";
import { sendMessage } from "#/lib/contact/submit";
import { useContactEmailAddress } from "#/lib/contact/use-contact-email-address";
import { useField } from "#/lib/forms/use-field";
import { useForm } from "#/lib/forms/use-form";
import { useCloseGuard, useCloseWindow } from "#/lib/hooks/use-close-window";
import { useScrollMetrics } from "#/lib/hooks/use-scroll-metrics";

import styles from "./contact-body.module.css";

const SEND_FAILED_MESSAGE = "The message couldn’t be sent.";
const SENDING_MESSAGE = "Sending message";

export function ContactBody() {
  const form = useForm({ initialValues: EMPTY_MESSAGE, schema: CONTACT_SCHEMA });
  const contactEmailAddress = useContactEmailAddress();
  const fromField = useField(form.visibleErrors.from);
  const messageField = useField(form.visibleErrors.message);
  const [isSending, setIsSending] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [openedAt] = useState(() => Date.now());
  const fromFieldRef = useRef<HTMLInputElement>(null);
  const decoyFieldRef = useRef<HTMLInputElement>(null);
  const messageFieldRef = useRef<HTMLTextAreaElement>(null);
  const { metrics: messageMetrics, measure: measureMessage } = useScrollMetrics(messageFieldRef);
  const sendAttemptRef = useRef<AbortController | null>(null);

  const hasUnsavedInput = form.isDirty;
  const characterCount = characterCountStatus(form.values.message.length);
  const alert = prompt ? alertFor(prompt, contactEmailAddress) : NO_ALERT;

  const closeWindow = useCloseWindow();
  const forceCloseWindow = useCloseGuard(() => {
    if (!hasUnsavedInput && !isSending) {
      return false;
    }

    playError();
    setPrompt({ kind: "discard" });

    return true;
  });

  // A textarea holds no child boxes for the metrics' resize observer to watch,
  // so its scroll height is remeasured whenever the value it renders changes.
  useEffect(measureMessage, [form.values.message, measureMessage]);

  async function send() {
    const invalidFields = form.revealErrors();

    if (invalidFields) {
      const field = invalidFields.from ? "from" : "message";

      playError();
      setPrompt({ kind: "incomplete", message: invalidFields[field] ?? SEND_FAILED_MESSAGE, field });

      return;
    }

    const attempt = new AbortController();

    sendAttemptRef.current = attempt;
    setIsSending(true);

    const result = await sendMessage(
      { ...form.values, website: decoyFieldRef.current?.value ?? "", elapsedMs: Date.now() - openedAt },
      attempt.signal,
    );

    if (attempt.signal.aborted) {
      return;
    }

    sendAttemptRef.current = null;
    setIsSending(false);

    if (result.status === "sent") {
      playSuccess();
      form.reset();
      setPrompt({ kind: "sent" });

      return;
    }

    playError();
    setPrompt(
      result.status === "invalid"
        ? {
            kind: "failed",
            message: Object.values(result.errors)[0] ?? SEND_FAILED_MESSAGE,
          }
        : {
            kind: "failed",
            message: result.message,
            suggestDirectEmail: true,
          },
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
            <ComposeValue
              label="To:"
              actions={<CopyButton value={contactEmailAddress} label="Copy email address" confirmation="Copied" />}
            >
              {CONTACT_DISPLAY_NAME}
            </ComposeValue>
            <ComposeField label="From:" field={fromField}>
              <TextInput
                {...fromField.control}
                {...form.handlers.from}
                ref={fromFieldRef}
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                spellCheck={false}
                type="email"
                value={form.values.from}
              />
            </ComposeField>
          </div>
          <ComposeField label="Message:" field={messageField} className={styles.message} labelHidden>
            <TextArea
              {...messageField.control}
              {...form.handlers.message}
              ref={messageFieldRef}
              placeholder="Write a message…"
              value={form.values.message}
              onScroll={(event) => {
                measureMessage();
                playFieldScroll(event.currentTarget);
              }}
            />
            <Scrollbar
              viewportId={messageField.control.id}
              metrics={messageMetrics}
              onScrollTop={(top) => {
                if (messageFieldRef.current) {
                  messageFieldRef.current.scrollTop = top;
                }
              }}
              onStep={(delta) => {
                const field = messageFieldRef.current;

                if (!field) {
                  return false;
                }

                const initialScrollTop = field.scrollTop;

                field.scrollBy({ top: delta });

                const didScroll = field.scrollTop !== initialScrollTop;

                if (didScroll) {
                  playScrollStep(field);
                }

                return didScroll;
              }}
            />
          </ComposeField>
          <input
            ref={decoyFieldRef}
            aria-hidden
            autoComplete="off"
            className={styles.decoy}
            defaultValue=""
            name="website"
            tabIndex={-1}
          />
        </div>
        <div className={styles.actions}>
          <span className={styles.characterCount}>{characterCount}</span>
          <Button children={!hasUnsavedInput || isSending ? "Cancel" : "Discard"} onClick={() => closeWindow?.()} />
          <Button children="Send" disabled={isSending} type="submit" />
        </div>
        <div aria-label="Message status" className={cx(styles.scrim, isSending && styles.sending)} role="status">
          {isSending && <Spinner label={SENDING_MESSAGE} />}
        </div>
      </form>
      <Alert
        open={prompt !== null}
        variant={alert.variant}
        message={alert.message}
        primaryAction={{
          label: alert.primaryLabel,
          onAction: confirmPrompt,
        }}
        secondaryAction={
          alert.secondaryLabel === undefined ? undefined : { label: alert.secondaryLabel, onAction: closePrompt }
        }
      />
    </>
  );
}
