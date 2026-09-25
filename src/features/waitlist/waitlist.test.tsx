import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { SITE_URL } from "#/config/site.ts";
import { RenderedEntryContext } from "#/lib/content/rendered-entry.ts";
import { fallbackText } from "#/lib/waitlist/render-fallback.ts";
import { descriptionTextOf } from "#/test-utils/accessibility.ts";
import { jsonBodyOfFirstRequest } from "#/test-utils/fetch.ts";

import { JOINING_MESSAGE, Waitlist } from "./waitlist.tsx";

import type { ReactNode } from "react";

const playError = vi.hoisted(() => vi.fn());
const playSuccess = vi.hoisted(() => vi.fn());

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, { playError, playSuccess }),
);

const ROUTE = "/collection/entry";
const EMAIL_ADDRESS = "user@example.com";

const fetchMock = vi.fn<typeof fetch>();

let respond: (response: Response) => void;
let joinResponse: Promise<Response>;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);

  joinResponse = Promise.resolve(new Response(null, { status: 204 }));
  respond = (response) => {
    joinResponse = Promise.resolve(response);
  };

  fetchMock.mockReset();
  fetchMock.mockImplementation(() => joinResponse);
  playError.mockClear();
  playSuccess.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderWaitlist = (children?: ReactNode, { list = "List", title }: { list?: string; title?: string } = {}) =>
  render(
    <RenderedEntryContext value={{ route: ROUTE }}>
      <Waitlist list={list} title={title}>
        {children}
      </Waitlist>
    </RenderedEntryContext>,
  );

const field = () => screen.getByLabelText("Email address");
const joinButton = () => screen.getByRole("button", { name: "Join waitlist" });
const status = () => screen.getByRole("status").textContent;
const alertMessage = async () => (await screen.findByRole("alertdialog")).textContent;
const dismissAlert = () => {
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "OK" }));
};

const fill = (value: string) => {
  fireEvent.change(field(), { target: { value } });
};

async function join(value = EMAIL_ADDRESS) {
  fill(value);
  fireEvent.click(joinButton());
  await waitFor(() => expect(status()).not.toBe(JOINING_MESSAGE));
}

test("a submission contains the email address, the list, and the entry's route", async () => {
  renderWaitlist();
  await join();

  expect(jsonBodyOfFirstRequest(fetchMock)).toMatchObject({ emailAddress: EMAIL_ADDRESS, list: "List", source: ROUTE });
});

test("a submission uses the entry's route as the list when the `list` prop is empty", async () => {
  renderWaitlist(undefined, { list: "" });
  await join();

  expect(jsonBodyOfFirstRequest(fetchMock)).toMatchObject({ list: ROUTE });
});

test("a successful submission is confirmed in place of the form", async () => {
  renderWaitlist();
  await join();

  expect(await screen.findByText(/on the list/)).toBeDefined();
  expect(field().closest("[inert]")).not.toBeNull();
  expect(playSuccess).toHaveBeenCalled();
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test("a successful submission focuses the confirmation, which is outside the status region", async () => {
  renderWaitlist();
  await join();

  const confirmation = await screen.findByText(/on the list/);

  expect(document.activeElement).toBe(confirmation);
  expect(confirmation.tabIndex).toBe(-1);
  expect(status()).toBe("");
});

test("an invalid email address is not sent, and its field error is shown in an alert", async () => {
  renderWaitlist();
  await join("user@");

  expect(fetchMock).not.toHaveBeenCalled();
  expect(playError).toHaveBeenCalled();
  await expect(alertMessage()).resolves.toMatch(/email address/);
});

test("the field is described by its field error, and receives the focus once the alert is dismissed", async () => {
  renderWaitlist();
  await join("user@");
  await screen.findByRole("alertdialog");
  dismissAlert();

  await waitFor(() => expect(document.activeElement).toBe(field()));
  expect(field().getAttribute("aria-invalid")).toBe("true");
  expect(descriptionTextOf(field())).toMatch(/email address/);
});

test("a failed submission shows an error in an alert and preserves the entered email address", async () => {
  respond(new Response(null, { status: 502 }));
  renderWaitlist();
  await join();

  await expect(alertMessage()).resolves.toMatch(/couldn’t be joined/);
  expect(playError).toHaveBeenCalled();

  dismissAlert();

  expect(field()).toHaveProperty("value", EMAIL_ADDRESS);
});

test("dismissing a failed submission's alert returns the focus to the button that submitted the form", async () => {
  respond(new Response(null, { status: 502 }));
  renderWaitlist();
  fill(EMAIL_ADDRESS);
  joinButton().focus();
  fireEvent.click(joinButton());
  await screen.findByRole("alertdialog");
  dismissAlert();

  expect(document.activeElement).toBe(joinButton());
});

test("dismissing a failed submission's alert focuses the field when the focus was outside the form at submission", async () => {
  respond(new Response(null, { status: 502 }));
  renderWaitlist();
  fill(EMAIL_ADDRESS);
  (document.activeElement as HTMLElement | null)?.blur(); // Safari does not focus a button that is clicked.
  fireEvent.click(joinButton());
  await screen.findByRole("alertdialog");
  dismissAlert();

  expect(document.activeElement).toBe(field());
});

test("a rate limited submission shows a message to try again later", async () => {
  respond(new Response(null, { status: 429 }));
  renderWaitlist();
  await join();

  await expect(alertMessage()).resolves.toMatch(/too many lists/);
});

test("the form is covered and inert while the submission is in flight", async () => {
  let release: (response: Response) => void = () => undefined;

  joinResponse = new Promise<Response>((resolve) => {
    release = resolve;
  });
  renderWaitlist();
  fill(EMAIL_ADDRESS);
  fireEvent.click(joinButton());

  await waitFor(() => expect(status()).toBe(JOINING_MESSAGE));
  expect(field().closest("[inert]")).not.toBeNull();
  expect(document.querySelector("[data-loading-indicator]")).not.toBeNull();

  release(new Response(null, { status: 204 }));
  await waitFor(() => expect(document.querySelector("[data-loading-indicator]")).toBeNull());
  expect(field().closest("[inert]")).not.toBeNull();
});

test("the waitlist is labeled by its title and contains its children", () => {
  renderWaitlist("Message.", { title: "Title" });

  const block = screen.getByRole("complementary", { name: "Title" });

  expect(block.textContent).toContain("Message.");
});

test("the waitlist renders its children inside an element whose `data-content-default-styles` attribute is `on`", () => {
  renderWaitlist(<p>Message.</p>);
  expect(screen.getByText("Message.").parentElement?.getAttribute("data-content-default-styles")).toBe("on"); // The content element defaults apply to the author's children again inside it.
});

test("the waitlist provides text for the feed", () => {
  renderWaitlist();
  expect(screen.getByRole("complementary").getAttribute("data-feed-text")).toBe(fallbackText(`${SITE_URL}${ROUTE}`));
});
