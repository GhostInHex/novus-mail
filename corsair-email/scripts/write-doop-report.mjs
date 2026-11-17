import fs from "node:fs/promises";
import { coverage } from "./doop-coverage.mjs";
const root = "../artifacts/doop-audit";
const sources = JSON.parse(
  await fs.readFile(`${root}/source-results.json`, "utf8"),
);
const runtime = [
  ...JSON.parse(await fs.readFile(`${root}/frame-results.json`, "utf8")),
  ...JSON.parse(
    await fs.readFile(`${root}/landing-frame-results.json`, "utf8"),
  ),
];
const checks = JSON.parse(
  await fs.readFile("design/doop/style-checks.json", "utf8"),
);
const results = coverage.map((entry) => {
  const source = sources.find((r) => r.frame === entry.frame);
  const live = runtime.find((r) => r.frame === entry.frame);
  if (source?.status !== "passed" || live?.status !== "passed")
    throw Error(`Unchecked frame: ${entry.frame} ${entry.name}`);
  if (source.metrics.images.some((i) => !i.loaded))
    throw Error(`Unloaded source image: ${entry.frame}`);
  return { ...entry, source, runtime: live };
});
if (new Set(results.map((r) => r.frame)).size !== 90)
  throw Error("Expected 90 distinct source frames");
await fs.writeFile(`${root}/all-frames.json`, JSON.stringify(results, null, 2));
const lines = [
  "# Wonder Import functional verification",
  "",
  "Historical functional evidence only. This report does not establish visual parity. See [the current visual comparison](DOOP_VISUAL_VERIFICATION.md) for pixel results and approved historical replacements.",
  "",
  `Verified ${new Date().toISOString().slice(0, 10)} against [the Doop canvas](https://doop.design/c/CCwouJnWg1).`,
  "",
  `${results.length} distinct frames checked: ${results.filter((r) => r.kind === "screen").length} screen artboards (including both landing copies) and ${results.filter((r) => r.kind === "component").length} component reference artboards. Each has a pinned, expanded HTML source, a successful source render with decoded images, an implementation owner, and a successful runtime visibility/geometry check. Shared component frames are verified in their application context, not mounted as static HTML.`,
  "",
  "The panel suite captures 50 desktop states across light/dark modes and checks eight mobile overlays. The landing suite checks desktop/mobile in both modes, decoded images, theme persistence, reduced motion, and navigation. The workspace/recovery/dashboard suites exercise navigation, reply/compose, retained input after failures, duplicate submission prevention, event validation, proposal editing and explicit approval, triage thread navigation, chat history, retry/stop, month/day/week selection, slot presets, and collapsed navigation. Browser page errors fail these suites.",
  "",
  `${checks.length} source-to-application style comparisons additionally check the selected source nodes’ typography, color, spacing, keycap surfaces, and borders in both themes. These are property checks, not a claim of pixel-identical screenshots.`,
  "",
  "The completion pass also restores collapsed folder navigation, imports light and dark assistant styles independently, corrects missing dark button-token mappings, matches the source inset surface for keycaps, fixes legacy triage rows to stay horizontal, and resumes chat following when a new message is submitted so errors and retry controls remain visible. Panel checks assert row direction and the retry control’s viewport visibility.",
  "",
  "## Adaptations and verification limits",
  "",
  "- Older component and overlay artboards contain an earlier workspace shell. Their functions are implemented through the shared, newer Glaze workspace so navigation, inbox, calendars, and overlays stay consistent. No old “Visual runway” workspace is reintroduced.",
  "- The collapsed workspace sidebar is restored as an 88px rail. Collapsed agenda, month calendar, selected-day agenda, and both theme variants are implemented. Mobile uses the folder drawer.",
  "- The two ASCII landing pairs are distinct design revisions; the older pair is superseded by the newer Glaze implementation. Runtime names, dates, counts, messages, history, permissions, and provider availability replace static examples. The sign-in sample email is represented by a real development login form when enabled; Google controls reflect configuration.",
  "- Demo calendar dates now follow the current day. Existing persisted demo data may require resetting or reseeding to refresh old dates.",
  "- UI tests use the demo workspace and mocked assistant/write responses. Live Google OAuth, actual Gmail delivery, external Calendar writes, and a live AI provider were not verified. Local PostgreSQL is unavailable; demo fallback is exercised.",
  "",
  "## Reproduce",
  "",
  "Run the dev server with the assistant enabled for UI fixtures, then run the complete verification command from `corsair-email`:",
  "",
  "```sh",
  "AI_BASE_URL=http://127.0.0.1:3110/v1 AI_API_KEY=local-ui-verification AI_MODEL=ui-verification npm run dev -- --port 3100",
  "# In a second terminal:",
  "npm run verify:doop",
  "```",
  "",
  "`BASE_URL` selects another running port; `CHROME_PATH` selects a browser binary. Source rendering, screenshots, measured boxes, source hashes, and the combined per-frame JSON are written to the ignored `artifacts/doop-audit` directory. Regenerate source-derived CSS with `npm run import:doop` after updating the pinned sources.",
  "",
  "## Every frame",
  "",
  "| Source frame | Theme | Implementation | Runtime check | Result |",
  "| --- | --- | --- | --- | --- |",
  ...results.map(
    (r) =>
      `| [${r.name}](../design/doop/screens/${r.frame}.html) | ${r.theme} | [${r.implementation.split("/").at(-1)}](../${r.implementation}) | ${r.scenario}${r.kind === "component" ? " (shared component)" : ""} | Pass |`,
  ),
  "",
];
await fs.writeFile("docs/DOOP_VERIFICATION.md", lines.join("\n"));
console.log(
  `PASS ${results.length}/${coverage.length} frames have source and runtime evidence`,
);
