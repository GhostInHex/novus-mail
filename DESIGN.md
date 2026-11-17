---
name: NovusMail
description: A focused Gmail and Calendar workspace with visible user control.
colors:
  light-background: "#f2f1ed"
  light-foreground: "#252422"
  light-card: "#f5f4f0"
  light-primary: "#4a4844"
  light-on-primary: "#f5f4f0"
  light-muted: "#eae8e3"
  light-secondary-text: "#5e5c57"
  light-border: "#2524221f"
  light-ring: "#699b85"
  dark-background: "#0b0c0e"
  dark-foreground: "#ededee"
  dark-card: "#141517"
  dark-primary: "#35383e"
  dark-on-primary: "#f5f6f7"
  dark-muted: "#1b1c1f"
  dark-secondary-text: "#b2b3b7"
  dark-border: "#ededee26"
  sage: "#a1c4b3"
  on-sage: "#0b1712"
  landing-dark-background: "#000000"
typography:
  display-desktop:
    fontFamily: '"Instrument Serif", Georgia, serif'
    fontSize: "68px"
    fontWeight: 400
    lineHeight: 0.94
  app-body:
    fontFamily: "Geist, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  app-action:
    fontFamily: "Geist, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
rounded:
  app-action: "8px"
  queue: "10px"
  dialog: "12px"
  landing-panel: "16px"
  pill: "999px"
spacing:
  tight: "4px"
  small: "8px"
  control-gap: "12px"
  standard: "16px"
  panel: "20px"
  section-inset: "24px"
  roomy: "32px"
components:
  app-primary-light:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-on-primary}"
    rounded: "{rounded.app-action}"
    padding: "9px 16px"
    typography: "{typography.app-action}"
  app-primary-dark:
    backgroundColor: "{colors.dark-primary}"
    textColor: "{colors.dark-on-primary}"
    rounded: "{rounded.app-action}"
    padding: "9px 16px"
    typography: "{typography.app-action}"
---

# NovusMail design system

## Overview

Read this guide before adding or changing a UI component. It records the current design and sets the rules for extending it. [PRODUCT.md](./PRODUCT.md) owns product purpose, audience, and principles. This document owns visual and interaction guidance; the linked implementation files supply the runtime values. Keep both code and this guide current when a shared rule changes. Frontmatter records existing values for tooling; use CSS variables in components rather than copying those literals.

NovusMail should feel focused, calm, and controlled. Make the next task easy to find, keep mail and calendar context visible, and show the user what an action will do. AI proposals must expose the review and confirmation step unless the user has explicitly enabled the existing auto-approval option. Do not introduce silent sends or calendar changes through a new component.

There are two related visual surfaces:

| Surface | Purpose | Visual treatment |
| --- | --- | --- |
| Landing page | Explain the product and invite a visitor to start | Instrument Serif headlines, generous spacing, landscape imagery, ASCII mountains, and glossy pill CTAs |
| Workspace, authentication, and dialogs | Read, decide, compose, and review | Geist text, compact grouping, neutral surfaces, Doop glaze primary actions, explicit state and feedback |

### Implementation map

Paths below are relative to the repository root.

| File or directory | Owns |
| --- | --- |
| [globals.css](./corsair-email/src/app/globals.css) | Tailwind v4 theme mappings, font aliases, base radius, elevation, and motion tokens |
| [doop-theme.css](./corsair-email/src/app/doop-theme.css) | Light/dark semantic colors and existing shared surface styles |
| [app-controls.css](./corsair-email/src/app/app-controls.css) | App button sizing and label typography; must not repaint the imported glaze treatment |
| [landing-page.css](./corsair-email/src/components/landing/landing-page.css) | Landing-only `--nm-ascii-*` tokens and reusable `.nm-*` classes |
| [layout.tsx](./corsair-email/src/app/layout.tsx) | Font loading, providers, and global stylesheet imports |
| [theme-provider.tsx](./corsair-email/src/components/theme-provider.tsx) / [theme-presets.ts](./corsair-email/src/lib/theme-presets.ts) | Theme selection, persistence, and supported presets |
| [components/ui](./corsair-email/src/components/ui) | Shared Button, Input, Textarea, Dialog, DropdownMenu, Tooltip, and other primitives |
| [dashboard.css](./corsair-email/src/components/dashboard/dashboard.css) | Workspace grid, reader, navigation, composer, and responsive layout |
| [components/doop](./corsair-email/src/components/doop) | Assistant presentation and existing source adaptations |
| [design/doop/README.md](./corsair-email/design/doop/README.md) | Imported artboard provenance and regeneration instructions |

