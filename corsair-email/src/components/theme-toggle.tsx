"use client";

import * as React from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const currentTheme = mounted ? resolvedTheme ?? theme : "dark";
  const current = currentTheme === "light" ? "light" : "dark";
  const nextTheme = current === "light" ? "dark" : "light";
  const label = nextTheme === "light" ? "Light mode" : "Dark mode";
  const Icon = nextTheme === "light" ? SunIcon : MoonIcon;

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={label}
      title={label}
      className={cn(
        "motion-interactive inline-flex shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "size-9 rounded-lg px-0" : "h-9 gap-2 px-3 text-sm font-medium",
        className,
      )}
    >
      <Icon className="size-4" />
      {compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </button>
  );
}
