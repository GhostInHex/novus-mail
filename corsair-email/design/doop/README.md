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

AI chat itself is inline in the screen frames, rather than a named library component. `src/components/doop/ai-welcome.tsx` and its generated CSS import the welcome layout, title, description, suggestion rows, and assistant title styling. Conversation streaming, tools, proposals, history, and composer continue to use their existing functional React components. Those remaining components have not been replaced one to one by this import.

Local `.env` and `.env.local` were copied from the master checkout, remain ignored, and must never be added to this source directory.
