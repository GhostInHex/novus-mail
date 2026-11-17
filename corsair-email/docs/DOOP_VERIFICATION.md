# Wonder Import functional verification

Historical functional evidence only. This report does not establish visual parity. See [the current visual comparison](DOOP_VISUAL_VERIFICATION.md) for pixel results and approved historical replacements.

Verified 2026-11-17 against [the Doop canvas](https://doop.design/c/CCwouJnWg1).

90 distinct frames checked: 54 screen artboards (including both landing copies) and 36 component reference artboards. Each has a pinned, expanded HTML source, a successful source render with decoded images, an implementation owner, and a successful runtime visibility/geometry check. Shared component frames are verified in their application context, not mounted as static HTML.

The panel suite captures 50 desktop states across light/dark modes and checks eight mobile overlays. The landing suite checks desktop/mobile in both modes, decoded images, theme persistence, reduced motion, and navigation. The workspace/recovery/dashboard suites exercise navigation, reply/compose, retained input after failures, duplicate submission prevention, event validation, proposal editing and explicit approval, triage thread navigation, chat history, retry/stop, month/day/week selection, slot presets, and collapsed navigation. Browser page errors fail these suites.

24 source-to-application style comparisons additionally check the selected source nodes’ typography, color, spacing, keycap surfaces, and borders in both themes. These are property checks, not a claim of pixel-identical screenshots.

The completion pass also restores collapsed folder navigation, imports light and dark assistant styles independently, corrects missing dark button-token mappings, matches the source inset surface for keycaps, fixes legacy triage rows to stay horizontal, and resumes chat following when a new message is submitted so errors and retry controls remain visible. Panel checks assert row direction and the retry control’s viewport visibility.

## Adaptations and verification limits

- Older component and overlay artboards contain an earlier workspace shell. Their functions are implemented through the shared, newer Glaze workspace so navigation, inbox, calendars, and overlays stay consistent. No old “Visual runway” workspace is reintroduced.
- The collapsed workspace sidebar is restored as an 88px rail. Collapsed agenda, month calendar, selected-day agenda, and both theme variants are implemented. Mobile uses the folder drawer.
- The two ASCII landing pairs are distinct design revisions; the older pair is superseded by the newer Glaze implementation. Runtime names, dates, counts, messages, history, permissions, and provider availability replace static examples. The sign-in sample email is represented by a real development login form when enabled; Google controls reflect configuration.
- Demo calendar dates now follow the current day. Existing persisted demo data may require resetting or reseeding to refresh old dates.
- UI tests use the demo workspace and mocked assistant/write responses. Live Google OAuth, actual Gmail delivery, external Calendar writes, and a live AI provider were not verified. Local PostgreSQL is unavailable; demo fallback is exercised.

## Reproduce

Run the dev server with the assistant enabled for UI fixtures, then run the complete verification command from `corsair-email`:

```sh
AI_BASE_URL=http://127.0.0.1:3110/v1 AI_API_KEY=local-ui-verification AI_MODEL=ui-verification npm run dev -- --port 3100
# In a second terminal:
npm run verify:doop
```

`BASE_URL` selects another running port; `CHROME_PATH` selects a browser binary. Source rendering, screenshots, measured boxes, source hashes, and the combined per-frame JSON are written to the ignored `artifacts/doop-audit` directory. Regenerate source-derived CSS with `npm run import:doop` after updating the pinned sources.

## Every frame

| Source frame | Theme | Implementation | Runtime check | Result |
| --- | --- | --- | --- | --- |
| [Wonder Control Icon 01](../design/doop/screens/KQ2QL9fN6G.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Workspace Chrome 02](../design/doop/screens/E4uQEofvBY.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Content Group 03](../design/doop/screens/EHLIj7GCWF.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Workspace Chrome 04](../design/doop/screens/U9tSwmBOFw.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Result List 05](../design/doop/screens/YriNRuWAiE.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Result List 06](../design/doop/screens/mH9XSP8Vc2.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Content Group 07](../design/doop/screens/V8oQbRN-kS.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Content Group 08](../design/doop/screens/NkoO8bJPas.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Result List 09](../design/doop/screens/5zVyAsnSVT.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Result List 10](../design/doop/screens/kBq-btjTou.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Content Group 11](../design/doop/screens/1HcV-g1M87.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Content Group 12](../design/doop/screens/oPuNfPv4-p.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Event List 13](../design/doop/screens/iFOD9sPBOE.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Event List 14](../design/doop/screens/lN6igAHg_l.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Message Reader 15](../design/doop/screens/Y0YEjRMXbN.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Message Reader 16](../design/doop/screens/DgLN0mt_iq.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Content Group 17](../design/doop/screens/-oNU9dmO3d.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Content Group 18](../design/doop/screens/kRZIhG0yNj.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Inbox Queue 19](../design/doop/screens/8DkHOg6fOw.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Inbox Queue 20](../design/doop/screens/81zdy1ibrN.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Content Group 21](../design/doop/screens/DNatiIOIJA.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | selected-day (shared component) | Pass |
| [Wonder Content Group 22](../design/doop/screens/izcknoTRCZ.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | selected-day (shared component) | Pass |
| [Wonder Content Group 23](../design/doop/screens/DDnR4XXa0W.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | selected-day (shared component) | Pass |
| [Wonder Content Group 24](../design/doop/screens/hd5kVrGWnf.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | selected-day (shared component) | Pass |
| [Wonder Feature Card 25](../design/doop/screens/AaTdOIyfpr.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Feature Card 26](../design/doop/screens/sgVslF5Ytn.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Content Group 27](../design/doop/screens/ug8bJlR2hC.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Content Group 28](../design/doop/screens/RM9QhxqVMF.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Agenda Sidebar 29](../design/doop/screens/l5yehTWbwJ.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Agenda Sidebar 30](../design/doop/screens/9M9Kqau-Kj.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Content Group 31](../design/doop/screens/LYhg7oMwg8.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Content Group 32](../design/doop/screens/TIxI33oJXt.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Workspace Sidebar 33](../design/doop/screens/naws-4elLa.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Workspace Sidebar 34](../design/doop/screens/_OixdI-QtO.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Workspace Background 35](../design/doop/screens/jfCTSRLNzb.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [Wonder Workspace Background 36](../design/doop/screens/ISz1kpo5xJ.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox (shared component) | Pass |
| [AI Welcome Light](../design/doop/screens/sa5ThibhQK.html) | light | [ai-welcome.tsx](../src/components/doop/ai-welcome.tsx) | assistant-welcome | Pass |
| [Sign In Glaze Light](../design/doop/screens/T-RWCDO3pN.html) | light | [auth-landing.tsx](../src/components/auth-landing.tsx) | sign-in | Pass |
| [Sign In Glaze Dark](../design/doop/screens/zR46pVQtqo.html) | dark | [auth-landing.tsx](../src/components/auth-landing.tsx) | sign-in | Pass |
| [Connect Glaze Light](../design/doop/screens/r5LPleAiTI.html) | light | [connect-state.tsx](../src/components/connect-state.tsx) | connect | Pass |
| [Connect Glaze Dark](../design/doop/screens/lyGlR1B5Jp.html) | dark | [connect-state.tsx](../src/components/connect-state.tsx) | connect | Pass |
| [Inbox Glaze Light](../design/doop/screens/nwOnX0aVws.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox | Pass |
| [Inbox Glaze Dark](../design/doop/screens/LwTPn9MJXU.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | inbox | Pass |
| [Calendar Glaze Light](../design/doop/screens/0t83YzC7LR.html) | light | [workspace-week-view.tsx](../src/components/workspace-week-view.tsx) | week | Pass |
| [Calendar Glaze Dark](../design/doop/screens/TvnvIbjgPo.html) | dark | [workspace-week-view.tsx](../src/components/workspace-week-view.tsx) | week | Pass |
| [Compose Glaze Light](../design/doop/screens/pFxVhCB3hp.html) | light | [compose-sheet.tsx](../src/components/compose-sheet.tsx) | compose | Pass |
| [Compose Glaze Dark](../design/doop/screens/LBIBo1A_05.html) | dark | [compose-sheet.tsx](../src/components/compose-sheet.tsx) | compose | Pass |
| [Privacy Glaze Light](../design/doop/screens/eCb9kLXTFL.html) | light | [page.tsx](../src/app/privacy/page.tsx) | privacy | Pass |
| [Privacy Glaze Dark](../design/doop/screens/0SudpaDmVv.html) | dark | [page.tsx](../src/app/privacy/page.tsx) | privacy | Pass |
| [Terms Glaze Light](../design/doop/screens/fCM2-TkoZ0.html) | light | [page.tsx](../src/app/terms/page.tsx) | terms | Pass |
| [Terms Glaze Dark](../design/doop/screens/jX9CyhpLJ6.html) | dark | [page.tsx](../src/app/terms/page.tsx) | terms | Pass |
| [AI Welcome Dark](../design/doop/screens/0XY1pUt-1N.html) | dark | [ai-welcome.tsx](../src/components/doop/ai-welcome.tsx) | assistant-welcome | Pass |
| [Inbox Triage Light](../design/doop/screens/7UrvprmbYh.html) | light | [agent-triage-card.tsx](../src/components/agent-triage-card.tsx) | triage | Pass |
| [Inbox Triage Dark](../design/doop/screens/FTTOWatj_1.html) | dark | [agent-triage-card.tsx](../src/components/agent-triage-card.tsx) | triage | Pass |
| [Agent Tool Activity Light](../design/doop/screens/cjGprHE6RY.html) | light | [ai-tool-activity.tsx](../src/components/doop/ai-tool-activity.tsx) | tool-activity | Pass |
| [Agent Tool Activity Dark](../design/doop/screens/ym378pucpg.html) | dark | [ai-tool-activity.tsx](../src/components/doop/ai-tool-activity.tsx) | tool-activity | Pass |
| [AI Reply Drafts Light](../design/doop/screens/ZSbzsMIJ4h.html) | light | [ai-artifact.tsx](../src/components/doop/ai-artifact.tsx) | draft | Pass |
| [AI Reply Drafts Dark](../design/doop/screens/VpyKBw3wII.html) | dark | [ai-artifact.tsx](../src/components/doop/ai-artifact.tsx) | draft | Pass |
| [AI Draft Editing Light](../design/doop/screens/SzcEnf0kqE.html) | light | [ai-artifact.tsx](../src/components/doop/ai-artifact.tsx) | draft-edit | Pass |
| [AI Draft Editing Dark](../design/doop/screens/4v_Ti7qdBW.html) | dark | [ai-artifact.tsx](../src/components/doop/ai-artifact.tsx) | draft-edit | Pass |
| [AI Meeting Proposal Light](../design/doop/screens/LUWKnWZ_6a.html) | light | [ai-artifact.tsx](../src/components/doop/ai-artifact.tsx) | event-proposal | Pass |
| [AI Meeting Proposal Dark](../design/doop/screens/GIruPrcKHT.html) | dark | [ai-artifact.tsx](../src/components/doop/ai-artifact.tsx) | event-proposal | Pass |
| [AI Event Editing Light](../design/doop/screens/4fMsvY3d68.html) | light | [ai-artifact.tsx](../src/components/doop/ai-artifact.tsx) | event-edit | Pass |
| [AI Event Editing Dark](../design/doop/screens/PnZr5lx_Eb.html) | dark | [ai-artifact.tsx](../src/components/doop/ai-artifact.tsx) | event-edit | Pass |
| [AI Chat History Light](../design/doop/screens/X2_Tw5d1xp.html) | light | [ai-history.tsx](../src/components/doop/ai-history.tsx) | history | Pass |
| [AI Chat History Dark](../design/doop/screens/-mFeSQC-5B.html) | dark | [ai-history.tsx](../src/components/doop/ai-history.tsx) | history | Pass |
| [Auto Approval Confirmation Light](../design/doop/screens/vRcbwVedSZ.html) | light | [ai-approval.tsx](../src/components/doop/ai-approval.tsx) | approval | Pass |
| [Auto Approval Confirmation Dark](../design/doop/screens/2q7WkAoRlR.html) | dark | [ai-approval.tsx](../src/components/doop/ai-approval.tsx) | approval | Pass |
| [AI Retry State Light](../design/doop/screens/hyytQwDO0u.html) | light | [agent-panel.tsx](../src/components/agent-panel.tsx) | retry | Pass |
| [AI Retry State Dark](../design/doop/screens/oMakIN6tI8.html) | dark | [agent-panel.tsx](../src/components/agent-panel.tsx) | retry | Pass |
| [Collapsed Workspace Sidebar Light](../design/doop/screens/-Kq47IpKPV.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | collapsed-sidebar | Pass |
| [Collapsed Workspace Sidebar Dark](../design/doop/screens/GcrkggAb2V.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | collapsed-sidebar | Pass |
| [Collapsed Agenda Panel Light](../design/doop/screens/rhPj4u5YGM.html) | light | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | collapsed-agenda | Pass |
| [Collapsed Agenda Panel Dark](../design/doop/screens/8bFi-1WqDJ.html) | dark | [dashboard-view.tsx](../src/components/dashboard/dashboard-view.tsx) | collapsed-agenda | Pass |
| [Expanded Month Calendar Light](../design/doop/screens/CvD8KzS38m.html) | light | [workspace-week-view.tsx](../src/components/workspace-week-view.tsx) | month | Pass |
| [Expanded Month Calendar Dark](../design/doop/screens/qWTFqZ5lwm.html) | dark | [workspace-week-view.tsx](../src/components/workspace-week-view.tsx) | month | Pass |
| [Selected Day Agenda Light](../design/doop/screens/wqqrTTPdTo.html) | light | [workspace-week-view.tsx](../src/components/workspace-week-view.tsx) | selected-day | Pass |
| [Selected Day Agenda Dark](../design/doop/screens/8KlwJCCU9M.html) | dark | [workspace-week-view.tsx](../src/components/workspace-week-view.tsx) | selected-day | Pass |
| [New Event Form Light](../design/doop/screens/X7gRb7Zpcd.html) | light | [event-sheet.tsx](../src/components/event-sheet.tsx) | event | Pass |
| [New Event Form Dark](../design/doop/screens/F5ItS-WXTF.html) | dark | [event-sheet.tsx](../src/components/event-sheet.tsx) | event | Pass |
| [Command Console Light](../design/doop/screens/fB_ybTJvyK.html) | light | [command-palette.tsx](../src/components/command-palette.tsx) | command | Pass |
| [Command Console Dark](../design/doop/screens/L5Eac6sbE4.html) | dark | [command-palette.tsx](../src/components/command-palette.tsx) | command | Pass |
| [Keyboard Shortcuts Light](../design/doop/screens/OwcxrkwgPj.html) | light | [keyboard-shortcuts.tsx](../src/components/keyboard-shortcuts.tsx) | shortcuts | Pass |
| [Keyboard Shortcuts Dark](../design/doop/screens/GYUpO9Oksq.html) | dark | [keyboard-shortcuts.tsx](../src/components/keyboard-shortcuts.tsx) | shortcuts | Pass |
| [Action Success Feedback Light](../design/doop/screens/hamBycIX0J.html) | light | [theme-provider.tsx](../src/components/theme-provider.tsx) | success | Pass |
| [Action Success Feedback Dark](../design/doop/screens/fHmzhyiS-n.html) | dark | [theme-provider.tsx](../src/components/theme-provider.tsx) | success | Pass |
| [NovusMail / light / ASCII source](../design/doop/screens/StnxuxcdNT.html) | light | [landing-page.tsx](../src/components/landing/landing-page.tsx) | landing | Pass |
| [NovusMail / dark / ASCII source](../design/doop/screens/tZpJbgGcF5.html) | dark | [landing-page.tsx](../src/components/landing/landing-page.tsx) | landing | Pass |
| [NovusMail / light / ASCII source](../design/doop/screens/eXLag7TsWm.html) | light | [landing-page.tsx](../src/components/landing/landing-page.tsx) | landing | Pass |
| [NovusMail / dark / ASCII source](../design/doop/screens/9QIQzqwAWN.html) | dark | [landing-page.tsx](../src/components/landing/landing-page.tsx) | landing | Pass |
