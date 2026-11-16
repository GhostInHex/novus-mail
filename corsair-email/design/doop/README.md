# Doop component sources

Source: https://doop.design/c/CCwouJnWg1

`components.json` contains all 36 library definitions read from Doop, including exact templates, CSS, revisions, and instance usage. These are reference sources, not bundled static mock data.

`ai-welcome.html` is the current AI Welcome Light frame read directly from Doop. Run `node scripts/import-doop-welcome.mjs` from corsair-email to regenerate the welcome CSS. The React component preserves the source layout and routes suggestion selection through the existing agent request handler. Source light palette roles map to the application's theme tokens so the same component supports dark mode. Keyboard focus, disabled state, and semantic controls are added.

## Component coverage

| Doop definitions | Application surface |
| --- | --- |
| Control Icon 01 | Lucide control icons |
| Workspace Chrome 02/04; Content Group 03 | Dashboard header |
| Content Group 07/08 | Empty structural groups |
| Result List 05/06 | Folder navigation |
| Result List 09/10 | Inbox rows |
| Content Group 11/12; Message Reader 15/16 | Thread reader |
| Event List 13/14 | Calendar event rows |
| Content Group 17/18; Inbox Queue 19/20 | Inbox queue header |
| Content Group 21/22/23/24; Feature Card 25/26 | Selected-day agenda |
| Content Group 27/28; Agenda Sidebar 29/30 | Calendar panel |
| Content Group 31/32; Workspace Sidebar 33/34 | Workspace navigation |
| Workspace Background 35/36 | Older workspace composition |

These mappings identify implementation ownership; they do not certify identical markup or pixels. Several library definitions retain the older workspace composition. The existing dashboard uses the newer Inbox/Calendar Glaze screens, as recorded in docs/DOOP_AUDIT.md. Replacing it with those older static subtrees would regress the working dashboard.

## AI chat import

AI chat itself is inline in the screen frames, rather than a named library component. `src/components/doop/ai-welcome.tsx` and its generated CSS import the welcome layout, title, description, suggestion rows, and assistant title styling. Messages, email/event proposals and their editors, tool activity, history, approval, suggestions, and composer now use the Doop components in src/components/doop. Existing state, API handlers, streaming, history persistence, and explicit action approval remain connected. The scrolling behavior is adapted from the MIT-licensed implementation, with attribution retained in src/components/doop/LICENSE. The unused SmoothUI presentation components were removed.

Local `.env` and `.env.local` were copied from the master checkout, remain ignored, and must never be added to this source directory.


## Complete assistant source conversion

Twenty current assistant artboards (ten states, each light/dark) are pinned under `screens/`. `node scripts/import-doop-chat.mjs` extracts declarations from named source nodes for message bubbles, activity, cards, proposal title/status/actions/fields, history rows/details, composer, suggestions, retry, and approval. Each generated CSS rule records its frame ID and source selector. `chat-adaptations.css` contains semantic-control, focus, resizing, and mobile constraints needed to make static artboards interactive.

The user-message and proposal contents are live data, not the artboards' example text. History timestamps and message counts come from saved conversations. The composer supports IME composition, multiline input, resizing, explicit send, and stop. Source plus and arrow icons are preserved; the plus is decorative because attachments are not supported by the API.

Validation: typecheck, eight unit tests, production build, the workspace behavior suite, and 46 light/dark panel captures passed during this conversion. UI suites use mocked assistant/write responses and do not send live email or create live Google events. Passing these checks proves the implemented flows and geometry checks; it is not a claim that every app pixel equals a static reference with different content.
