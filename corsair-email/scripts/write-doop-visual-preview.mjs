import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("..", import.meta.url));
const artifacts = path.resolve(project, "../artifacts/doop-visual");
const captures = JSON.parse(await fs.readFile(path.join(artifacts, "results.json"), "utf8"));
const historical = new Set(["historical-component", "canonical-layout-replacement", "historical-landing"]);
const olderLanding = new Set(["eXLag7TsWm", "9QIQzqwAWN"]);
const active = captures.filter(row => !historical.has(row.scope) && !olderLanding.has(row.frame));
if (captures.length !== 90 || new Set(captures.map(row => row.frame)).size !== 90 || active.length !== 44) throw Error("Expected 90 unique canonical frames and 44 active targets.");
const metricFor = row => row.scope === "full-frame" ? row.fullFrame : row.scope === "overlay-foreground" ? row.isolatedForeground : row.foreground;
const pixelsExact = metric => metric.exactMatch === true && metric.differentPixels === 0 && (!metric.referenceSize || !metric.nativeSize || (metric.referenceSize.width === metric.nativeSize.width && metric.referenceSize.height === metric.nativeSize.height));
const checked = active.map(row => {
  const metric = metricFor(row);
  if (!metric || !Number.isFinite(metric.differentPixels) || !Number.isFinite(metric.comparedPixels)) throw Error(`Missing current canonical metrics for ${row.frame}; run the final comparator first.`);
  if (row.scope === "overlay-foreground" && typeof metric.placementMatches !== "boolean") throw Error(`Missing foreground placement for ${row.frame}`);
  if (row.scope === "feedback-foreground" && (row.feedbackCards?.length !== 2 || row.feedbackCards.some(card => typeof card.placementMatches !== "boolean"))) throw Error(`Missing feedback comparison for ${row.frame}`);
  const placement = row.scope === "full-frame" || (row.scope === "overlay-foreground" ? metric.placementMatches : row.feedbackCards.every(card => card.placementMatches && pixelsExact(card)));
  const error = Boolean(row.error || row.errors?.length || row.status === "error");
  return { ...row, metric, result: error ? "error" : pixelsExact(metric) && placement ? "exact" : "mismatch" };
});
const escape = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const absoluteImage = async relative => {
  if (!relative) throw Error("Missing canonical image path");
  const absolute = path.resolve(artifacts, relative);
  await fs.access(absolute);
  return escape(absolute);
};
const screens = [{scenario:"inbox",name:"Inbox"},{scenario:"week",name:"Calendar"},{scenario:"compose",name:"Compose"},{scenario:"assistant-welcome",name:"AI welcome"},{scenario:"event",name:"Event"}];
const sections = [];
for (const screen of screens) for (const theme of ["light", "dark"]) {
  const matches = checked.filter(row => row.scenario === screen.scenario && row.theme === theme);
  if (matches.length !== 1) throw Error(`Expected one ${screen.scenario}/${theme} sample`);
  const row = matches[0];
  const foreground = row.scope === "overlay-foreground";
  const metric = row.metric;
  const paths = foreground ? metric : {reference:`reference/${row.frame}.png`,native:row.native,diff:row.fullDiff};
  const [reference,native,diff] = await Promise.all([paths.reference,paths.native,paths.diff].map(absoluteImage));
  const count = new Intl.NumberFormat("en-US").format(metric.differentPixels);
  const total = new Intl.NumberFormat("en-US").format(metric.comparedPixels);
  sections.push(`<section class="dv-sample" data-screen="${screen.scenario}" data-theme="${theme}"${sections.length ? " hidden" : ""}><p class="dv-metric"><strong>${count} / ${total} differing pixels</strong><span>${foreground ? "Entire isolated foreground + source placement" : "Entire frame"} · ${escape(row.result)}${foreground ? ` · placement ${metric.placementMatches ? "matches" : "differs"}` : ""}</span></p><div class="dv-pair"><figure><figcaption>Doop reference</figcaption><a href="${reference}" target="_blank" rel="noopener"><img src="${reference}" alt="${escape(screen.name)} ${theme} Doop reference"></a></figure><figure><figcaption>App</figcaption><a href="${native}" target="_blank" rel="noopener"><img src="${native}" alt="${escape(screen.name)} ${theme} native app"></a></figure></div><figure class="dv-diff" hidden><figcaption>Pixel difference · zero RGB tolerance</figcaption><img src="${diff}" alt="${escape(screen.name)} ${theme} pixel difference"></figure></section>`);
}
const exact = checked.filter(row=>row.result === "exact").length;
const mismatches = checked.filter(row=>row.result === "mismatch").length;
const errors = checked.filter(row=>row.result === "error").length;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
.dv-preview{width:100%;max-width:728px;min-width:0;color:var(--foreground,#191919);font-family:var(--font-sans,system-ui,sans-serif);font-size:13px;line-height:1.5}.dv-preview *{box-sizing:border-box}.dv-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}.dv-controls label{color:var(--muted-foreground,#666)}.dv-controls select,.dv-controls button{font:inherit;color:var(--foreground,#191919);background:var(--card,#fff);border:1px solid var(--border,#ddd);border-radius:var(--radius,6px);padding:6px 9px}.dv-controls button[aria-pressed=true]{background:var(--accent,#eee)}.dv-controls :focus-visible,.dv-pair a:focus-visible{outline:2px solid var(--ring,#777);outline-offset:2px}.dv-metric{display:flex;flex-direction:column;margin:0 0 10px}.dv-metric span,.dv-summary,figcaption{color:var(--muted-foreground,#666)}.dv-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.dv-preview figure{margin:0;min-width:0}.dv-preview figcaption{font-size:11px;margin-bottom:5px}.dv-preview img{display:block;width:100%;height:auto;border:1px solid var(--border,#ddd);border-radius:var(--radius,6px)}.dv-pair a{display:block}.dv-diff{margin-top:12px!important;max-width:354px}.dv-summary{margin:14px 0 0;padding-top:10px;border-top:1px solid var(--border,#ddd);font-size:12px}.dv-preview [hidden]{display:none!important}@media(max-width:380px){.dv-pair{gap:6px}.dv-controls{gap:6px}.dv-controls select,.dv-controls button{padding:5px 7px}}
</style><div class="dv-preview"><div class="dv-controls"><label for="dv-screen">Screen</label><select id="dv-screen">${screens.map(screen=>`<option value="${screen.scenario}">${screen.name}</option>`).join("")}</select><button id="dv-theme" type="button" aria-pressed="false">Light</button><button id="dv-diff" type="button" aria-pressed="false">Show diff</button></div>${sections.join("\n")}<p class="dv-summary">${exact}/44 active targets exact · ${mismatches} mismatches · ${errors} capture errors · ${captures.length-active.length} superseded references. 16 full frames and 28 foregrounds; zero RGB tolerance. Images and metrics come from canonical results.json; click a paired image to inspect its full size.</p></div><script>(()=>{const root=document.querySelector('.dv-preview');const screen=root.querySelector('#dv-screen'),theme=root.querySelector('#dv-theme'),diff=root.querySelector('#dv-diff');let dark=false,showDiff=false;function update(){theme.textContent=dark?'Dark':'Light';theme.setAttribute('aria-pressed',String(dark));diff.textContent=showDiff?'Hide diff':'Show diff';diff.setAttribute('aria-pressed',String(showDiff));root.querySelectorAll('.dv-sample').forEach(section=>{section.hidden=section.dataset.screen!==screen.value||section.dataset.theme!==(dark?'dark':'light');section.querySelector('.dv-diff').hidden=!showDiff;});}screen.addEventListener('change',update);theme.addEventListener('click',()=>{dark=!dark;update()});diff.addEventListener('click',()=>{showDiff=!showDiff;update()});update();})();</script></body></html>\n`;
await fs.writeFile(path.join(artifacts,"preview.html"),html);
console.log(`Wrote preview.html with 10 samples; ${exact}/44 active exact, ${mismatches} mismatches, ${errors} errors.`);
