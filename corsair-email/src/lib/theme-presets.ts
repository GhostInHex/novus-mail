export type ResolvedTheme = "light" | "dark";

export const THEME_PRESETS = [
  {
    id: "light-default",
    label: "Light",
    description: "Doop Glaze light",
    mode: "light",
    swatches: ["#f2f1ed", "#252422", "#a1c4b3"],
  },
  {
    id: "dark-default",
    label: "Dark",
    description: "Doop Glaze dark",
    mode: "dark",
    swatches: ["#0b0c0e", "#ededee", "#a1c4b3"],
  },
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number];
export type ThemePresetId = ThemePreset["id"];

export const DEFAULT_LIGHT_THEME: ThemePresetId = "light-default";
export const DEFAULT_DARK_THEME: ThemePresetId = "dark-default";
export const DEFAULT_THEME_PRESET: ThemePresetId = DEFAULT_DARK_THEME;

const PRESET_LOOKUP = new Map<ThemePresetId, ThemePreset>(
  THEME_PRESETS.map((preset) => [preset.id, preset]),
);

export function isThemePresetId(
  value: string | null | undefined,
): value is ThemePresetId {
  return typeof value === "string" && PRESET_LOOKUP.has(value as ThemePresetId);
}

export function getThemePreset(value: string | null | undefined): ThemePreset {
  if (isThemePresetId(value)) {
    return PRESET_LOOKUP.get(value)!;
  }

  return PRESET_LOOKUP.get(DEFAULT_THEME_PRESET)!;
}

export function getDefaultThemeForMode(mode: ResolvedTheme): ThemePresetId {
  return mode === "light" ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME;
}
