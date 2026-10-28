import { getSettings, resetSettings, setSoundEffects } from "../settings/settings.ts";

import { playClickSound } from "./sounds.ts";

import type { SoundEffectsSetting } from "../settings/settings.ts";

/**
 * Applies a change to the settings, and plays the click sound when the change turns sound effects on, since the press
 * that made the change did not play its sound while they were off.
 */
function changeSettingsAudibly(change: () => void) {
  const wasOff = getSettings().soundEffects === "off";

  change();

  if (wasOff && getSettings().soundEffects === "on") {
    playClickSound();
  }
}

export function setSoundEffectsAudibly(setting: SoundEffectsSetting) {
  changeSettingsAudibly(() => setSoundEffects(setting));
}

export function resetSettingsAudibly() {
  changeSettingsAudibly(resetSettings);
}
