# Wonder Import sources

Source: [NovusMail · Wonder Import](https://doop.design/c/CCwouJnWg1).

All **90 frames** are pinned as expanded HTML in `screens/`: 36 component references and 54 screen artboards, including both copies of the ASCII landing pair. `canvas.json` preserves frame identities, dimensions, update times, tokens, and component ownership. `components.json` retains the original library definitions. These files are design sources; they are not injected into the running application.

`coverage.json` maps every frame to its React implementation, theme, scenario, and runtime selector. The [visual report](../../docs/DOOP_VISUAL_VERIFICATION.md) classifies all 90 frames and links reference/native/difference screenshots. The [functional report](../../docs/DOOP_VERIFICATION.md) records earlier runtime checks. Older component/overlay references use the shared newer Glaze workspace instead of duplicating an obsolete workspace shell. The 88px collapsed navigation state is supported again.

## Source-derived styles

Run `npm run import:doop` from `corsair-email` to regenerate:

- `src/app/doop-source.css`: selected inbox, connection, event, and shortcut properties from both theme sources.
- `src/components/doop/ai-welcome.css`: welcome content, suggestions, and assistant title from both sources.
- `src/components/doop/ai-chat.css`: messages, tool activity, proposals, editors, history, retry, approval, suggestions, and composer from both sources.
- `style-checks.json`: expected computed properties for the workspace style comparisons.

`scripts/doop-source.mjs` owns the shared mapping from source tokens to application tokens, including the dark graphite button and inset shell surface. Each generated rule identifies its source frame and selector. `chat-adaptations.css` adds semantic controls, focus states, scrolling, and responsive behavior. `ai-welcome.html` is retained as the original welcome import for provenance; regeneration now uses the current light/dark pair in `screens/`.

The React components keep the existing state and API flows. Text, messages, proposals, dates, counts, saved chat history, and provider availability come from runtime data. The assistant supports proposal editing, explicit confirmation, retry/stop, history, IME input, and multiline composition. Source plus icons remain decorative because attachments are not supported by the API. License attribution remains in `src/components/doop/LICENSE`.

## Verification

With the local server running and its assistant UI enabled, run `npm run verify:doop`. This renders each source and decodes its images, checks every frame's runtime counterpart, verifies selected source properties in both themes, and runs the panel, landing, workspace, dashboard, and recovery suites. Artifacts and combined JSON evidence are written under the ignored root `artifacts/doop-audit` directory. `BASE_URL` and `CHROME_PATH` override the server and browser locations.

External mail, calendar, and assistant responses are mocked in UI tests. The report does not certify live Google OAuth, Gmail delivery, Calendar writes, AI provider availability, or pixel identity with static sample content.

For pixel comparisons, start the development server with `DOOP_VISUAL_REVIEW=1`, then run `BASE_URL=http://localhost:3100 DOOP_STRICT=1 npm run verify:visual` followed by `npm run report:visual`. The native review route is disabled in production. The visual report distinguishes the 44 current targets from 46 historical references; functional checks alone do not establish pixel parity.