The Doop artboards are the reference for app chrome, including the glaze primary buttons defined in `doop-theme.css`: a pill radius, a vertical gradient, an inset highlight, and a sheen layer. Keep that treatment; normalize only sizing and label typography through `app-controls.css`. The landing page keeps its own `--nm-ascii-*` glaze system.

## Colors

Use semantic roles in app components: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `ring-ring`, `bg-primary`, and `text-primary-foreground`. These map through `globals.css` to theme variables. Pair backgrounds with their matching foreground tokens.

| Role / CSS variable | Light | Dark |
| --- | --- | --- |
| Page / `--background` | `#f2f1ed` | `#0b0c0e` |
| Main text / `--foreground` | `#252422` | `#ededee` |
| Card and popover / `--card`, `--popover` | `#f5f4f0` | `#141517` |
| Primary action / `--primary` | `#4a4844` | `#35383e` |
| Primary-action text / `--primary-foreground` | `#f5f4f0` | `#f5f6f7` |
| Quiet surface / `--muted`, `--secondary`, `--accent` | `#eae8e3` | `#1b1c1f` |
| Secondary text / `--muted-foreground` | `#5e5c57` | `#b2b3b7` |
| Border / `--border` | `#2524221f` | `#ededee26` |
| Focus / `--ring` | `#699b85` | `#a1c4b3` |
| Success / `--success` | `#237454` | `#a1c4b3` |

Sage (`--sage: #a1c4b3`, paired with `--on-sage: #0b1712`) is an accent for selected contextual actions. In the app, `--accent` means a quiet neutral surface; it is not a synonym for sage. Use `--destructive` for destructive actions and include a clear label rather than relying on color.

The landing page uses scoped `--nm-ascii-*` variables. Its dark page background is pure black, distinct from the app's near-black. Preserve that distinction; do not change the app palette to match the hero.

Use `useTheme()` from the local theme provider. Supported preset IDs are `light-default` and `dark-default`, stored under `novusmail-theme`. Do not add a separate theme store or directly toggle `html.dark`. Use `setResolvedTheme()` for switching between the current modes.

## Typography

Fonts are loaded once through `next/font` in the root layout:

- **Geist:** app navigation, messages, controls, and body text. Use `font-sans` or `var(--font-geist-sans)` with a sans-serif fallback.
- **Instrument Serif, weight 400:** landing headlines and branding. Reuse `.font-serif-display`; do not apply it to operational UI.
- **Geist Mono:** code, keyboard notation, and ASCII rendering. Use `font-mono` when the content calls for it.

| Role | Existing size / rhythm | Guidance |
| --- | --- | --- |
| Landing hero | 48px base, 60px at `sm`, 68px at `md`; line-height 0.94 | The mobile CSS also adjusts this with `clamp()`. Reuse the existing hero classes. |
| Workspace section headings | 26px, approximately 1.19 line-height | Inbox, reader subject, agenda |
| Dialog titles | 23px, approximately 1.26 line-height | Keep title and description separate |
| Workspace body | 14px / 1.5 | Default for a new operational component |
| App primary actions | 14px / 20px, weight 500 | Allow long labels to wrap without clipping |
| Metadata | Usually 12–13px | Timestamps, connection status, supporting descriptions |

