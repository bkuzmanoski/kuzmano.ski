import { useId, useRef, useState } from "react";

import CheckmarkIcon from "#/assets/images/checkmark.svg?react";
import { SITE_URL } from "#/config/site";
import { useArticle } from "#/content/article-context";
import { cx } from "#/lib/class-names";
import { useForm } from "#/lib/forms/use-form";
import { useInputField } from "#/lib/forms/use-input-field";
import { EMPTY_MEMBERSHIP, WAITLIST_SCHEMA } from "#/lib/waitlist/membership";
import { fallbackText } from "#/lib/waitlist/render-fallback";
import { JOIN_FAILED_MESSAGE, useJoinWaitlist } from "#/lib/waitlist/use-join-waitlist";

import { Alert } from "./alert";
import { Button } from "./button";
import { InputField } from "./input-field";
import { Spinner } from "./spinner";
import { TextInput, TextInputFrame } from "./text-input";
import styles from "./waitlist.module.css";

import type { ReactNode } from "react";

interface Prompt {
  kind: "incomplete" | "failed";
  message: string;
}

export const JOINING_MESSAGE = "Adding you to the list…";

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
  const article = useArticle();
  const form = useForm({ initialValues: EMPTY_MEMBERSHIP, schema: WAITLIST_SCHEMA });
  const emailAddressField = useInputField(form.visibleErrors.emailAddress);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const emailAddressFieldRef = useRef<HTMLInputElement>(null);

  const route = article?.route ?? "";

  const waitlist = useJoinWaitlist({
    list,
    source: route,
    onFailure: (message) => setPrompt({ kind: "failed", message }),
  });

  const isJoining = waitlist.state === "joining";
  const hasJoined = waitlist.state === "joined";

  function join() {
    const invalidFields = form.revealErrors();

    if (invalidFields) {
      setPrompt({ kind: "incomplete", message: invalidFields.emailAddress ?? JOIN_FAILED_MESSAGE });
      return;
    }

    void waitlist.join({ emailAddress: form.values.emailAddress });
  }

  function closePrompt() {
    const shouldFocusField = prompt?.kind === "incomplete";

    setPrompt(null);

    if (shouldFocusField) {
      emailAddressFieldRef.current?.focus();
    }
  }

  return (
    <aside
      className={styles.waitlist}
      aria-labelledby={titleId}
      data-content-space="loose"
      data-feed-text={fallbackText(`${SITE_URL}${route}`)}
      data-joined={hasJoined || undefined}
    >
      <div className={styles.content} inert={isJoining}>
        <div className={styles.intro}>
          <p className={styles.title} id={titleId}>
            {title}
          </p>
          {children}
        </div>
        <div className={styles.slot}>
          <form
            className={styles.form}
            noValidate
            inert={hasJoined}
            onSubmit={(event) => {
              event.preventDefault();
              join();
            }}
          >
            <InputField label="Email address" binding={emailAddressField} labelHidden className={styles.inputField}>
              <TextInputFrame className={styles.inputFieldFrame}>
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
            <Button type="submit" className={styles.action}>
              {action}
            </Button>
          </form>
          <p className={cx(styles.status, isJoining && styles.hidden)} role="status">
            {isJoining ? (
              JOINING_MESSAGE
            ) : hasJoined ? (
              <>
                <CheckmarkIcon className={styles.checkmarkIcon} aria-hidden />
                {confirmation}
              </>
            ) : null}
          </p>
        </div>
      </div>
      {isJoining && (
        <div className={styles.scrim} aria-hidden>
          <Spinner />
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
