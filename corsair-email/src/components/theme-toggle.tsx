"use client";

import * as React from "react";
import { CheckIcon, MonitorCogIcon, MoonIcon, PaletteIcon, SunIcon } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  THEME_PRESETS,
  getDefaultThemeForMode,
  getThemePreset,
  type ResolvedTheme,
  type ThemePreset,
} from "@/lib/theme-presets";
import { cn } from "@/lib/utils";

function ThemeRow({
  preset,
  active,
  onSelect,
}: {
  preset: ThemePreset;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      className="flex items-center gap-3 rounded-lg px-2.5 py-2"
      onSelect={(event) => {
        event.preventDefault();
        onSelect();
      }}
    >
      <div className="flex items-center gap-1.5">
        {preset.swatches.map((swatch) => (
          <span
            key={swatch}
            className="size-3 rounded-full ring-1 ring-black/10 dark:ring-white/10"
            style={{ backgroundColor: swatch }}
            aria-hidden
          />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{preset.label}</p>
        <p className="truncate text-xs text-muted-foreground">{preset.description}</p>
      </div>
      {active && <CheckIcon className="size-4 text-primary" />}
    </DropdownMenuItem>
  );
}

function ModeButton({
  mode,
  active,
  onSelect,
  label,
  fullWidth = false,
}: {
  mode: ResolvedTheme;
  active: boolean;
  onSelect: () => void;
  label: string;
  fullWidth?: boolean;
}) {
  const Icon = mode === "light" ? SunIcon : MoonIcon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "motion-interactive inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
        fullWidth ? "w-full justify-start" : "",
        active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

export function ThemeToggle({
  className,
  compact = false,
  simple = false,
}: {
  className?: string;
  compact?: boolean;
  simple?: boolean;
}) {
  const { theme, resolvedTheme, setTheme, setResolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const activePreset = mounted ? getThemePreset(theme) : getThemePreset(getDefaultThemeForMode("dark"));
  const Icon = activePreset.mode === "light" ? SunIcon : MoonIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "shrink-0 border-border/80 bg-muted/70",
            compact ? "size-9 rounded-lg justify-center p-0" : "h-9 justify-start gap-2 px-3 text-sm font-medium",
            className,
          )}
          aria-label="Choose theme"
          title="Choose theme"
        >
          <Icon className="size-4" />
          {compact ? <span className="sr-only">Choose theme</span> : <span>{activePreset.label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn(simple ? "w-[220px]" : "w-[300px]", "rounded-xl p-2")}>
        <DropdownMenuLabel className="flex items-center gap-2 px-2 pb-1 text-sm">
          <MonitorCogIcon className="size-4" />
          {simple ? "Theme" : "Theme presets"}
        </DropdownMenuLabel>
        <div className={cn("flex gap-1", simple ? "flex-col px-1 py-1" : "items-center px-2 py-1")}>
          <ModeButton
            mode="light"
            active={resolvedTheme === "light"}
            onSelect={() => setResolvedTheme("light")}
            label={simple ? "Default Light" : "Light"}
            fullWidth={simple}
          />
          <ModeButton
            mode="dark"
            active={resolvedTheme === "dark"}
            onSelect={() => setResolvedTheme("dark")}
            label={simple ? "Default Dark" : "Dark"}
            fullWidth={simple}
          />
        </div>
        {!simple && (
          <>
            <DropdownMenuSeparator />
            <div className="grid gap-1 px-1 py-1">
              <div>
                <p className="px-2 pb-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Light
                </p>
                <div className="space-y-0.5">
                  {THEME_PRESETS.filter((preset) => preset.mode === "light").map((preset) => (
                    <ThemeRow
                      key={preset.id}
                      preset={preset}
                      active={theme === preset.id}
                      onSelect={() => setTheme(preset.id)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="px-2 pb-1 pt-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Dark
                </p>
                <div className="space-y-0.5">
                  {THEME_PRESETS.filter((preset) => preset.mode === "dark").map((preset) => (
                    <ThemeRow
                      key={preset.id}
                      preset={preset}
                      active={theme === preset.id}
                      onSelect={() => setTheme(preset.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
