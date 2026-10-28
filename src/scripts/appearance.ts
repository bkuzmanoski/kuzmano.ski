import { APPEARANCE_STORAGE_KEY, applyAppearance, isAppearanceSetting } from "#/lib/settings/theme.ts";
import { readStored } from "#/lib/storage.ts";

// Runs in the document head before first paint (prior to hydration) so the stored appearance is
// applied from the first paint.

const storedAppearance = readStored(APPEARANCE_STORAGE_KEY);

if (storedAppearance !== null && isAppearanceSetting(storedAppearance)) {
  applyAppearance(storedAppearance);
}
