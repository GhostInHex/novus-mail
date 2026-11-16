"use client";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
  simple?: boolean;
}) {
  const { resolvedTheme, setResolvedTheme } = useTheme();
  const target = resolvedTheme === "dark" ? "light" : "dark";
  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon-sm" : "sm"}
      className={cn("rounded-full", className)}
      aria-label={`Switch to ${target} mode`}
      onClick={() => setResolvedTheme(target)}
    >
      {resolvedTheme === "dark" ? (
        <SunIcon className="size-4" />
      ) : (
        <MoonIcon className="size-4" />
      )}
      {!compact && (target === "light" ? "Light mode" : "Dark mode")}
    </Button>
  );
}
