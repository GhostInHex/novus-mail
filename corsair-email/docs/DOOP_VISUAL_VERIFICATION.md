# Doop visual verification

Generated 2026-11-17T14:38:32.663Z from the canonical [comparison results](../design/doop/visual-results.json).

**All 44 active targets have an exact comparison result.** This is a controlled visual proof for the agreed scope and rendering conditions below.

## Agreed scope

The chosen product baseline is the newer Glaze workspace throughout. Overlay foregrounds must match their authored Doop foregrounds. Older workspace backgrounds are deliberately replaced; they are not counted as matching full frames.

| Classification | Frames | Compared area |
| --- | ---: | --- |
| Active canonical pages/workspace | 16 | Entire frame, unmasked |
| Active overlays and success feedback | 28 | Entire isolated foreground and its source placement |
| Historical component references | 36 | Superseded by the shared Glaze implementation |
| Older workspace layouts | 8 | Superseded by the newer Glaze layout |
| Older landing variants | 2 | Superseded by the latest Glaze/Geist landing pair |

The older landing frames `eXLag7TsWm` and `9QIQzqwAWN` are not identical copies of the current pair. They use Inter, older flat controls, and the older dark palette. Their screenshots are retained without claiming parity.

## What an exact result means

- Zero differing RGB pixels in the compared image, equal image dimensions, no browser page errors, and HTTP 200 for the native review page. No RGB tolerance or percentage threshold is accepted.
- Full-frame comparisons keep the entire authored screenshot. Foreground comparisons place both actual foregrounds on the same neutral backdrop, retaining their original content, styles, border boxes, and geometry. No foreground pixels are masked. Isolated screenshots capture the full document at the authored viewport so viewport scrollbars cannot cover the foreground. The raw full-frame differences remain available and are expected to show the approved background replacement.
- Overlay and feedback placement is checked independently against the source boxes at the comparator’s 0.001 CSS-pixel precision. Each feedback card is compared independently. The earlier rounded-corner masked `region` result is diagnostic only and cannot establish foreground parity.
- Browser conditions are Chromium, device scale 1, the authored viewport size, en-US, UTC, fixed reference dates, loaded fonts/images, source-matched fixture data, and reduced motion. Screenshots compare the real React components; source HTML is rendered only as the reference. The review route is disabled in production.
- Reduced-motion landing captures use the authored illustration/photo posters. They prove that stable state; they do not prove frame-by-frame equality of the live animation. Normal animation and interactive behavior require separate functional checks.

## Source provenance

The [reference manifest](../../artifacts/doop-visual/reference/manifest.json) identifies origins and SHA-256 hashes for every image and its pinned HTML. Current evidence contains 15 official Doop PNGs and 75 pinned-source HTML renders. The Doop image endpoint returned HTTP 429 after 15 downloads; remaining references use the unchanged expanded HTML rendered at the authored dimensions. They are not described as official PNG downloads.

An independent public-surface audit separately found 10 canonical full-frame exact matches in [its own captures](../../artifacts/doop-visual/public-final/results.json). This supplemental audit does not replace missing or stale canonical results in the counts above.

## Reproduce

From `corsair-email`, start a local review server and run the comparison in a second terminal:

```sh
DOOP_VISUAL_REVIEW=1 AI_BASE_URL=http://127.0.0.1:3110/v1 AI_API_KEY=local-ui-verification AI_MODEL=ui-verification npm run dev -- --port 3100
# In a second terminal:
node scripts/verify-doop-sources.mjs
node scripts/capture-doop-references.mjs
DOOP_STRICT=1 node scripts/compare-doop-visual.mjs
node scripts/write-doop-visual-report.mjs
```

`BASE_URL` and `CHROME_PATH` override the server and browser. `DOOP_FRAMES` creates a diagnostic subset in `partial-results.json`; the report deliberately reads only the complete `results.json`. The [interactive report](../../artifacts/doop-visual/report.html) includes every reference/native/diff and filters for theme, scope, and result.