Use sentence case and concrete action labels: “Reply”, “Create event”, “Log out”. Preserve clear distinctions between draft, pending review, sending, sent, and failed. Allow long subjects, addresses, and translated labels to wrap; truncate list previews only when the full content remains accessible in the reader. Keep body copy left aligned and reserve centered display text for the landing page.

## Layout

Build from the existing surface rather than introducing another page shell. Use the spacing steps in frontmatter; 8–12px groups controls, 16–24px separates panel content, and larger gaps separate sections. These are recurring measurements, not a new set of runtime spacing variables.

The landing page uses centered containers, commonly `max-w-5xl` with `px-6`. The hero copy has its own narrower container. The workspace is a multi-panel layout: folders, thread queue, reader, and optional agenda. Its default desktop content columns are 360px, flexible reader, and 280px agenda, alongside a 200px sidebar. The sidebar can collapse to 88px. Reuse the existing collapse and mobile-navigation behavior.

| Boundary | Existing use |
| --- | --- |
| 640px / Tailwind `sm` | Landing typography and compact layouts |
| 768px / Tailwind `md` | Dashboard mobile/desktop transition; single-reader flow and mobile folders |
| 1200px | Dashboard hides the agenda in its narrower layout |

A breakpoint belongs to its surface. Do not apply dashboard panel behavior to the landing page just because the width is similar.

For flex and grid children that can shrink, set `min-width: 0`; for scrollable flex children, set `min-height: 0`. Prefer one clear scroll owner per panel. In dialogs, keep the header and composer/footer outside the scrolling content so long results cannot cover the input. Avoid fixed content heights that clip wrapped text or action labels.

### Scrolling and motion

[globals.css](./corsair-email/src/app/globals.css) defines the shared motion tokens:

| Token | Value |
| --- | --- |
| `--motion-duration-quick` | 140ms |
| `--motion-duration-snappy` | 180ms |
| `--motion-duration-panel` | 240ms |
| `--motion-ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` |
| `--motion-ease-soft` | `cubic-bezier(0.25, 1, 0.5, 1)` |

Reuse existing motion utility classes or these tokens. Feedback should be subtle and interruptible; do not animate every row or add delays to frequent keyboard actions. Respect `prefers-reduced-motion` and gate hover-specific effects for the relevant input device.

[SmoothScroll](./corsair-email/src/components/smooth-scroll.tsx) owns Lenis for the document and selected dashboard panels. Do not add a second root Lenis instance or competing CSS `scroll-behavior: smooth`. AI conversations use native scrolling with `data-lenis-prevent` so streaming and “Jump to latest” remain under their own control. New independently scrolling content must deliberately choose whether it belongs in Lenis or should opt out.

The ASCII mountains render through [ascii-mountains.worker.ts](./corsair-email/src/components/landing/ascii-mountains.worker.ts) and [mountain-painter.ts](./corsair-email/src/components/landing/mountain-painter.ts). Preserve worker rendering, visibility-based pausing, capped pixel density, reduced-motion handling, and the lightweight fallback. Decorative animation must not compete with scrolling on the main thread. Profile the actual scrolling path before claiming an optimization.

## Elevation & Depth

Use neutral surface changes and thin borders for workspace hierarchy. Primary app buttons are glaze pills: a vertical gradient with an inset top highlight, a lower inset shadow, and a sheen layer. Secondary, ghost, and icon controls stay flat. Reserve drop elevation for overlays and surfaces that need to separate from the page.

Shared elevation tokens are `--elevation-1: 0 1px 3px #00000010` and `--elevation-2: 0 8px 24px #00000020`. Existing dialogs also use `0 20px 60px #0003`; reuse the dialog primitive instead of recreating that treatment.

The landing page's `.nm-glaze` CTAs and translucent composer are a separate system built on `--nm-ascii-*` tokens. Reuse those classes within the landing surface; do not spread their blur or layout rules to app buttons and lists, and do not replace app glaze with landing glaze.

## Shapes

