# Doop Next.js implementation

The implementation lives in `corsair-email` on branch `feat/doop-nextjs-implementation`, based on the freshly fetched `origin/master` commit `4e4a1902`.

## Design sources

The [NovusMail Doop canvas](https://doop.design/c/CCwouJnWg1) is the visual source. The supplied `novusmail-nextjs` project provided the ASCII mountain animation, image dissolve treatment, and landscape assets. The landing implementation retains these effects and uses the Doop typography, colors, Glaze buttons, sage actions, and light/dark variants.

| Area | Doop frame | Implementation |
| --- | --- | --- |
| Landing, dark | `tZpJbgGcF5` | `src/components/landing/landing-page.tsx` |
| Landing, light | `StnxuxcdNT` | Same component with light tokens |
| Sign-in | `zR46pVQtqo`, `T-RWCDO3pN` | `/start`, `auth-landing.tsx` |
| Google connection | `lyGlR1B5Jp`, `r5LPleAiTI` | `/connect`, `connect-state.tsx` |
| Inbox and reader | `LwTPn9MJXU`, `nwOnX0aVws` | `workspace-shell.tsx` |
| Calendar week | `TvnvIbjgPo`, `0t83YzC7LR` | `workspace-week-view.tsx` |
| Agenda, expanded month, selected day | `qWTFqZ5lwm`, `8KlwJCCU9M` | `workspace-calendar-panel.tsx` |
| Compose and reply | `LBIBo1A_05`, `pFxVhCB3hp` | `compose-sheet.tsx` |
| Assistant welcome and proposals | `0XY1pUt-1N`, `VpyKBw3wII`, `GIruPrcKHT` | `agent-panel.tsx` |
| Event form | `F5ItS-WXTF` | `event-sheet.tsx` |
| Command console | `L5Eac6sbE4` | `command-palette.tsx` |
| Privacy and terms | `0SudpaDmVv`, `jX9CyhpLJ6` | `/privacy`, `/terms` |

Content comes from the existing application data. Missing Google configuration disables Google sign-in; local development access stays in a disclosure. Gmail and Calendar have separate OAuth actions because the existing backend authorizes them separately. Smaller layouts adapt the desktop frames with horizontal folder navigation and a full-width thread reader.

## Component integration

SmoothUI components were obtained from its official registry and are vendored under `src/components/smoothui`. The original component behavior and animations remain. The integration uses conversation scrolling, messages, suggestions, tool activity, artifacts, approval, prompt input, and loading states. The upstream MIT license is included alongside the source.

Animate UI is installed as `@animate-ui/react`. Its actual primitives power the sidebar, collapsibles, calendar tabs, dialogs, switches, menus, and tooltips. `src/app/doop-theme.css` applies the shared Doop styling. Motion respects the operating system's reduced-motion preference. Theme persistence uses `next-themes`; completion feedback uses Sonner, and the command picker uses cmdk.

## Behavior

- Compose, draft-save, and event forms keep user input after failed requests.
- Pending submissions reject duplicate clicks. Event end times must be later than start times.
- Event editing converts timestamps to the user's local time before displaying them.
- Assistant proposals support editing, explicit approval, dismissal, and collapsed subsequent proposals.
- Auto-approval starts off and requires confirmation before enabling it for the current session.
- Assistant requests can be stopped and retried. Chat history remains on the current browser.
- Existing Gmail, Calendar, search, command, and session endpoints remain connected to the UI.

## Verification

From `corsair-email`:

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

Browser checks use Playwright with an installed Chrome and a development server on port 3100:

```powershell
npm run dev -- --port 3100
npm run verify:landing
```

The workspace check needs the assistant UI enabled. In a separate verification terminal, start the development server with these local-only settings before running the workspace check in another terminal:

```powershell
$env:AI_BASE_URL = 'http://127.0.0.1:3110/v1'
$env:AI_API_KEY = 'local-ui-verification'
$env:AI_MODEL = 'ui-verification'
npm run dev -- --port 3100
```

```powershell
npm run verify:workspace
```

These checks mock assistant responses and successful write responses. They test failed requests, duplicate submission protection, retained input, explicit approval, draft editing, retry/stop, keyboard command selection, calendar navigation, mobile overflow, theme persistence, image loading, and reduced motion. Screenshots are written to the worktree's `artifacts` directory.

Live Google OAuth, email delivery, Calendar writes, and AI provider responses were not verified. This worktree has no running Postgres service or configured live credentials. The production build was checked with temporary build-only environment values, without deploying or changing any remote service.

## Landscape image compression

All eight landscape assets use lossless WebP at their original dimensions. The decoded RGBA pixels were compared byte-for-byte against their PNG sources and are identical. The image set decreased from 17,480,842 bytes to 11,104,986 bytes, a 36.5% reduction. The PNG originals remain in Git history and the supplied source project.
