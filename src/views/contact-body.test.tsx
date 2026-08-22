import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { CONTACT_EMAIL_ADDRESS } from "#/config/contact";
import { MESSAGE_MAX_LENGTH } from "#/lib/contact/message";
import type { CloseGuard } from "#/lib/window-manager";

import { ContactBody } from "./contact-body";

const playError = vi.hoisted(() => vi.fn());
const playSuccess = vi.hoisted(() => vi.fn());
const closeWindow = vi.hoisted(() => vi.fn());
const forceCloseWindow = vi.hoisted(() => vi.fn());
const closeGuardRef = vi.hoisted(() => ({ current: null as CloseGuard | null }));

vi.mock("#/lib/hooks/use-close-window", () => ({
  useCloseWindow: () => closeWindow,
  useCloseGuard: (closeGuard: CloseGuard) => {
    closeGuardRef.current = closeGuard;
    return forceCloseWindow;
  },
}));

vi.mock("#/lib/audio/sounds", () => ({
  playError,
  playSuccess,
  playClick: vi.fn(),
}));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);

  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

  playError.mockClear();
  playSuccess.mockClear();

  closeWindow.mockReset();
  closeWindow.mockImplementation(() => {
    if (closeGuardRef.current?.() !== true) {
      forceCloseWindow();
    }
  });

  forceCloseWindow.mockClear();
  closeGuardRef.current = null;
});

const input = (label: string) => screen.getByLabelText(label);
const button = (name: string) => screen.getByRole("button", { name });
const alertButton = (name: string) => within(screen.getByRole("dialog")).getByRole("button", { name });

const fill = (label: string, value: string) => {
  fireEvent.change(input(label), { target: { value } });
};

function compose() {
  fill("From:", "test@example.com");
  fill("Message:", "Hello.");
}

const status = () => screen.getByRole("status", { name: "Message status" });
const sendingSpinner = () => within(status()).queryByRole("img", { name: "Sending message" });

function describedBy(label: string) {
  const id = input(label).getAttribute("aria-describedby");
  return id === null ? null : document.getElementById(id)?.textContent;
}

async function submit() {
  fireEvent.click(button("Send"));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
}

test("the contact address is published as text with a copy action", () => {
  render(<ContactBody />);

  expect(screen.queryByLabelText("To:")).toBeNull();
  expect(screen.getByText(CONTACT_EMAIL_ADDRESS).tagName).toBe("P");
  expect(button("Copy email address")).toBeDefined();
});

test("the message field remains accessible without a visible label", () => {
  render(<ContactBody />);
  expect(input("Message:").tagName).toBe("TEXTAREA");
});

test("sending an incomplete message shows an alert and does not submit", () => {
  render(<ContactBody />);

  fireEvent.click(button("Send"));

  expect(playError).toHaveBeenCalledOnce();
  expect(fetchMock).not.toHaveBeenCalled();

  const alert = screen.getByRole("dialog");

  expect(within(alert).getByText("Enter your email address.")).toBeDefined();
});

test("dismissing a validation alert focuses the first invalid field", () => {
  render(<ContactBody />);

  fill("From:", "test@example.com");
  fireEvent.click(button("Send"));
  fireEvent.click(alertButton("OK"));

  expect(document.activeElement).toBe(input("Message:"));
});

test("dismissing a validation alert marks the invalid field and leaves the status silent", () => {
  render(<ContactBody />);

  fireEvent.click(button("Send"));
  fireEvent.click(alertButton("OK"));

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(sendingSpinner()).toBeNull();
  expect(input("From:").getAttribute("aria-invalid")).toBe("true");
  expect(describedBy("From:")).toBe("Enter your email address.");
});

test("an invalid email is checked on blur and clears when corrected", () => {
  render(<ContactBody />);

  fill("From:", "nope");

  expect(input("From:").hasAttribute("aria-invalid")).toBe(false);

  fireEvent.blur(input("From:"));

  expect(input("From:").getAttribute("aria-invalid")).toBe("true");
  expect(describedBy("From:")).toBe("That doesn’t look like an email address.");

  fill("From:", "test@example.com");

  expect(input("From:").hasAttribute("aria-invalid")).toBe(false);
  expect(describedBy("From:")).toBeNull();
});

test("the message counter appears when fewer than 100 characters remain", () => {
  render(<ContactBody />);

  fill("Message:", "a".repeat(100));

  expect(screen.queryByText(/left$/)).toBeNull();

  fill("Message:", "a".repeat(MESSAGE_MAX_LENGTH - 10));

  expect(screen.getByText("10 left")).toBeDefined();
});

test("a message that exceeds the limit shows the excess character count and cannot be sent", () => {
  render(<ContactBody />);

  fill("From:", "test@example.com");
  fill("Message:", "a".repeat(MESSAGE_MAX_LENGTH + 5));

  expect(screen.getByText("5 over")).toBeDefined();

  fireEvent.click(button("Send"));

  expect(fetchMock).not.toHaveBeenCalled();
  expect(
    within(screen.getByRole("dialog")).getByText(
      `Keep the message under ${MESSAGE_MAX_LENGTH.toLocaleString()} characters.`,
    ),
  ).toBeDefined();
});

