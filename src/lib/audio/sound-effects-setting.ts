import { getSettings, resetSettings, setSoundEffects } from "../settings/settings.ts";

import { playClickSound } from "./sounds.ts";

import type { SoundEffectsSetting } from "../settings/settings.ts";

// Applies a settings change and plays the click sound when turning sound effects on (the triggering press was silent).
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
