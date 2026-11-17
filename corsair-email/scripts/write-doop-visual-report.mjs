import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("..", import.meta.url));
const artifacts = path.resolve(project, "../artifacts/doop-visual");
const readJson = async (file, fallback) => {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
};
const [canvas, coverage, captures, provenance, publicAudit] = await Promise.all([
  readJson(path.join(project, "design/doop/canvas.json")),
  readJson(path.join(project, "design/doop/coverage.json")),
  readJson(path.join(artifacts, "results.json"), []),
  readJson(path.join(artifacts, "reference/manifest.json"), []),
  readJson(path.join(artifacts, "public-final/results.json"), []),
]);
const sourceById = new Map(provenance.map(item => [item.frame, item]));
const coverageById = new Map(coverage.map(item => [item.frame, item]));
const captureById = new Map(captures.map(item => [item.frame, item]));
if (captureById.size !== captures.length) throw Error("Duplicate frame IDs in canonical results.json");
const oldLandings = new Set(["eXLag7TsWm", "9QIQzqwAWN"]);
const oldWorkspace = new Set(["collapsed-sidebar", "collapsed-agenda", "month", "selected-day"]);
const overlays = new Set(["assistant-welcome", "triage", "tool-activity", "draft", "draft-edit", "event-proposal", "event-edit", "history", "approval", "retry", "event", "command", "shortcuts"]);
const scopeFor = (frame, owner) => oldLandings.has(frame.id)
  ? { active: false, scope: "historical-landing", label: "Older landing variant" }
  : owner.kind === "component"
    ? { active: false, scope: "historical-component", label: "Historical component reference" }
    : oldWorkspace.has(owner.scenario)
      ? { active: false, scope: "canonical-layout-replacement", label: "Older workspace layout" }
      : overlays.has(owner.scenario)
        ? { active: true, scope: "overlay-foreground", label: "Overlay foreground" }
        : owner.scenario === "success"
          ? { active: true, scope: "feedback-foreground", label: "Feedback foreground" }
          : { active: true, scope: "full-frame", label: "Full frame" };
const dimensionsMatch = metric => !metric?.referenceSize || !metric?.nativeSize
  || (metric.referenceSize.width === metric.nativeSize.width && metric.referenceSize.height === metric.nativeSize.height);
