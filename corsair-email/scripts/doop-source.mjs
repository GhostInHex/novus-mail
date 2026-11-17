import fs from "node:fs";

export const canvas = JSON.parse(
  fs.readFileSync("design/doop/canvas.json", "utf8"),
);
const roles = {
  ink: "foreground",
  muted: "muted-foreground",
  paper: "card",
  page: "background",
  shell: "shell",
  selected: "accent",
  line: "border",
  ok: "success",
  "warning-bg": "warning-background",
  "warning-text": "warning-foreground",
  "button-base": "glaze-base",
  on: "glaze-ink",
};

export function frameForTheme(lightFrame, theme) {
  const source = canvas.frames.find((f) => f.id === lightFrame);
  const frame =
    theme === "light"
      ? source
      : canvas.frames.find(
          (f) => f.name === source.name.replace(/ Light$/, " Dark"),
        );
  if (!frame) throw Error(`Missing ${theme} pair for ${lightFrame}`);
  return frame;
}

export function appStyle(style) {
  return style
    .replaceAll(
      "font-family:Geist, sans-serif",
      "font-family:var(--font-geist-sans), sans-serif",
    )
    .replace(
      /var\(--glaze-(?:light|dark)-([\w-]+)\)/g,
      (_, role) => `var(--${roles[role] || role})`,
    )
    .replaceAll("var(--glaze-font)", "var(--font-geist-sans)")
    .replaceAll("var(--glaze-mono)", "var(--font-geist-mono)")
    .replaceAll("var(--tw-border-style)", "solid")
    .replaceAll("var(--nm-ascii-sheen)", "var(--glaze-sheen)")
    .replaceAll("var(--nm-ascii-shadow)", "var(--glaze-shadow)")
    .replace(
      /var\(--nm-ascii-glaze-graphite-(top|base|bottom|ink)\)/g,
      (_, role) => `var(--glaze-${role})`,
    );
}