- **App primary actions:** fully rounded glaze pills with a minimum height of 40px for text actions; height can grow with the label.
- **Queue containers:** 10px corners.
- **Dialogs:** 12px corners.
- **Landing panels:** 16px corners.
- **Landing CTA and filter pills:** fully rounded, using the landing control tokens.

The base radius is `--radius: 0.625rem`; Tailwind derives `rounded-sm`, `rounded-md`, `rounded-lg`, and `rounded-xl` from it. That produces 6px, 8px, 10px, and 14px respectively. Explicit surface radii above are intentional overrides; do not assume every panel should use `rounded-xl`.

Keep clipping on content boundaries that need it, such as images. Do not clip a button's text, focus ring, or decorative layers to simulate its shape. Check optical alignment between nested surfaces and their controls.

## Components

### Start a new component

1. Identify its surface and task. Reuse the nearest existing component and shell.
2. Build with primitives from `@/components/ui`, semantic colors, and the spacing and typography above. Use `cn()` for conditional classes and Lucide for UI icons.
3. Implement all relevant states: empty, loading, populated, disabled, error, and success. Keep unavailable actions understandable.
4. Check the resolved styles in both themes, including hover, focus, and long content. Imported CSS can override Tailwind utilities.
5. Verify keyboard use, mobile layout, reduced motion, and scrolling. Update this guide when adding or changing a shared rule.

### Buttons and actions

Use `Button` from `@/components/ui/button`. Use a native link, or `Button asChild` wrapping a link, for navigation. Set `type="button"` on buttons inside forms unless they submit the form.

| Variant | Use |
| --- | --- |
| `default` | Primary action; renders as the Doop glaze pill defined in `doop-theme.css` |
| `outline` / `secondary` | Secondary actions that need a visible control boundary |
| `ghost` | Quiet toolbar and contextual actions |
| `destructive` | Delete, discard, or other destructive actions |
| `link` | A text action with link-like presentation; use an actual anchor for navigation |

`app-controls.css` is scoped to `.dashboard`, `.doop-modal`, `.doop-auth`, and `.doop-site-nav`. Inside those roots it normalizes layout and type only: flex centering, gap, 14px / 20px text, 9px 16px padding, a 40px minimum height, and a fit-content minimum width. It must never redeclare `border`, `border-radius`, `background`, `box-shadow`, `text-shadow`, `filter`, `overflow`, or `::before`; those belong to the glaze definitions in `doop-theme.css`. A new app page outside those roots does not need the sizing pass, and should not borrow an existing page class only to obtain it.

Within those scopes, primary text buttons use 9px 16px padding, 14px / 20px text, a fully rounded radius, and a minimum height of 40px. Hover brightens the glaze and must keep the gradient and sheen layer. Icon sizes come from the primitive's `size` API; do not apply text-action padding to square icon buttons. Touch-facing custom controls should provide at least a 44px target or equivalent surrounding target space.

```tsx
// Example: inside an existing dashboard panel or .doop-modal.
import { Button } from "@/components/ui/button";
import { Reply } from "lucide-react";

export function ReplyAction({
  onReply,
  busy = false,
}: {
  onReply: () => void;
  busy?: boolean;
}) {
  return (
    <Button type="button" onClick={onReply} disabled={busy}>
      <Reply aria-hidden="true" />
      {busy ? "Preparing reply…" : "Reply"}
    </Button>
  );
}
```

Name icon-only controls with `aria-label` and provide a tooltip when the meaning is not obvious. Decorative icons use `aria-hidden="true"`. Keep disabled, loading, keyboard focus, and destructive states visible. Do not add fixed heights that reproduce the cropped-button defect, and do not strip the glaze `::before` sheen layer from primary actions.

### Inputs and forms

Reuse `Input`, `Textarea`, `Label`, and `Switch`. Associate every field with a visible label; placeholders are hints, not labels. Inputs use the input/border roles and the shared ring on focus. Mark errors with `aria-invalid`, connect the error text with `aria-describedby`, and keep the user's input when a request fails. Preserve multiline composition and IME behavior in mail and assistant inputs.

### Dialogs, menus, and tooltips

