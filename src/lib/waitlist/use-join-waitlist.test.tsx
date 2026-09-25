import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { jsonBodyOfFirstRequest, respondWith } from "#/test-utils/fetch.ts";

import { playSuccess } from "../audio/sounds.ts";

import { useJoinWaitlist } from "./use-join-waitlist.ts";

import type { WaitlistFields } from "./membership.ts";
import type { WaitlistJoin } from "./use-join-waitlist.ts";

vi.mock("../audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

const EMAIL_ADDRESS = "user@example.com";
const LIST = "List";
const SOURCE = "/collection/entry";

const fetchMock = vi.fn<typeof fetch>();
const onFailure = vi.fn<(message: string) => void>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  respondWith(fetchMock, 204);
  onFailure.mockReset();
  vi.mocked(playSuccess).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWaitlist({ list = LIST, source = SOURCE } = {}) {
  let waitlistJoin!: WaitlistJoin;

  function Harness() {
    waitlistJoin = useJoinWaitlist({ list, source, onFailure });
    return null;
  }

  render(<Harness />);

  const start = (fields: Partial<WaitlistFields> = {}) => waitlistJoin.join({ emailAddress: EMAIL_ADDRESS, ...fields });

  return {
    get state() {
      return waitlistJoin.state;
    },
    start, // Left for the caller to await, for a test that reads the state mid-flight.
    join: (fields: Partial<WaitlistFields> = {}) =>
      act(async () => {
        await start(fields);
      }),
  };
}

test("a submission includes the email address, list, and source route", async () => {
  const waitlist = renderWaitlist();
  await waitlist.join();

  expect(jsonBodyOfFirstRequest(fetchMock)).toMatchObject({ emailAddress: EMAIL_ADDRESS, list: LIST, source: SOURCE });
});

test("a submission includes the source route as its list when `list` is whitespace-only", async () => {
  const waitlist = renderWaitlist({ list: "  " });
  await waitlist.join();

  expect(jsonBodyOfFirstRequest(fetchMock)).toMatchObject({ list: SOURCE });
});

test("a successful submission changes the state to `joined` and plays the success sound", async () => {
  const waitlist = renderWaitlist();

  expect(waitlist.state).toBe("idle");
  await waitlist.join();

  expect(waitlist.state).toBe("joined");
  expect(playSuccess).toHaveBeenCalled();
  expect(onFailure).not.toHaveBeenCalled();
});

test("the state remains `joining` until the request settles", async () => {
  let release: (response: Response) => void = () => undefined;

  fetchMock.mockReturnValue(
    new Promise<Response>((resolve) => {
      release = resolve;
    }),
  );

  const waitlist = renderWaitlist();

  let joined!: Promise<void>;

  act(() => {
    joined = waitlist.start();
  });

  expect(waitlist.state).toBe("joining");

  release(new Response(null, { status: 204 }));
  await act(async () => {
    await joined;
  });

  expect(waitlist.state).toBe("joined");
});

test("a failed submission returns the state to `idle` and reports the failure message", async () => {
  respondWith(fetchMock, 502);

  const waitlist = renderWaitlist();

  await waitlist.join();

  expect(waitlist.state).toBe("idle");
  expect(onFailure).toHaveBeenCalledWith(expect.stringMatching(/couldn’t be joined/));
});

test("an invalid submission reports its field error", async () => {
  respondWith(fetchMock, 400, { errors: { emailAddress: "That doesn’t look like an email address." } });

  const waitlist = renderWaitlist();

  await waitlist.join();

  expect(onFailure).toHaveBeenCalledWith("That doesn’t look like an email address.");
});

test("an invalid submission without a field error reports the default message", async () => {
  respondWith(fetchMock, 400, { errors: {} });

  const waitlist = renderWaitlist();

  await waitlist.join();

  expect(onFailure).toHaveBeenCalledWith(expect.stringMatching(/couldn’t be joined/));
});
