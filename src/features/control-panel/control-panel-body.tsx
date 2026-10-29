import { useId } from "react";

import { Button } from "#/components/button.tsx";
import { PopupMenu } from "#/components/popup-menu.tsx";
import type { PopupMenuOption } from "#/components/popup-menu.tsx";
import { RadioGroup } from "#/components/radio-group.tsx";
import type { RadioGroupOption } from "#/components/radio-group.tsx";
import { Slider } from "#/components/slider.tsx";
import { ACCENT_COLOR_NAMES, accentColorOf } from "#/lib/accent-colors.ts";
import { resetSettingsAudibly, setSoundEffectsAudibly } from "#/lib/audio/sound-effects-setting.ts";
import { useIsHydrated } from "#/lib/hooks/use-client-value.ts";
import {
  APPEARANCE_LABELS,
  APPEARANCE_SETTINGS,
  SOUND_EFFECTS_LABELS,
  SOUND_EFFECTS_SETTINGS,
  THEME_COLOR_LABELS,
  setAppearance,
  setThemeChromaScale,
  setThemeColor,
  useSettings,
} from "#/lib/settings/settings.ts";
import type { AppearanceSetting, SoundEffectsSetting, ThemeColor } from "#/lib/settings/settings.ts";
import { THEME_CHROMA_SCALE_RANGE } from "#/lib/settings/theme-tint.ts";

import styles from "./control-panel-body.module.css";

const APPEARANCE_OPTIONS: ReadonlyArray<RadioGroupOption<AppearanceSetting>> = APPEARANCE_SETTINGS.map(
  (appearance) => ({
    value: appearance,
    label: APPEARANCE_LABELS[appearance],
  }),
);
const THEME_COLOR_OPTIONS: ReadonlyArray<PopupMenuOption<ThemeColor>> = ACCENT_COLOR_NAMES.map((themeColor) => ({
  value: themeColor,
  label: THEME_COLOR_LABELS[themeColor],
  swatchColor: accentColorOf(themeColor),
}));
const SOUND_EFFECTS_OPTIONS: ReadonlyArray<RadioGroupOption<SoundEffectsSetting>> = SOUND_EFFECTS_SETTINGS.map(
  (soundEffects) => ({
    value: soundEffects,
    label: SOUND_EFFECTS_LABELS[soundEffects],
    isSilent: soundEffects === "off", // Sound effects are still on when it is pressed.
  }),
);
const chromaScaleValueTextOf = (chromaScale: number) => `${Math.round(chromaScale * 100)}%`;

export function ControlPanelBody() {
  const idPrefix = useId();
  const isHydrated = useIsHydrated();
  const { appearance, themeColor, themeChromaScale, soundEffects } = useSettings();

  const appearanceLabelId = `${idPrefix}-appearance`;
  const themeColorLabelId = `${idPrefix}-theme-color`;
  const saturationLabelId = `${idPrefix}-saturation`;
  const soundEffectsLabelId = `${idPrefix}-sound-effects`;

  return (
    <div className={styles.controlPanelBody}>
      <div className={styles.controls}>
        <div className={styles.themeSettings}>
          <span id={themeColorLabelId} className={styles.label}>
            Theme colour:
          </span>
          <div className={styles.themeColorControls}>
            <PopupMenu
              className={styles.popupMenu}
              value={themeColor}
              options={THEME_COLOR_OPTIONS}
              disabled={!isHydrated}
              onChange={setThemeColor}
              aria-labelledby={themeColorLabelId}
            />
            <span id={saturationLabelId} hidden>
              Saturation
            </span>
            <Slider
              className={styles.slider}
              value={themeChromaScale}
              {...THEME_CHROMA_SCALE_RANGE}
              disabled={!isHydrated}
              valueTextOf={chromaScaleValueTextOf}
              onChange={setThemeChromaScale}
              aria-labelledby={saturationLabelId}
            />
          </div>
          <span id={appearanceLabelId} className={styles.label}>
            Appearance:
          </span>
          <RadioGroup
            value={appearance}
            options={APPEARANCE_OPTIONS}
            disabled={!isHydrated}
            onChange={setAppearance}
            aria-labelledby={appearanceLabelId}
          />
        </div>
        <span id={soundEffectsLabelId} className={styles.label}>
          Sound effects:
        </span>
        <RadioGroup
          value={soundEffects}
          options={SOUND_EFFECTS_OPTIONS}
          disabled={!isHydrated}
          onChange={setSoundEffectsAudibly}
          aria-labelledby={soundEffectsLabelId}
        />
      </div>
      <div className={styles.actions}>
        <Button disabled={!isHydrated} onClick={resetSettingsAudibly}>
          Use Defaults
        </Button>
      </div>
    </div>
  );
}
