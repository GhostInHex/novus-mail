"use client";

import { MotionConfig } from "motion/react";
import {
  ThemeProvider as NextThemeProvider,
  useTheme as useNextTheme,
} from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import {
  DEFAULT_THEME_PRESET,
  THEME_PRESETS,
  getDefaultThemeForMode,
  getThemePreset,
  isThemePresetId,
  type ResolvedTheme,
  type ThemePresetId,
} from "@/lib/theme-presets";

const themeClasses = Object.fromEntries(
  THEME_PRESETS.map((preset) => [preset.id, preset.mode]),
);

function ThemeEffects({ children }: { children: React.ReactNode }) {
  const { theme, resolvedTheme } = useTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster
        theme={resolvedTheme}
        position="bottom-right"
        closeButton
        toastOptions={{ className: "doop-toast" }}
      />
    </MotionConfig>
  );
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
  return (
    <NextThemeProvider
      attribute="class"
      storageKey="novusmail-theme"
      defaultTheme={defaultTheme}
      themes={THEME_PRESETS.map((p) => p.id)}
      value={themeClasses}
      enableSystem={false}
      disableTransitionOnChange
    >
      <ThemeEffects>{children}</ThemeEffects>
    </NextThemeProvider>
  );
}

export function useTheme() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { theme: selected, setTheme: setNextTheme } = useNextTheme();
  const theme = !mounted
    ? DEFAULT_THEME_PRESET
    : isThemePresetId(selected)
      ? selected
      : selected === "light"
        ? getDefaultThemeForMode("light")
        : DEFAULT_THEME_PRESET;
  const setTheme = useCallback(
    (value: ThemePresetId) => setNextTheme(value),
    [setNextTheme],
  );
  const setResolvedTheme = useCallback(
    (mode: ResolvedTheme) => setNextTheme(getDefaultThemeForMode(mode)),
    [setNextTheme],
  );
  return {
    theme,
    resolvedTheme: getThemePreset(theme).mode,
    setTheme,
    setResolvedTheme,
  };
}
