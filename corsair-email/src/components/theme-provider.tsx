"use client";

import * as React from "react";

import {
  DEFAULT_THEME_PRESET,
  getDefaultThemeForMode,
  getThemePreset,
  isThemePresetId,
  type ResolvedTheme,
  type ThemePresetId,
} from "@/lib/theme-presets";

type ThemeContextValue = {
  theme: ThemePresetId;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePresetId) => void;
  setResolvedTheme: (theme: ResolvedTheme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);
const THEME_STORAGE_KEY = "novusmail-theme";

function applyTheme(theme: ThemePresetId) {
  const root = document.documentElement;
  const preset = getThemePreset(theme);

  root.classList.toggle("dark", preset.mode === "dark");
  root.dataset.theme = preset.id;
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME_PRESET,
}: {
  children: React.ReactNode;
  defaultTheme?: ThemePresetId;
  attribute?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}) {
  const [theme, setThemeState] = React.useState<ThemePresetId>(defaultTheme);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme =
      stored === "light"
        ? getDefaultThemeForMode("light")
        : stored === "dark"
          ? getDefaultThemeForMode("dark")
          : isThemePresetId(stored)
            ? stored
            : defaultTheme;
    setThemeState(nextTheme);
    applyTheme(nextTheme);
  }, [defaultTheme]);

  const setTheme = React.useCallback((nextTheme: ThemePresetId) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }, []);

  const setResolvedTheme = React.useCallback(
    (nextTheme: ResolvedTheme) => {
      setTheme(getDefaultThemeForMode(nextTheme));
    },
    [setTheme],
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme: getThemePreset(theme).mode,
      setTheme,
      setResolvedTheme,
    }),
    [theme, setResolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }
  return context;
}
