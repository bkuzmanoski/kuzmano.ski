import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";

import Checkmark from "#/assets/images/checkmark.svg?react";
import { Alert } from "#/components/alert.tsx";
import { Button } from "#/components/button.tsx";
import { InputField } from "#/components/input-field.tsx";
import { LoadingIndicator } from "#/components/loading-indicator.tsx";
import { TextInput, TextInputFrame } from "#/components/text-input.tsx";
import { SITE_URL } from "#/config/site.ts";
import { useRenderedEntry } from "#/lib/content/rendered-entry.ts";
import { useForm } from "#/lib/forms/use-form.ts";
import { useInputField } from "#/lib/forms/use-input-field.ts";
import { EMPTY_MEMBERSHIP, WAITLIST_SCHEMA } from "#/lib/waitlist/membership.ts";
import { fallbackText } from "#/lib/waitlist/render-fallback.ts";
import { JOIN_FAILED_MESSAGE, useJoinWaitlist } from "#/lib/waitlist/use-join-waitlist.ts";

import styles from "./waitlist.module.css";

import type { ReactNode } from "react";

interface Prompt {
  kind: "incomplete" | "failed";
  message: string;
}

export const JOINING_MESSAGE = "Adding you to the list…";

const focusOnMount = (element: HTMLElement | null) => element?.focus();

export function Waitlist({
  list,
  title = "Get notified",
  action = "Join waitlist",
  confirmation = "You’re on the list. I’ll email you when there’s news.",
  children,
}: {
  list: string;
  title?: string;
  action?: string;
  confirmation?: string;
  children?: ReactNode;
}) {
  const titleId = useId();
  const renderedEntry = useRenderedEntry();
  const form = useForm({ initialValues: EMPTY_MEMBERSHIP, schema: WAITLIST_SCHEMA });
  const emailAddressField = useInputField(form.visibleErrors.emailAddress);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const emailAddressFieldRef = useRef<HTMLInputElement>(null);
  const elementFocusedAtJoinRef = useRef<HTMLElement | null>(null);

  const entryRoute = renderedEntry?.route ?? "";

  const waitlistJoin = useJoinWaitlist({
    list,
    source: entryRoute,
    onFailure: (message) => setPrompt({ kind: "failed", message }),
  });

  const isJoining = waitlistJoin.state === "joining";
  const hasJoined = waitlistJoin.state === "joined";

  function join() {
    const invalidFields = form.revealErrors();

    if (invalidFields) {
      setPrompt({ kind: "incomplete", message: invalidFields.emailAddress ?? JOIN_FAILED_MESSAGE });
      return;
    }

    const { activeElement } = document;
    const isFocusInForm = activeElement instanceof HTMLElement && formRef.current?.contains(activeElement) === true;

    elementFocusedAtJoinRef.current = isFocusInForm ? activeElement : emailAddressFieldRef.current;

    void waitlistJoin.join({ emailAddress: form.values.emailAddress });
  }

  function closePrompt() {
    flushSync(() => setPrompt(null));
    (prompt?.kind === "incomplete" ? emailAddressFieldRef.current : elementFocusedAtJoinRef.current)?.focus();
  }

  return (
    <aside
      className={styles.waitlist}
      aria-labelledby={titleId}
      data-content-default-styles="off"
      data-content-panel
      data-content-space="loose"
      data-feed-text={fallbackText(`${SITE_URL}${entryRoute}`)}
      data-joined={hasJoined || undefined}
    >
      <div className={styles.body} inert={isJoining}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {children !== undefined && (
            <div className={styles.description} data-content-default-styles="on">
              {children}
            </div>
          )}
        </div>
        <div className={styles.formArea}>
          <form
            ref={formRef}
            className={styles.form}
            noValidate
            inert={hasJoined}
            onSubmit={(event) => {
              event.preventDefault();
              join();
            }}
          >
            <InputField
              label="Email address"
              binding={emailAddressField}
              labelHidden
              className={styles.emailAddressField}
            >
              <TextInputFrame className={styles.emailAddressFieldFrame}>
                <TextInput
                  {...emailAddressField.control}
                  {...form.handlers.emailAddress}
                  ref={emailAddressFieldRef}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  spellCheck={false}
                  type="email"
                  required
                  value={form.values.emailAddress}
                />
              </TextInputFrame>
            </InputField>
            <Button type="submit" className={styles.submitButton}>
              {action}
            </Button>
          </form>
          <p className={styles.joiningStatus} role="status">
            {isJoining && JOINING_MESSAGE}
          </p>
          {hasJoined && (
            <p ref={focusOnMount} className={styles.confirmation} tabIndex={-1}>
              <Checkmark className={styles.checkmark} />
              {confirmation}
            </p>
          )}
        </div>
      </div>
      {isJoining && (
        <div className={styles.scrim} aria-hidden>
          <LoadingIndicator />
        </div>
      )}
      <Alert
        variant="error"
        message={prompt?.message ?? ""}
        open={prompt !== null}
        primaryAction={{ label: "OK", onAction: closePrompt }}
      />
    </aside>
  );
}