test("the message character count is not announced as a status update", () => {
  render(<ContactBody />);
  fill("Message:", "a".repeat(MESSAGE_MAX_LENGTH - 10));

  expect(status().textContent).toBe("");
});

test("a successful submission shows a confirmation, plays the message sent sound, and clears the form", async () => {
  render(<ContactBody />);
  compose();

  await submit();

  const body = fetchMock.mock.calls[0]![1]!.body as string;

  expect(JSON.parse(body)).toMatchObject({
    from: "test@example.com",
    message: "Hello.",
    website: "",
  });

  expect(await screen.findByRole("dialog")).toBeDefined();
  expect(screen.getByText("Message sent!")).toBeDefined();
  expect(playSuccess).toHaveBeenCalledOnce();

  fireEvent.click(alertButton("OK"));

  expect((input("From:") as HTMLInputElement).value).toBe("");
  expect((input("Message:") as HTMLTextAreaElement).value).toBe("");
});

test("a failed submission shows an error and preserves the message", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 502 }));

  render(<ContactBody />);
  compose();

  await submit();

  expect(
    await screen.findByText(
      "The message couldn’t be sent. Try again, or write directly instead. You can write directly to test@example.com instead.",
    ),
  ).toBeDefined();
  expect(playError).toHaveBeenCalledOnce();
  expect(playSuccess).not.toHaveBeenCalled();
  expect((input("Message:") as HTMLTextAreaElement).value).toBe("Hello.");
});

function startPendingSubmission() {
  let resolveRequest: (response: Response) => void = () => undefined;

  fetchMock.mockReturnValue(
    new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    }),
  );

  render(<ContactBody />);
  compose();
  fireEvent.click(button("Send"));

  return {
    resolveRequest: (response: Response) => resolveRequest(response),
  };
}

test("a pending submission covers the form and announces its progress", async () => {
  const { resolveRequest } = startPendingSubmission();

  await waitFor(() => expect(sendingSpinner()).not.toBeNull());

  expect(input("Message:").closest("[inert]")).not.toBeNull();
  expect((input("Message:") as HTMLTextAreaElement).disabled).toBe(false);
  expect(button("Send").hasAttribute("disabled")).toBe(true);

  await act(async () => {
    resolveRequest(new Response(null, { status: 204 }));
    await Promise.resolve();
  });

  expect(sendingSpinner()).toBeNull();
  expect(input("Message:").closest("[inert]")).toBeNull();
});

test("cancelling during submission aborts the request and ignores its result", async () => {
  const { resolveRequest } = startPendingSubmission();

  await waitFor(() => expect(sendingSpinner()).not.toBeNull());

  fireEvent.click(button("Cancel"));
  fireEvent.click(alertButton("Discard"));

  const [, request] = fetchMock.mock.calls[0]!;

  expect(request?.signal?.aborted).toBe(true);

  await act(async () => {
    resolveRequest(new Response(null, { status: 204 }));
    await Promise.resolve();
  });

  expect(playSuccess).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(forceCloseWindow).toHaveBeenCalledOnce();
});

test("discarding a written message asks for confirmation and preserves it when cancelled", () => {
  render(<ContactBody />);
  compose();

  fireEvent.click(button("Discard"));

  expect(screen.getByText("Discard this message?")).toBeDefined();
  expect(playError).toHaveBeenCalledOnce();
  expect(forceCloseWindow).not.toHaveBeenCalled();

  fireEvent.click(alertButton("Cancel"));

  expect((input("Message:") as HTMLTextAreaElement).value).toBe("Hello.");
  expect(forceCloseWindow).not.toHaveBeenCalled();
});

test("confirming a discard closes the window", () => {
  render(<ContactBody />);
  compose();

  fireEvent.click(button("Discard"));
  fireEvent.click(alertButton("Discard"));

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(forceCloseWindow).toHaveBeenCalledOnce();
});

test("discarding an empty message closes the window without confirmation", () => {
  render(<ContactBody />);

  fireEvent.click(button("Discard"));

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(playError).not.toHaveBeenCalled();
  expect(forceCloseWindow).toHaveBeenCalledOnce();
});

test("the close guard allows an empty form to close and blocks a form with content", () => {
  render(<ContactBody />);

  expect(closeGuardRef.current?.()).toBe(false);

  act(() => {
    fill("Message:", "Hello.");
  });

  expect(closeGuardRef.current?.()).toBe(true);
});

test("confirming a guarded close dismisses the window", () => {
  render(<ContactBody />);
  compose();
  act(() => {
    closeGuardRef.current?.();
  });

  expect(forceCloseWindow).not.toHaveBeenCalled();

  fireEvent.click(alertButton("Discard"));

  expect(forceCloseWindow).toHaveBeenCalledOnce();
});
