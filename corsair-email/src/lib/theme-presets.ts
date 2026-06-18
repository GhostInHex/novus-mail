export type ResolvedTheme = "light" | "dark";

export const THEME_PRESETS = [
  {
    id: "light-default",
    label: "Default Light",
    description: "Warm paper, indigo chrome.",
    mode: "light",
    swatches: ["#f3f1ec", "#1b1938", "#c9b4fa"],
  },
  {
    id: "light-cloud",
    label: "Cloud Light",
    description: "Cool Gmail-style blues.",
    mode: "light",
    swatches: ["#eef4fb", "#0b57d0", "#8ab4f8"],
  },
  {
    id: "light-sage",
    label: "Sage Light",
    description: "Quiet green, calm focus.",
    mode: "light",
    swatches: ["#edf3ef", "#1f4d3a", "#8fd3b4"],
  },
  {
    id: "light-terracotta",
    label: "Terracotta Light",
    description: "Warm copper, editorial tone.",
    mode: "light",
    swatches: ["#f7efe8", "#8f4b2e", "#ffccae"],
  },
  {
    id: "dark-default",
    label: "Default Dark",
    description: "Current midnight indigo.",
    mode: "dark",
    swatches: ["#0e0c1f", "#1b1938", "#c9b4fa"],
  },
  {
    id: "dark-graphite",
    label: "Graphite Dark",
    description: "Neutral slate with blue energy.",
    mode: "dark",
    swatches: ["#101418", "#1f3248", "#8ab4f8"],
  },
  {
    id: "dark-evergreen",
    label: "Evergreen Dark",
    description: "Deep forest, calmer contrast.",
    mode: "dark",
    swatches: ["#0d1714", "#153227", "#7de2b6"],
  },
  {
    id: "dark-ember",
    label: "Ember Dark",
    description: "Warm charcoal with ember accents.",
    mode: "dark",
    swatches: ["#170f13", "#362127", "#ffb59a"],
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

export function isThemePresetId(value: string | null | undefined): value is ThemePresetId {
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
