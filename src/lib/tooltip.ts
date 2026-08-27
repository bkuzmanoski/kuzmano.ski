export const HIDE_DELAY_MS = 100;
export const GRACE_PERIOD_MS = 600;

/**
 * How long a control displays transient state through its tooltip. The control owns the timing,
 * since only it knows what the state is; the value is shared so that they all display it for the
 * same length of time.
 */
export const STATE_DISPLAY_DURATION_MS = 1_200;

let groupInGracePeriod: Element | null = null;
let gracePeriodTimeout: ReturnType<typeof setTimeout> | undefined;
let pendingHideAction: (() => void) | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | undefined;

export const isGroupInGracePeriod = (wrapper: Element | null) =>
  wrapper !== null && wrapper.parentElement === groupInGracePeriod;

export function resetGroupGracePeriod(wrapper: Element | null) {
  clearTimeout(gracePeriodTimeout);
  groupInGracePeriod = wrapper?.parentElement ?? null;
}

export function startGroupGracePeriod() {
  clearTimeout(gracePeriodTimeout);
  gracePeriodTimeout = setTimeout(() => (groupInGracePeriod = null), GRACE_PERIOD_MS);
}

/**
 * Runs the pending hide immediately, cancelling any scheduled timeout.
 *
 * This lets the next tooltip replace the current one without both being visible at once.
 */
export function runPendingHideAction() {
  clearTimeout(hideTimeout);
  pendingHideAction?.();

  pendingHideAction = null;
}

/** Schedules a tooltip to hide, replacing any previously scheduled timeout. */
export function hideAfterDelay(hideAction: () => void) {
  runPendingHideAction();

  pendingHideAction = hideAction;
  hideTimeout = setTimeout(runPendingHideAction, HIDE_DELAY_MS);
}

/** Clears shared state between tests. */
export function resetTooltipState() {
  clearTimeout(gracePeriodTimeout);
  clearTimeout(hideTimeout);
  groupInGracePeriod = null;
  pendingHideAction = null;
}