const pixelExact = metric => metric?.exactMatch === true && metric.differentPixels === 0 && dimensionsMatch(metric);
const rows = canvas.frames.map(frame => {
  const owner = coverageById.get(frame.id);
  if (!owner) throw Error(`Missing implementation ownership for ${frame.id}`);
  const classification = scopeFor(frame, owner);
  const capture = captureById.get(frame.id);
  let metric, status, issue;
  if (!classification.active) status = "superseded";
  else if (!capture) { status = "not-captured"; issue = "No canonical capture in results.json."; }
  else if (capture.error || capture.status === "error" || capture.errors?.length) {
    status = "error"; issue = capture.error || capture.errors.join("\n");
  } else {
    metric = classification.scope === "full-frame" ? capture.fullFrame
      : classification.scope === "overlay-foreground" ? capture.isolatedForeground
        : capture.foreground;
    const currentMethod = classification.scope === "full-frame" || (classification.scope === "overlay-foreground"
      ? Boolean(capture.isolatedForeground && capture.isolatedForeground.placementMatches !== undefined)
      : Boolean(capture.foreground && capture.feedbackCards?.length === 2));
    if (!currentMethod || !metric) { status = "needs-current-capture"; issue = "This record predates the current unmasked foreground comparison method."; }
    else {
      const placement = classification.scope === "full-frame" || (classification.scope === "overlay-foreground"
        ? metric.placementMatches === true
        : capture.feedbackCards.every(card => card.placementMatches === true && pixelExact(card)));
      status = pixelExact(metric) && placement ? "exact" : "mismatch";
      if (!placement) issue = "Foreground placement or size differs from the source.";
    }
  }
  const origin = sourceById.get(frame.id);
  const sourceHashMatches = Boolean(origin?.sourceSha256 && capture?.sourceSha256 && origin.sourceSha256 === capture.sourceSha256);
  if (classification.active && capture && !sourceHashMatches) {
    status = "needs-current-capture";
    issue = "Reference provenance is missing or the source hashes differ. Regenerate the reference and native comparison.";
  }
  const pairs = classification.scope === "overlay-foreground" && capture?.isolatedForeground ? [{ title: "Isolated foreground", reference: capture.isolatedForeground.reference, native: capture.isolatedForeground.native, diff: capture.isolatedForeground.diff }]
    : classification.scope === "feedback-foreground" && capture?.feedbackCards?.length ? capture.feedbackCards.map(card => ({ title: card.title, reference: card.reference, native: card.native, diff: card.diff }))
      : [{ title: classification.active ? "Entire frame" : "Historical reference and current Glaze implementation", reference: `reference/${frame.id}.png`, native: capture?.native, diff: capture?.fullDiff }];
  return {
    id: frame.id, name: frame.name, theme: owner.theme, scenario: owner.scenario,
    width: frame.width, height: frame.height, ...classification, status,
    differentPixels: metric?.differentPixels ?? null, comparedPixels: metric?.comparedPixels ?? null,
    sourceUpdatedAt: frame.updatedAt, sourceOrigin: origin?.origin || "not-recorded",
    sourceSha256: origin?.sourceSha256 || capture?.sourceSha256 || null,
    imageSha256: origin?.sha256 || null, sourceHashMatches,
    implementation: owner.implementation, issue: issue || null,
    referenceBox: capture?.referenceBox || null, nativeBox: capture?.nativeBox || null,
    feedbackCards: capture?.feedbackCards || [], pairs,
    fullReference: `reference/${frame.id}.png`, fullNative: capture?.native, fullDiff: capture?.fullDiff,
    historicalCaptureError: !classification.active ? capture?.error || capture?.errors?.join("\n") || null : null,
  };
});
const active = rows.filter(row => row.active);
const superseded = rows.filter(row => !row.active);
if (rows.length !== 90 || active.length !== 44 || superseded.length !== 46
  || active.filter(row => row.scope === "full-frame").length !== 16
  || active.filter(row => row.scope !== "full-frame").length !== 28) throw Error("Unexpected source/scope inventory; review scope before publishing this report.");