Use the local Dialog, DropdownMenu, and Tooltip primitives. They integrate the existing focus, keyboard, portal, and animation behavior. Reuse `.doop-modal` for app dialogs where appropriate. Provide a title, an accessible close control, Escape handling, and focus return to the trigger. Avoid hand-built click-outside layers or additional scroll locks. Keep long content scrollable without moving persistent action controls over it.

### Navigation and lists

Keep Ask AI, theme switching, and Account discoverable in the dashboard toolbar. Account exposes Landing page and Log out; the landing link uses `/?landing=1` to avoid the authenticated `/` redirect. Reuse `ROUTES` for named app routes where applicable.

Use real buttons for selecting rows and links for navigation. Show active state with `aria-current` or the appropriate selection semantics as well as visual styling. Mail lists default to newest received first; priority is metadata, not a replacement for chronological order. Do not hide actions so completely that only hover or a keyboard shortcut reveals them.

### Mail, assistant, and feedback

Reuse [EmailMessage](./corsair-email/src/components/email-message.tsx) to choose HTML when available and readable paragraphs for plain mail. HTML bodies use the sandboxed iframe renderer in [workspace-shell.tsx](./corsair-email/src/components/workspace-shell.tsx); never inject untrusted email HTML into the app DOM or enable scripts in that frame.

Keep draft and proposal content editable before approval. Preserve the assistant's separate scroll-follow behavior: it follows new content only while the reader is at the bottom and offers “Jump to latest” otherwise. Use existing Sonner/toast feedback for transient outcomes and inline messages for errors that need action or persistent context. Do not claim an action succeeded until its request succeeds.

### Stylesheet ownership and validation

Root imports run through `globals.css`, `doop-theme.css`, `doop-source.css`, `doop-public-fidelity.css`, and `app-controls.css`; component CSS adds surface-specific rules. Import order alone does not resolve specificity. Inspect computed styles when a utility appears ineffective.

Do not edit generated `doop-source.css`, `ai-welcome.css`, or `ai-chat.css` as the permanent fix. Follow the source-regeneration guide or place a deliberate override in the owning maintained stylesheet. Keep landing changes in landing styles, workspace layout changes in dashboard styles, and shared app-action changes in `app-controls.css`. Avoid fixing the same defect with another unrelated override in each component.

Run from `corsair-email`:

```bash
npm run typecheck
npm test
npm run build
```

For relevant UI changes, start the appropriate server and run the focused browser checks:

| Script | Checks / setup |
| --- | --- |
| `BASE_URL=http://localhost:3103 node scripts/verify-hero-performance.mjs` | Landing worker rendering, animation, scrolling, both themes, mobile, reduced motion, and fallback; works against a production server |
| `node scripts/check-app-controls.mjs` | App buttons and Lenis behavior; expects a dev server on port 3101 with `DOOP_VISUAL_REVIEW=1` |
| `node scripts/audit-glaze-buttons.mjs` | Every visible button in every design-review scenario, both themes, desktop and mobile, plus menus, assistant history and approval states; fails if a glaze button loses its paint or `app-controls.css` changes it |
| `node scripts/check-dashboard-controls.mjs` | AI scrolling, theme and account controls; expects a dev server on port 3100 with `DOOP_VISUAL_REVIEW=1` |

The design-review route is disabled in production. Before handoff, also check keyboard focus, long labels, long subjects, empty/error states, and narrow layouts in the surface you changed. These checks do not certify live Gmail delivery, OAuth, or calendar writes.

## Do's and Don'ts

**Do:** reuse semantic tokens and existing primitives; keep the two surface styles distinct; support both themes; let content determine control height; preserve keyboard access, visible focus, and user approval; keep expensive decoration away from the scrolling thread.

**Don't:** copy raw palette values into new components; flatten or repaint dashboard glaze buttons from per-page overrides; add component-specific theme stores or root smooth-scroll instances; invent another modal system; assume a screenshot or a passing build proves every UI state; change a shared token without checking its consumers.