These checks use deterministic UI fixtures and mocked assistant/write responses. They do not certify live Google OAuth, Gmail delivery, external Calendar writes, a live AI provider, or a deployed application.

## Every source frame

| Frame | Theme | Classification | Result | Differing compared pixels |
| --- | --- | --- | --- | ---: |
| [Wonder Control Icon 01](https://doop.design/c/CCwouJnWg1?frame=KQ2QL9fN6G) | light | Historical component reference | Superseded | — |
| [Wonder Workspace Chrome 02](https://doop.design/c/CCwouJnWg1?frame=E4uQEofvBY) | light | Historical component reference | Superseded | — |
| [Wonder Content Group 03](https://doop.design/c/CCwouJnWg1?frame=EHLIj7GCWF) | light | Historical component reference | Superseded | — |
| [Wonder Workspace Chrome 04](https://doop.design/c/CCwouJnWg1?frame=U9tSwmBOFw) | dark | Historical component reference | Superseded | — |
| [Wonder Result List 05](https://doop.design/c/CCwouJnWg1?frame=YriNRuWAiE) | light | Historical component reference | Superseded | — |
| [Wonder Result List 06](https://doop.design/c/CCwouJnWg1?frame=mH9XSP8Vc2) | dark | Historical component reference | Superseded | — |
| [Wonder Content Group 07](https://doop.design/c/CCwouJnWg1?frame=V8oQbRN-kS) | light | Historical component reference | Superseded | — |
| [Wonder Content Group 08](https://doop.design/c/CCwouJnWg1?frame=NkoO8bJPas) | dark | Historical component reference | Superseded | — |
| [Wonder Result List 09](https://doop.design/c/CCwouJnWg1?frame=5zVyAsnSVT) | light | Historical component reference | Superseded | — |
| [Wonder Result List 10](https://doop.design/c/CCwouJnWg1?frame=kBq-btjTou) | dark | Historical component reference | Superseded | — |
| [Wonder Content Group 11](https://doop.design/c/CCwouJnWg1?frame=1HcV-g1M87) | light | Historical component reference | Superseded | — |
| [Wonder Content Group 12](https://doop.design/c/CCwouJnWg1?frame=oPuNfPv4-p) | dark | Historical component reference | Superseded | — |
| [Wonder Event List 13](https://doop.design/c/CCwouJnWg1?frame=iFOD9sPBOE) | light | Historical component reference | Superseded | — |
| [Wonder Event List 14](https://doop.design/c/CCwouJnWg1?frame=lN6igAHg_l) | dark | Historical component reference | Superseded | — |
| [Wonder Message Reader 15](https://doop.design/c/CCwouJnWg1?frame=Y0YEjRMXbN) | light | Historical component reference | Superseded | — |
| [Wonder Message Reader 16](https://doop.design/c/CCwouJnWg1?frame=DgLN0mt_iq) | dark | Historical component reference | Superseded | — |
| [Wonder Content Group 17](https://doop.design/c/CCwouJnWg1?frame=-oNU9dmO3d) | light | Historical component reference | Superseded | — |
| [Wonder Content Group 18](https://doop.design/c/CCwouJnWg1?frame=kRZIhG0yNj) | dark | Historical component reference | Superseded | — |
| [Wonder Inbox Queue 19](https://doop.design/c/CCwouJnWg1?frame=8DkHOg6fOw) | light | Historical component reference | Superseded | — |
| [Wonder Inbox Queue 20](https://doop.design/c/CCwouJnWg1?frame=81zdy1ibrN) | dark | Historical component reference | Superseded | — |
| [Wonder Content Group 21](https://doop.design/c/CCwouJnWg1?frame=DNatiIOIJA) | light | Historical component reference | Superseded | — |
| [Wonder Content Group 22](https://doop.design/c/CCwouJnWg1?frame=izcknoTRCZ) | dark | Historical component reference | Superseded | — |
| [Wonder Content Group 23](https://doop.design/c/CCwouJnWg1?frame=DDnR4XXa0W) | light | Historical component reference | Superseded | — |
| [Wonder Content Group 24](https://doop.design/c/CCwouJnWg1?frame=hd5kVrGWnf) | dark | Historical component reference | Superseded | — |
| [Wonder Feature Card 25](https://doop.design/c/CCwouJnWg1?frame=AaTdOIyfpr) | light | Historical component reference | Superseded | — |
| [Wonder Feature Card 26](https://doop.design/c/CCwouJnWg1?frame=sgVslF5Ytn) | dark | Historical component reference | Superseded | — |
| [Wonder Content Group 27](https://doop.design/c/CCwouJnWg1?frame=ug8bJlR2hC) | light | Historical component reference | Superseded | — |
| [Wonder Content Group 28](https://doop.design/c/CCwouJnWg1?frame=RM9QhxqVMF) | dark | Historical component reference | Superseded | — |
| [Wonder Agenda Sidebar 29](https://doop.design/c/CCwouJnWg1?frame=l5yehTWbwJ) | light | Historical component reference | Superseded | — |
| [Wonder Agenda Sidebar 30](https://doop.design/c/CCwouJnWg1?frame=9M9Kqau-Kj) | dark | Historical component reference | Superseded | — |
| [Wonder Content Group 31](https://doop.design/c/CCwouJnWg1?frame=LYhg7oMwg8) | light | Historical component reference | Superseded | — |
| [Wonder Content Group 32](https://doop.design/c/CCwouJnWg1?frame=TIxI33oJXt) | dark | Historical component reference | Superseded | — |
| [Wonder Workspace Sidebar 33](https://doop.design/c/CCwouJnWg1?frame=naws-4elLa) | light | Historical component reference | Superseded | — |
| [Wonder Workspace Sidebar 34](https://doop.design/c/CCwouJnWg1?frame=_OixdI-QtO) | dark | Historical component reference | Superseded | — |
| [Wonder Workspace Background 35](https://doop.design/c/CCwouJnWg1?frame=jfCTSRLNzb) | light | Historical component reference | Superseded | — |
| [Wonder Workspace Background 36](https://doop.design/c/CCwouJnWg1?frame=ISz1kpo5xJ) | dark | Historical component reference | Superseded | — |
| [AI Welcome Light](https://doop.design/c/CCwouJnWg1?frame=sa5ThibhQK) | light | Overlay foreground | Exact | 0 |
| [Sign In Glaze Light](https://doop.design/c/CCwouJnWg1?frame=T-RWCDO3pN) | light | Full frame | Exact | 0 |
| [Sign In Glaze Dark](https://doop.design/c/CCwouJnWg1?frame=zR46pVQtqo) | dark | Full frame | Exact | 0 |
| [Connect Glaze Light](https://doop.design/c/CCwouJnWg1?frame=r5LPleAiTI) | light | Full frame | Exact | 0 |
| [Connect Glaze Dark](https://doop.design/c/CCwouJnWg1?frame=lyGlR1B5Jp) | dark | Full frame | Exact | 0 |
| [Inbox Glaze Light](https://doop.design/c/CCwouJnWg1?frame=nwOnX0aVws) | light | Full frame | Exact | 0 |
| [Inbox Glaze Dark](https://doop.design/c/CCwouJnWg1?frame=LwTPn9MJXU) | dark | Full frame | Exact | 0 |
| [Calendar Glaze Light](https://doop.design/c/CCwouJnWg1?frame=0t83YzC7LR) | light | Full frame | Exact | 0 |
| [Calendar Glaze Dark](https://doop.design/c/CCwouJnWg1?frame=TvnvIbjgPo) | dark | Full frame | Exact | 0 |
| [Compose Glaze Light](https://doop.design/c/CCwouJnWg1?frame=pFxVhCB3hp) | light | Full frame | Exact | 0 |
| [Compose Glaze Dark](https://doop.design/c/CCwouJnWg1?frame=LBIBo1A_05) | dark | Full frame | Exact | 0 |
| [Privacy Glaze Light](https://doop.design/c/CCwouJnWg1?frame=eCb9kLXTFL) | light | Full frame | Exact | 0 |
| [Privacy Glaze Dark](https://doop.design/c/CCwouJnWg1?frame=0SudpaDmVv) | dark | Full frame | Exact | 0 |
| [Terms Glaze Light](https://doop.design/c/CCwouJnWg1?frame=fCM2-TkoZ0) | light | Full frame | Exact | 0 |
| [Terms Glaze Dark](https://doop.design/c/CCwouJnWg1?frame=jX9CyhpLJ6) | dark | Full frame | Exact | 0 |
| [AI Welcome Dark](https://doop.design/c/CCwouJnWg1?frame=0XY1pUt-1N) | dark | Overlay foreground | Exact | 0 |
| [Inbox Triage Light](https://doop.design/c/CCwouJnWg1?frame=7UrvprmbYh) | light | Overlay foreground | Exact | 0 |
| [Inbox Triage Dark](https://doop.design/c/CCwouJnWg1?frame=FTTOWatj_1) | dark | Overlay foreground | Exact | 0 |
| [Agent Tool Activity Light](https://doop.design/c/CCwouJnWg1?frame=cjGprHE6RY) | light | Overlay foreground | Exact | 0 |
| [Agent Tool Activity Dark](https://doop.design/c/CCwouJnWg1?frame=ym378pucpg) | dark | Overlay foreground | Exact | 0 |
| [AI Reply Drafts Light](https://doop.design/c/CCwouJnWg1?frame=ZSbzsMIJ4h) | light | Overlay foreground | Exact | 0 |
| [AI Reply Drafts Dark](https://doop.design/c/CCwouJnWg1?frame=VpyKBw3wII) | dark | Overlay foreground | Exact | 0 |
| [AI Draft Editing Light](https://doop.design/c/CCwouJnWg1?frame=SzcEnf0kqE) | light | Overlay foreground | Exact | 0 |
| [AI Draft Editing Dark](https://doop.design/c/CCwouJnWg1?frame=4v_Ti7qdBW) | dark | Overlay foreground | Exact | 0 |
| [AI Meeting Proposal Light](https://doop.design/c/CCwouJnWg1?frame=LUWKnWZ_6a) | light | Overlay foreground | Exact | 0 |
| [AI Meeting Proposal Dark](https://doop.design/c/CCwouJnWg1?frame=GIruPrcKHT) | dark | Overlay foreground | Exact | 0 |
| [AI Event Editing Light](https://doop.design/c/CCwouJnWg1?frame=4fMsvY3d68) | light | Overlay foreground | Exact | 0 |
| [AI Event Editing Dark](https://doop.design/c/CCwouJnWg1?frame=PnZr5lx_Eb) | dark | Overlay foreground | Exact | 0 |
| [AI Chat History Light](https://doop.design/c/CCwouJnWg1?frame=X2_Tw5d1xp) | light | Overlay foreground | Exact | 0 |
| [AI Chat History Dark](https://doop.design/c/CCwouJnWg1?frame=-mFeSQC-5B) | dark | Overlay foreground | Exact | 0 |
| [Auto Approval Confirmation Light](https://doop.design/c/CCwouJnWg1?frame=vRcbwVedSZ) | light | Overlay foreground | Exact | 0 |
| [Auto Approval Confirmation Dark](https://doop.design/c/CCwouJnWg1?frame=2q7WkAoRlR) | dark | Overlay foreground | Exact | 0 |
| [AI Retry State Light](https://doop.design/c/CCwouJnWg1?frame=hyytQwDO0u) | light | Overlay foreground | Exact | 0 |
| [AI Retry State Dark](https://doop.design/c/CCwouJnWg1?frame=oMakIN6tI8) | dark | Overlay foreground | Exact | 0 |
| [Collapsed Workspace Sidebar Light](https://doop.design/c/CCwouJnWg1?frame=-Kq47IpKPV) | light | Older workspace layout | Superseded | — |
| [Collapsed Workspace Sidebar Dark](https://doop.design/c/CCwouJnWg1?frame=GcrkggAb2V) | dark | Older workspace layout | Superseded | — |
| [Collapsed Agenda Panel Light](https://doop.design/c/CCwouJnWg1?frame=rhPj4u5YGM) | light | Older workspace layout | Superseded | — |
| [Collapsed Agenda Panel Dark](https://doop.design/c/CCwouJnWg1?frame=8bFi-1WqDJ) | dark | Older workspace layout | Superseded | — |
| [Expanded Month Calendar Light](https://doop.design/c/CCwouJnWg1?frame=CvD8KzS38m) | light | Older workspace layout | Superseded | — |
| [Expanded Month Calendar Dark](https://doop.design/c/CCwouJnWg1?frame=qWTFqZ5lwm) | dark | Older workspace layout | Superseded | — |
| [Selected Day Agenda Light](https://doop.design/c/CCwouJnWg1?frame=wqqrTTPdTo) | light | Older workspace layout | Superseded | — |
| [Selected Day Agenda Dark](https://doop.design/c/CCwouJnWg1?frame=8KlwJCCU9M) | dark | Older workspace layout | Superseded | — |
| [New Event Form Light](https://doop.design/c/CCwouJnWg1?frame=X7gRb7Zpcd) | light | Overlay foreground | Exact | 0 |
| [New Event Form Dark](https://doop.design/c/CCwouJnWg1?frame=F5ItS-WXTF) | dark | Overlay foreground | Exact | 0 |
| [Command Console Light](https://doop.design/c/CCwouJnWg1?frame=fB_ybTJvyK) | light | Overlay foreground | Exact | 0 |
| [Command Console Dark](https://doop.design/c/CCwouJnWg1?frame=L5Eac6sbE4) | dark | Overlay foreground | Exact | 0 |
| [Keyboard Shortcuts Light](https://doop.design/c/CCwouJnWg1?frame=OwcxrkwgPj) | light | Overlay foreground | Exact | 0 |
| [Keyboard Shortcuts Dark](https://doop.design/c/CCwouJnWg1?frame=GYUpO9Oksq) | dark | Overlay foreground | Exact | 0 |
| [Action Success Feedback Light](https://doop.design/c/CCwouJnWg1?frame=hamBycIX0J) | light | Feedback foreground | Exact | 0 |
| [Action Success Feedback Dark](https://doop.design/c/CCwouJnWg1?frame=fHmzhyiS-n) | dark | Feedback foreground | Exact | 0 |
| [NovusMail / light / ASCII source](https://doop.design/c/CCwouJnWg1?frame=StnxuxcdNT) | light | Full frame | Exact | 0 |
| [NovusMail / dark / ASCII source](https://doop.design/c/CCwouJnWg1?frame=tZpJbgGcF5) | dark | Full frame | Exact | 0 |
| [NovusMail / light / ASCII source](https://doop.design/c/CCwouJnWg1?frame=eXLag7TsWm) | light | Older landing variant | Superseded | — |
| [NovusMail / dark / ASCII source](https://doop.design/c/CCwouJnWg1?frame=9QIQzqwAWN) | dark | Older landing variant | Superseded | — |

The committed [reference manifest](../design/doop/visual-reference-manifest.json) preserves image origins and hashes. PNGs and the interactive HTML report are local generated artifacts; regenerate them with the commands above.