const exact = active.filter(row => row.status === "exact");
const open = active.filter(row => row.status !== "exact");
const allExact = exact.length === 44;
const official = provenance.filter(row => row.origin === "official-doop-render").length;
const generatedAt = new Date().toISOString();
const publicSupplement = publicAudit.filter(row => !oldLandings.has(row.id) && row.exactMatch && row.differentPixels === 0 && !row.errors?.length);
const summary = { generatedAt, completeVisualMatchProven: allExact, sourceFrames: rows.length, activeFrames: active.length, fullFrameTargets: 16, foregroundTargets: 28, exactActiveFrames: exact.length, remainingActiveFrames: open.length, supersededFrames: superseded.length, officialReferenceImages: official, pinnedHtmlReferenceImages: provenance.filter(row => row.origin === "pinned-source-html-render").length, rows };
await fs.mkdir(artifacts, { recursive: true });
await fs.writeFile(path.join(artifacts, "visual-report.json"), JSON.stringify(summary, null, 2) + "\n");
const mdLabel = row => row.status === "superseded" ? "Superseded" : row.status === "exact" ? "Exact" : row.status === "mismatch" ? "Mismatch" : row.status === "error" ? "Capture error" : row.status === "needs-current-capture" ? "Needs current capture" : "Not captured";
const doc = [
  "# Doop visual verification", "",
  `Generated ${generatedAt} from the canonical [comparison results](../../artifacts/doop-visual/results.json).`, "",
  allExact
    ? "**All 44 active targets have an exact comparison result.** This is a controlled visual proof for the agreed scope and rendering conditions below."
    : `**Complete visual matching is not yet proven.** ${exact.length} of 44 active targets currently have exact evidence; ${open.length} still have mismatches, errors, missing captures, or an older comparison method.`, "",
  "## Agreed scope", "",
  "The chosen product baseline is the newer Glaze workspace throughout. Overlay foregrounds must match their authored Doop foregrounds. Older workspace backgrounds are deliberately replaced; they are not counted as matching full frames.", "",
  "| Classification | Frames | Compared area |", "| --- | ---: | --- |",
  "| Active canonical pages/workspace | 16 | Entire frame, unmasked |",
  "| Active overlays and success feedback | 28 | Entire isolated foreground and its source placement |",
  "| Historical component references | 36 | Superseded by the shared Glaze implementation |",
  "| Older workspace layouts | 8 | Superseded by the newer Glaze layout |",
  "| Older landing variants | 2 | Superseded by the latest Glaze/Geist landing pair |", "",
  "The older landing frames `eXLag7TsWm` and `9QIQzqwAWN` are not identical copies of the current pair. They use Inter, older flat controls, and the older dark palette. Their screenshots are retained without claiming parity.", "",
  "## What an exact result means", "",
  "- Zero differing RGB pixels in the compared image, equal image dimensions, no browser page errors, and HTTP 200 for the native review page. No RGB tolerance or percentage threshold is accepted.",
  "- Full-frame comparisons keep the entire authored screenshot. Foreground comparisons place both actual foregrounds on the same neutral backdrop, retaining their original content, styles, border boxes, and geometry. No foreground pixels are masked. Isolated screenshots capture the full document at the authored viewport so viewport scrollbars cannot cover the foreground. The raw full-frame differences remain available and are expected to show the approved background replacement.",
  "- Overlay and feedback placement is checked independently against the source boxes at the comparator’s 0.001 CSS-pixel precision. Each feedback card is compared independently. The earlier rounded-corner masked `region` result is diagnostic only and cannot establish foreground parity.",
  "- Browser conditions are Chromium, device scale 1, the authored viewport size, en-US, UTC, fixed reference dates, loaded fonts/images, source-matched fixture data, and reduced motion. Screenshots compare the real React components; source HTML is rendered only as the reference. The review route is disabled in production.",
  "- Reduced-motion landing captures use the authored illustration/photo posters. They prove that stable state; they do not prove frame-by-frame equality of the live animation. Normal animation and interactive behavior require separate functional checks.", "",
  "## Source provenance", "",
  `The [reference manifest](../../artifacts/doop-visual/reference/manifest.json) identifies origins and SHA-256 hashes for every image and its pinned HTML. Current evidence contains ${official} official Doop PNGs and ${summary.pinnedHtmlReferenceImages} pinned-source HTML renders. The Doop image endpoint returned HTTP 429 after 15 downloads; remaining references use the unchanged expanded HTML rendered at the authored dimensions. They are not described as official PNG downloads.`, "",
  `An independent public-surface audit separately found ${publicSupplement.length} canonical full-frame exact matches in [its own captures](../../artifacts/doop-visual/public-final/results.json). This supplemental audit does not replace missing or stale canonical results in the counts above.`, "",
  "## Reproduce", "",
  "From `corsair-email`, start a local review server and run the comparison in a second terminal:", "",
  "```sh",
  "DOOP_VISUAL_REVIEW=1 AI_BASE_URL=http://127.0.0.1:3110/v1 AI_API_KEY=local-ui-verification AI_MODEL=ui-verification npm run dev -- --port 3100",
  "# In a second terminal:",
  "node scripts/verify-doop-sources.mjs",
  "node scripts/capture-doop-references.mjs",
  "DOOP_STRICT=1 node scripts/compare-doop-visual.mjs",
  "node scripts/write-doop-visual-report.mjs",
  "```", "",
  "`BASE_URL` and `CHROME_PATH` override the server and browser. `DOOP_FRAMES` creates a diagnostic subset in `partial-results.json`; the report deliberately reads only the complete `results.json`. The [interactive report](../../artifacts/doop-visual/report.html) includes every reference/native/diff and filters for theme, scope, and result.", "",
  "These checks use deterministic UI fixtures and mocked assistant/write responses. They do not certify live Google OAuth, Gmail delivery, external Calendar writes, a live AI provider, or a deployed application.", "",
  "## Every source frame", "",
  "| Frame | Theme | Classification | Result | Differing compared pixels |", "| --- | --- | --- | --- | ---: |",
  ...rows.map(row => `| [${row.name}](https://doop.design/c/CCwouJnWg1?frame=${row.id}) | ${row.theme} | ${row.label} | ${mdLabel(row)} | ${row.differentPixels === null ? "—" : row.differentPixels.toLocaleString("en-US")} |`), "",
];
await fs.writeFile(path.join(project, "docs/DOOP_VISUAL_VERIFICATION.md"), doc.join("\n"));
const escapeHtml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const data = JSON.stringify(summary).replaceAll("<", "\\u003c");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Doop visual verification</title><style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#111315;color:#eceeef}*{box-sizing:border-box}body{margin:0}header,main{max-width:1500px;margin:auto;padding:24px}h1{font-size:28px;margin:0 0 12px}h2{font-size:21px;margin:0 0 8px}p{line-height:1.5;max-width:1050px}a{color:#9ddfc3}button,input,select{font:inherit;color:inherit;background:#21262a;border:1px solid #59636b;border-radius:6px;padding:8px}button{cursor:pointer}button:disabled{opacity:.4;cursor:default}.summary{display:flex;gap:12px;flex-wrap:wrap}.summary p{padding:12px 16px;border:1px solid #454e55;border-radius:8px;margin:0}.summary strong{font-size:25px}.bar{display:flex;height:18px;background:#283039;border-radius:6px;overflow:hidden;margin:16px 0}.bar span:first-child{background:#72b89b}.bar span:nth-child(2){background:#e39a65}.filters{position:sticky;top:0;z-index:10;background:#111315f5;display:flex;gap:8px;flex-wrap:wrap;padding:12px 0;border-block:1px solid #454e55}.filters input{min-width:220px;flex:1}.layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:20px;margin-top:20px}.frame-list{max-height:75vh;overflow:auto;display:flex;flex-direction:column;gap:5px}.frame-list button{padding:10px;text-align:left;display:block}.frame-list button[aria-current=true]{border-color:#91dfbb;background:#244236}.frame-list small{display:block;color:#b4bec5;margin-top:4px}.badge{display:inline-block;padding:4px 7px;border-radius:5px;background:#35404a;font-size:13px}.badge.exact{background:#20543d}.badge.mismatch,.badge.error{background:#713b34}.detail{min-width:0}.images{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0 20px}.images figure{margin:0;min-width:0}.images figcaption{padding:6px;font-size:13px}.image-scroll{overflow:auto;max-height:65vh;background:#808080;border:1px solid #4f5961;min-height:80px}.images img{display:block;width:100%;height:auto}.pixel-view .images img{width:auto;max-width:none}.metadata{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;color:#b9c3ca}.notice{border-left:3px solid #e39a65;padding:8px 12px;background:#34291f;white-space:pre-wrap;overflow-wrap:anywhere}.note{font-size:14px;color:#bac5cb}details{padding:12px 0;border-top:1px solid #454e55}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:400px;overflow:auto;font-size:12px}table{border-collapse:collapse;font-size:13px;width:100%}th,td{text-align:left;padding:8px;border-bottom:1px solid #454e55}@media(max-width:900px){.layout{grid-template-columns:1fr}.frame-list{max-height:230px}.images{grid-template-columns:1fr}.filters{position:static}header,main{padding:16px}}</style></head><body>
<header><h1>Doop visual verification</h1><p><strong>${allExact ? "All 44 active targets have exact evidence." : "Complete matching is not yet proven."}</strong> The finished product uses the newer Glaze workspace; overlay foregrounds are compared independently from the approved background replacement.</p><div class="summary"><p><strong>${exact.length}/44</strong><br>active targets exact</p><p><strong>${open.length}</strong><br>active targets remaining</p><p><strong>46</strong><br>superseded references</p><p><strong>90</strong><br>source frames accounted for</p></div><div class="bar" role="img" aria-label="${exact.length} exact and ${open.length} remaining active targets"><span style="width:${exact.length / 44 * 100}%"></span><span style="width:${open.length / 44 * 100}%"></span></div><p class="note">Zero RGB tolerance. Canonical results only. Generated ${escapeHtml(generatedAt)}. <a href="results.json">Raw captures</a> · <a href="visual-report.json">Report data</a> · <a href="reference/manifest.json">Source origins and hashes</a></p></header>
<main><div class="filters"><input id="search" type="search" aria-label="Search frames" placeholder="Search 90 source frames"><select id="theme" aria-label="Filter theme"><option value="">Both themes</option><option>light</option><option>dark</option></select><select id="scope" aria-label="Filter scope"><option value="">All scopes</option><option value="active">Active targets</option><option value="full-frame">Full frames</option><option value="foreground">Foregrounds</option><option value="superseded">Superseded references</option></select><select id="status" aria-label="Filter result"><option value="">All results</option>${["exact","mismatch","error","needs-current-capture","not-captured","superseded"].map(status=>`<option value="${status}">${status}</option>`).join("")}</select><button id="prev" aria-label="Previous frame">←</button><button id="next" aria-label="Next frame">→</button></div><p id="count" class="note"></p><div class="layout"><nav id="list" class="frame-list" aria-label="Source frames"></nav><section id="detail" class="detail" aria-live="polite"></section></div><details><summary>Comparison method and limits</summary><p>16 active targets compare the entire frame. 28 compare the complete foreground on a shared neutral backdrop and require source placement to match within 0.001 CSS pixel. The earlier masked rounded-corner region is diagnostic only; it cannot pass a foreground target. Raw full-frame screenshots remain available and reveal the deliberately replaced backgrounds.</p><p>Chromium, DPR 1, authored viewport sizes, en-US/UTC, fixed reference dates, loaded fonts/images, source-matched fixture data, and reduced motion. Reduced-motion landing posters are authored media; normal animation is checked separately. Source HTML is used only on the reference side; the native side renders real React components. No live OAuth, email delivery, Calendar writes, or live AI provider is certified.</p><p>Reference origins: ${official} official Doop PNGs and ${summary.pinnedHtmlReferenceImages} pinned HTML renders. The screenshot endpoint rate limited after 15 downloads. Origins, revisions and hashes are preserved individually.</p></details></main>
<script id="report-data" type="application/json">${data}</script><script>
const report=JSON.parse(document.getElementById('report-data').textContent);let selected=report.rows.find(r=>r.active&&r.status!=='exact')?.id||report.rows[0].id;let visible=[];
const labels={exact:'Exact',mismatch:'Mismatch',error:'Capture error','needs-current-capture':'Needs current capture','not-captured':'Not captured',superseded:'Superseded'};const el=id=>document.getElementById(id);const fmt=n=>n==null?'Not measured':n.toLocaleString('en-US');
function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function link(text,href){const a=element('a',text);a.href=href;return a;}
function images(target,pair){const group=element('div',undefined,'images');for(const [label,key]of [['Reference','reference'],['Native app','native'],['Difference','diff']]){const figure=element('figure');figure.append(element('figcaption',label));if(pair[key]){const holder=element('div',undefined,'image-scroll');const a=link('',pair[key]);a.target='_blank';const img=element('img');img.src=pair[key];img.alt=pair.title+' — '+label;img.loading='lazy';a.append(img);holder.append(a);figure.append(holder);}else figure.append(element('p','No capture available','notice'));group.append(figure);}target.append(group);}
function drawDetail(row){const target=el('detail');target.replaceChildren();target.append(element('h2',row.name));const meta=element('div',undefined,'metadata');meta.append(element('span',labels[row.status],'badge '+row.status),element('span',row.theme+' · '+row.label),element('span',row.width+' × '+row.height));target.append(meta);const p=element('p',row.active?'Compared pixels: '+fmt(row.comparedPixels)+' · differing pixels: '+fmt(row.differentPixels):'Historical reference retained for traceability. The approved newer Glaze implementation replaces this layout; this is not an exact-match claim.');target.append(p);if(row.issue)target.append(element('p',row.issue,'notice'));if(!row.sourceHashMatches)target.append(element('p','Source hash differs between the reference manifest and native capture. Regenerate the comparison.','notice'));if(row.historicalCaptureError)target.append(element('p','Historical capture diagnostic: '+row.historicalCaptureError,'notice'));target.append(link('Open source frame in Doop','https://doop.design/c/CCwouJnWg1?frame='+encodeURIComponent(row.id)));const zoom=element('label',' Show images at 1:1 pixels');const input=element('input');input.type='checkbox';input.addEventListener('change',()=>target.classList.toggle('pixel-view',input.checked));zoom.prepend(input);target.append(element('p'),zoom);for(const pair of row.pairs){target.append(element('h3',pair.title));images(target,pair);}if(row.scope.includes('foreground')){const full=element('details');full.append(element('summary','Unmodified full-frame screenshots (background differences are approved)'));images(full,{title:'Whole frame',reference:row.fullReference,native:row.fullNative,diff:row.fullDiff});target.append(full);}const details=element('details');details.append(element('summary','Revision, ownership, geometry and raw result'));details.append(element('pre',JSON.stringify(row,null,2)));target.append(details);}
function render(){const search=el('search').value.toLowerCase(),theme=el('theme').value,scope=el('scope').value,status=el('status').value;visible=report.rows.filter(r=>(!search||(r.name+' '+r.id+' '+r.scenario).toLowerCase().includes(search))&&(!theme||r.theme===theme)&&(!status||r.status===status)&&(!scope||(scope==='active'?r.active:scope==='superseded'?!r.active:scope==='foreground'?r.scope.includes('foreground'):r.scope===scope)));if(!visible.some(r=>r.id===selected))selected=visible[0]?.id;el('count').textContent=visible.length+' of '+report.rows.length+' source frames';const list=el('list');list.replaceChildren();for(const row of visible){const button=element('button',row.name);button.type='button';button.setAttribute('aria-current',String(row.id===selected));button.append(element('small',row.theme+' · '+labels[row.status]));button.addEventListener('click',()=>{selected=row.id;render();});list.append(button);}const row=visible.find(r=>r.id===selected);if(row)drawDetail(row);else el('detail').replaceChildren(element('p','No matching frames.'));el('prev').disabled=!row||visible.indexOf(row)===0;el('next').disabled=!row||visible.indexOf(row)===visible.length-1;}
for(const id of ['search','theme','scope','status'])el(id).addEventListener('input',render);for(const [id,delta]of [['prev',-1],['next',1]])el(id).addEventListener('click',()=>{const i=visible.findIndex(r=>r.id===selected);selected=visible[i+delta]?.id||selected;render();});render();
</script></body></html>`;
await fs.writeFile(path.join(artifacts, "report.html"), html);
console.log(`${allExact ? "EXACT" : "INCOMPLETE"}: ${exact.length}/44 active targets exact; ${open.length} remaining; 46 superseded references. Wrote docs/DOOP_VISUAL_VERIFICATION.md and artifacts/doop-visual/report.html.`);
