import { useSyncExternalStore } from "react";

import { createEmitter } from "../emitter.ts";

import { readContributionCalendar } from "./client.ts";

import type { ContributionCalendar } from "./contributions.ts";

const { emit, subscribe: addListener } = createEmitter();

let calendar: ContributionCalendar | null | undefined;
let isReading = false;
let subscriberCount = 0;

function readUnlessReadOrReading() {
  if (calendar !== undefined || isReading) {
    return;
  }

  isReading = true;

  void readContributionCalendar().then((readCalendar) => {
    isReading = false;
    calendar = readCalendar === null && subscriberCount === 0 ? undefined : readCalendar;

    emit();
  });
}

function subscribe(listener: () => void) {
  const removeListener = addListener(listener);

  subscriberCount += 1;

  readUnlessReadOrReading();

  return () => {
    removeListener();

    subscriberCount -= 1;

    if (subscriberCount === 0 && calendar === null) {
      calendar = undefined;
    }
  };
}

const calendarSnapshot = () => calendar;
const serverSnapshot = () => undefined;

/** Returns the contribution calendar. `undefined` while it is read, and `null` when it cannot be read. */
export function useContributionCalendar(): ContributionCalendar | null | undefined {
  return useSyncExternalStore(subscribe, calendarSnapshot, serverSnapshot);
}
