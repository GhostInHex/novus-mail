# Doop fidelity audit — 16 November 2026

The application is **not completely pixel-identical** to every Doop artboard. This audit compared the 52 screen sources on [the NovusMail canvas](https://doop.design/c/CCwouJnWg1), including their light/dark pairs, with the implementation. Shared components were checked through the screens that use them. It does not assign an invented fidelity percentage.

## Reference conflicts and deliberate differences

- The Inbox, Calendar, and Compose Glaze artboards use the newer 200px folder sidebar and quieter workspace. Many assistant, modal, and collapsed-state artboards still contain the older 240px workspace, card queue, and “Visual runway” background. The application keeps the newer workspace consistently and follows each overlay's own design. Reintroducing the old background would undo the requested legacy UI removal.
- The desktop collapsed sidebar has been removed, as authorized. The full folder sidebar stays visible; Calendar is a separate workspace view. Mobile uses a folder drawer. The collapsed-sidebar artboards are therefore intentionally superseded.
- Month and week are full calendar views. Selecting a day opens its detailed agenda beside the month grid, following the Selected Day composition with the newer workspace chrome.
- Sign-in reflects the configured authentication methods. An unavailable Google connection is disabled and local access stays in a development disclosure. The static demo email field is not reproduced as a nonfunctional input.
- The Google connection card follows the source geometry. Its primary button connects the next missing provider because the existing backend authorizes Gmail and Calendar separately.
- Real names, messages, dates, counts, provider labels, available actions, errors, and chat history replace the design's fixed examples. Native date/time inputs follow the browser locale. Long content scrolls inside bounded dialogs; mobile layouts are adaptations because these references are desktop artboards.
- Tool activity uses actual streamed tool labels and animated running/completed states. It does not invent the source's example checklist or progress text before the backend emits it.

## Corrections made

The previous implementation was not a complete source match. This pass removed the desktop collapse code and saved collapse preference, moved the month calendar out of the narrow agenda, and corrected the following:

- Event form: 760px dialog, top offset, divided header/footer, input heights, field spacing, and sage confirmation.
- Command console: 760px dialog, bordered search field, command rows, navigation hint, and context footer.
- Shortcuts: 740px dialog with aligned rows, individual platform-aware keycaps, subtle separators, and an Escape footer; one column on mobile.
- Assistant: 780px dialog, separate permission row, source welcome copy, full-width suggestion rows, and compact prompt composer.
- Auto-approval: an inline warning inside the assistant instead of a second modal. Explicit choice remains required.
- Email/event proposals: source card spacing, status, editing fields, complete event location/description, and confirmation labels. SmoothUI artifacts and Animate UI collapsibles remain in use.
- History and retry: source-style history rows, retained input, retry and edit-message actions.
- Triage: a validated structured tool-result event now renders the grouped card. Clicking a result opens its real thread. Results remain available in saved chats.
- Connection: 480px card with flat provider-status rows, a primary connection action, and the review note.
- Privacy/terms: 760px reading column, 40px title, source spacing, and typography.
- Feedback: themed Sonner notifications include the message subject and a working “View sent mail” action.

Chat scrolling stops when interacting with content, and interactive proposal arrival uses immediate scrolling. The assistant's extra button translation was removed to prevent clicks missing moving action targets. SmoothUI/Animate UI transitions and reduced-motion support remain.

## Screen coverage

| Screen family      | Dark / light source IDs     | Outcome                                                                          |
| ------------------ | --------------------------- | -------------------------------------------------------------------------------- |
| Landing            | `tZpJbgGcF5` / `StnxuxcdNT` | ASCII animation and dissolve retained; light/dark/mobile regression passed.      |
| Sign-in            | `zR46pVQtqo` / `T-RWCDO3pN` | Source card styling; environment-dependent controls differ as described above.   |
| Connect            | `lyGlR1B5Jp` / `r5LPleAiTI` | Card and rows corrected; next-provider action retained.                          |
| Inbox/reader       | `LwTPn9MJXU` / `nwOnX0aVws` | New Glaze layout retained; live mail replaces sample content.                    |
| Calendar week      | `TvnvIbjgPo` / `0t83YzC7LR` | Bordered week grid, navigation, and working time-slot presets.                   |
| Compose            | `LBIBo1A_05` / `pFxVhCB3hp` | Inline compose and assistant; send/draft failure retention preserved.            |
| Privacy            | `0SudpaDmVv` / `eCb9kLXTFL` | Reading width and type corrected.                                                |
| Terms              | `jX9CyhpLJ6` / `fCM2-TkoZ0` | Reading width and type corrected.                                                |
| Assistant welcome  | `0XY1pUt-1N` / `sa5ThibhQK` | Window, permission row, welcome, suggestions, and prompt corrected.              |
| Inbox triage       | `FTTOWatj_1` / `7UrvprmbYh` | Structured grouped results connected to real tool output and thread navigation.  |
| Tool activity      | `ym378pucpg` / `cjGprHE6RY` | Runtime adaptation; actual tool activity replaces static example steps.          |
| Reply drafts       | `VpyKBw3wII` / `ZSbzsMIJ4h` | Proposal styling and explicit confirmation corrected.                            |
| Draft editing      | `4v_Ti7qdBW` / `SzcEnf0kqE` | Editable fields and “Done editing” action verified.                              |
| Meeting proposal   | `GIruPrcKHT` / `LUWKnWZ_6a` | Event details and confirmation styling corrected.                                |
| Event editing      | `PnZr5lx_Eb` / `4fMsvY3d68` | Local date/time fields and proposal editing verified.                            |
| Chat history       | `-mFeSQC-5B` / `X2_Tw5d1xp` | Grouped saved-chat rows; source examples replaced by actual saved conversations. |
| Auto-approval      | `2q7WkAoRlR` / `vRcbwVedSZ` | Inline warning and explicit choice; no nested modal.                             |
| Retry              | `oMakIN6tI8` / `hyytQwDO0u` | Error card, retained message, retry, edit, and stop behavior verified.           |
| Collapsed sidebar  | `GcrkggAb2V` / `-Kq47IpKPV` | Intentionally removed.                                                           |
| Collapsed agenda   | `8bFi-1WqDJ` / `rhPj4u5YGM` | 64px agenda rail with an accessible expansion control.                           |
| Expanded month     | `qWTFqZ5lwm` / `CvD8KzS38m` | Full-size month view; no narrow sidebar calendar.                                |
| Selected day       | `8KlwJCCU9M` / `wqqrTTPdTo` | Detailed selected-day agenda and upcoming events beside the month grid.          |
| Event form         | `F5ItS-WXTF` / `X7gRb7Zpcd` | Width, placement, spacing, and validation verified.                              |
| Command console    | `L5Eac6sbE4` / `fB_ybTJvyK` | Width, placement, search, rows, and keyboard behavior verified.                  |
| Keyboard shortcuts | `GYUpO9Oksq` / `OwcxrkwgPj` | Width, placement, rows, and mobile bounds verified.                              |
| Action feedback    | `fHmzhyiS-n` / `hamBycIX0J` | Themed notification, subject, and sent-mail navigation verified.                 |

## Verification and limits

`npm run verify:panels` captures 46 desktop screen states across both themes, checks dialog widths/placement and editing, and checks eight mobile overlays for viewport bounds and horizontal overflow. The connection screen is rendered from the actual component with a disconnected-provider fixture; it does not claim to verify OAuth.

`verify:workspace` uses normal motion and covers navigation, command search, form errors, duplicate submission prevention, proposal editing and confirmation, auto-approval choice, history, retry, stop, and mobile compose. `verify:dashboard` checks the fixed sidebar, month/day selection, inline compose, time-slot presets, reduced-motion visibility, and mobile queue/reader. `verify:landing` checks both themes at desktop/mobile sizes and image loading.

Browser evidence is stored under the ignored worktree `artifacts/doop-audit` directory, including `results.json`, screenshots, the 52 source HTML documents, and a source inventory. These are review evidence, not production routes or bundled assets.

Assistant and write responses are mocked during UI verification. Live OAuth, Gmail delivery, Calendar writes, and a live AI provider are not verified because PostgreSQL and live credentials are unavailable. This audit does not certify screenshot identity, live backend availability, or a deployed application.
