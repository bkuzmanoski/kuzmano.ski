import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { SITE_URL } from "#/config/site";
import { ArticleContext } from "#/lib/article-context";
import { fallbackText } from "#/lib/waitlist/render-fallback";

import { JOINING_MESSAGE, Waitlist } from "./waitlist";

import type { ReactNode } from "react";

const playError = vi.hoisted(() => vi.fn());
const playSuccess = vi.hoisted(() => vi.fn());

vi.mock("#/lib/audio/sounds", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, { playError, playSuccess }),
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
    <ArticleContext value={{ route: ROUTE, reportCopyFailure: vi.fn() }}>
      <Waitlist list={list} title={title}>
        {children}
      </Waitlist>
    </ArticleContext>,
  );

const field = () => screen.getByLabelText("Email address");
const joinButton = () => screen.getByRole("button", { name: "Join waitlist" });
const status = () => screen.getByRole("status").textContent;
const alertMessage = async () => (await screen.findByRole("dialog")).textContent;
const dismissAlert = () => {
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "OK" }));
};

const fill = (value: string) => {
  fireEvent.change(field(), { target: { value } });
};

async function join(value = EMAIL_ADDRESS) {
  fill(value);
  fireEvent.click(joinButton());
  await waitFor(() => expect(status()).not.toBe(JOINING_MESSAGE));
}

const submittedBody = () => JSON.parse(fetchMock.mock.calls[0]![1]?.body as string) as Record<string, unknown>;

function describedBy(element: HTMLElement) {
  const id = element.getAttribute("aria-describedby");
  return id === null ? null : document.getElementById(id)?.textContent;
}

test("a submission contains the email address, the list, and the page route", async () => {
  renderWaitlist();
  await join();

  expect(submittedBody()).toMatchObject({ emailAddress: EMAIL_ADDRESS, list: "List", source: ROUTE });
});

test("an empty list falls back to the page's route", async () => {
  renderWaitlist(undefined, { list: "" });
  await join();

  expect(submittedBody()).toMatchObject({ list: ROUTE });
});

test("a successful submission is confirmed in place of the form", async () => {
  renderWaitlist();
  await join();

  await waitFor(() => expect(status()).toMatch(/on the list/));
  expect(field().closest("[inert]")).not.toBeNull();
  expect(playSuccess).toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("an email address the form rejects is not sent, and the reason is raised as an alert", async () => {
  renderWaitlist();
  await join("user@");

  expect(fetchMock).not.toHaveBeenCalled();
  expect(playError).toHaveBeenCalled();
  await expect(alertMessage()).resolves.toMatch(/email address/);
});

test("the field is described by its error, and holds the focus once the alert is dismissed", async () => {
  renderWaitlist();
  await join("user@");
  await screen.findByRole("dialog");
  dismissAlert();

  await waitFor(() => expect(document.activeElement).toBe(field()));
  expect(field().getAttribute("aria-invalid")).toBe("true");
  expect(describedBy(field())).toMatch(/email address/);
});

test("a failed submission reports why in an alert without clearing the form", async () => {
  respond(new Response(null, { status: 502 }));
  renderWaitlist();
  await join();

  await expect(alertMessage()).resolves.toMatch(/couldn’t be joined/);
  expect(playError).toHaveBeenCalled();

  dismissAlert();

  expect(field()).toHaveProperty("value", EMAIL_ADDRESS);
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

test("the waitlist is labelled by its title and contains its children", () => {
  renderWaitlist("Message.", { title: "Title" });

  const block = screen.getByRole("complementary", { name: "Title" });

  expect(block.textContent).toContain("Message.");
});

test("the waitlist provides text for the feed", () => {
  renderWaitlist();
  expect(screen.getByRole("complementary").getAttribute("data-feed-text")).toBe(fallbackText(`${SITE_URL}${ROUTE}`));
});
