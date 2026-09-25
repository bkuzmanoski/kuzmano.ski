import { act, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

import type { ContributionCalendar } from "./contributions.ts";
import type { JSX } from "react";

const readContributionCalendar = vi.hoisted(() => vi.fn<() => Promise<ContributionCalendar | null>>());

vi.mock("./client.ts", () => ({ readContributionCalendar }));

const CALENDAR: ContributionCalendar = { total: 3, weeks: [[{ date: "2026-01-07", count: 3 }]] };

let settleRead: (calendar: ContributionCalendar | null) => Promise<void>;

let Probe: () => JSX.Element;

beforeEach(async () => {
  readContributionCalendar.mockReset();
  readContributionCalendar.mockImplementation(
    () =>
      new Promise((resolve) => {
        settleRead = (calendar) =>
          act(async () => {
            resolve(calendar);
            await Promise.resolve();
          });
      }),
  );

  vi.resetModules();

  const { useContributionCalendar } = await import("./use-contribution-calendar.ts");

  Probe = function CalendarProbe() {
    const calendar = useContributionCalendar();

    return <output>{calendar === undefined ? "pending" : calendar === null ? "failed" : calendar.total}</output>;
  };
});

const probeText = () => screen.getByRole("status").textContent;

test("returns `undefined` on the server and during hydration, then the calendar once it is read", async () => {
  const container = document.createElement("div");

  container.innerHTML = renderToString(<Probe />);
  document.body.append(container);

  expect(container.textContent).toBe("pending");
  expect(readContributionCalendar).not.toHaveBeenCalled();

  // A hydration render that returned a calendar would not match the server markup,
  // which React recovers from and reports here.
  const onRecoverableError = vi.fn();

  act(() => {
    hydrateRoot(container, <Probe />, { onRecoverableError });
  });
  await settleRead(CALENDAR);

  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(container.textContent).toBe("3");

  container.remove();
});

test("reads the contribution calendar once for every component reading it at the same time", async () => {
  render(
    <>
      <Probe />
      <Probe />
    </>,
  );
  await settleRead(CALENDAR);

  expect(screen.getAllByRole("status").map((output) => output.textContent)).toEqual(["3", "3"]);
  expect(readContributionCalendar).toHaveBeenCalledOnce();
});

test("reads the contribution calendar once when Strict Mode subscribes a component twice", async () => {
  render(
    <StrictMode>
      <Probe />
    </StrictMode>,
  );
  await settleRead(CALENDAR);

  expect(probeText()).toBe("3");
  expect(readContributionCalendar).toHaveBeenCalledOnce();
});

test("renders the contribution calendar at once, without reading it again, in a component mounted again", async () => {
  const { unmount } = render(<Probe />);

  await settleRead(CALENDAR);
  unmount();
  render(<Probe />);

  expect(probeText()).toBe("3");
  expect(readContributionCalendar).toHaveBeenCalledOnce();
});

test("keeps a contribution calendar read after every component unmounted for the next mount", async () => {
  const { unmount } = render(<Probe />);

  unmount();
  await settleRead(CALENDAR);
  render(<Probe />);

  expect(probeText()).toBe("3");
  expect(readContributionCalendar).toHaveBeenCalledOnce();
});

test("returns `null` when the contribution calendar cannot be read, and reads it again in a component mounted again", async () => {
  const { unmount } = render(<Probe />);

  await settleRead(null);

  expect(probeText()).toBe("failed");

  unmount();
  render(<Probe />);

  expect(probeText()).toBe("pending");
  expect(readContributionCalendar).toHaveBeenCalledTimes(2);

  await settleRead(CALENDAR);

  expect(probeText()).toBe("3");
});

test("reads the contribution calendar again in the next mount when a read that fails finishes after every component unmounted", async () => {
  const { unmount } = render(<Probe />);

  unmount();
  await settleRead(null);
  render(<Probe />);

  expect(probeText()).toBe("pending");
  expect(readContributionCalendar).toHaveBeenCalledTimes(2);
});
