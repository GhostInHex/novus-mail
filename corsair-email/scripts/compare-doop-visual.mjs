import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { expect } from '@playwright/test';
import { launchBrowser } from './browser.mjs';
import { canvas } from './doop-source.mjs';
import { coverage } from './doop-coverage.mjs';
import { chatHistoryFixture, prepareNativeState } from './doop-visual-states.mjs';
const BASE=process.env.BASE_URL||'http://localhost:3100';
const root='../artifacts/doop-visual';
const FILTER=process.env.DOOP_FRAMES?.split(',');
if(FILTER&&(new Set(FILTER).size!==FILTER.length||FILTER.some(id=>!canvas.frames.some(frame=>frame.id===id))))throw Error('DOOP_FRAMES must contain distinct known frame IDs');
if(canvas.frames.length!==90||coverage.length!==90)throw Error('Expected all90 source frames and implementation mappings');
const overlayScenarios=new Set(['assistant-welcome','triage','tool-activity','draft','draft-edit','event-proposal','event-edit','history','approval','retry','event','command','shortcuts']);
const historicalLandingFrames=new Set(['eXLag7TsWm','9QIQzqwAWN']);
const replacementScenarios=new Set(['collapsed-sidebar','collapsed-agenda','month','selected-day']);
const referenceManifest=JSON.parse(await fs.readFile(`${root}/reference/manifest.json`,'utf8'));
const results=[];
const browser=await launchBrowser();
await fs.mkdir(`${root}/comparisons`,{recursive:true});
const sourceContext=await browser.newContext({deviceScaleFactor:1,reducedMotion:'reduce',locale:'en-US',timezoneId:'UTC'});
const sourcePage=await sourceContext.newPage();
sourcePage.setDefaultTimeout(10000);
function crop(box,width,height){const x=Math.max(0,Math.floor(box.x));const y=Math.max(0,Math.floor(box.y));return {left:x,top:y,width:Math.min(width-x,Math.ceil(box.x+box.width)-x),height:Math.min(height-y,Math.ceil(box.y+box.height)-y)};}
async function compare(reference,native,path,rounded=false){
 const aMeta=await sharp(reference).metadata();const bMeta=await sharp(native).metadata();const width=Math.max(aMeta.width,bMeta.width),height=Math.max(aMeta.height,bMeta.height);
 const convert=async bytes=>sharp(bytes).flatten({background:'#ffffff'}).removeAlpha().extend({top:0,left:0,right:width-(await sharp(bytes).metadata()).width,bottom:height-(await sharp(bytes).metadata()).height,background:'#ff00ff'}).raw().toBuffer();
 const a=await convert(reference),b=await convert(native);const diff=Buffer.alloc(width*height*3);let differentPixels=0,comparedPixels=0,maxChannelDelta=0,totalChannelDelta=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*3;
  // The user approved replacing backgrounds; exclude ONLY pixels outside the rounded foreground border.
  const radius=12,cx=x<radius?radius-0.5:x>=Math.min(aMeta.width,bMeta.width)-radius?Math.min(aMeta.width,bMeta.width)-radius-0.5:x,cy=y<radius?radius-0.5:y>=Math.min(aMeta.height,bMeta.height)-radius?Math.min(aMeta.height,bMeta.height)-radius-0.5:y;
  const excluded=rounded&&x<Math.min(aMeta.width,bMeta.width)&&y<Math.min(aMeta.height,bMeta.height)&&Math.hypot(x-cx,y-cy)>radius;
  if(excluded){diff[i]=diff[i+1]=diff[i+2]=230;continue;}
  comparedPixels++;let changed=false;
  for(let channel=0;channel<3;channel++){const delta=Math.abs(a[i+channel]-b[i+channel]);maxChannelDelta=Math.max(maxChannelDelta,delta);totalChannelDelta+=delta;if(delta)changed=true;}
  if(changed){differentPixels++;diff[i]=235;diff[i+1]=55;diff[i+2]=100;}else{const gray=Math.round((a[i]+a[i+1]+a[i+2])/3);diff[i]=diff[i+1]=diff[i+2]=Math.round(230+gray*0.08);}
 }
 await sharp(diff,{raw:{width,height,channels:3}}).png().toFile(path);
 return {referenceSize:{width:aMeta.width,height:aMeta.height},nativeSize:{width:bMeta.width,height:bMeta.height},comparedPixels,differentPixels,mismatchRatio:differentPixels/comparedPixels,meanAbsoluteChannelDelta:totalChannelDelta/(comparedPixels*3),maxChannelDelta,exactMatch:differentPixels===0&&aMeta.width===bMeta.width&&aMeta.height===bMeta.height};
}
async function isolatedScreenshot(page, selector){
 await page.addStyleTag({content:`html{background:rgb(128,128,128)}body{background:rgb(128,128,128);visibility:hidden}${selector}{visibility:visible}`});
 return page.screenshot({fullPage:true,animations:'disabled',caret:'hide'});
}
try{
 for(const frame of canvas.frames){
  if(FILTER&&!FILTER.includes(frame.id))continue;
  const entry=coverage.find(e=>e.frame===frame.id);const isComponent=entry.kind==='component';
  const scope=historicalLandingFrames.has(frame.id)?'historical-landing':isComponent?'historical-component':overlayScenarios.has(entry.scenario)?'overlay-foreground':entry.scenario==='success'?'feedback-foreground':replacementScenarios.has(entry.scenario)?'canonical-layout-replacement':'full-frame';
  const context=await browser.newContext({viewport:{width:isComponent?1440:frame.width,height:isComponent?1000:frame.height},deviceScaleFactor:1,reducedMotion:'reduce',locale:'en-US',timezoneId:'UTC',colorScheme:entry.theme});
  await context.addInitScript(({theme,chats})=>{localStorage.setItem('novusmail-theme',theme+'-default');localStorage.setItem('corsair-mail-agent-chats:v2',JSON.stringify(chats));},{theme:entry.theme,chats:entry.scenario==='history'?chatHistoryFixture():[]});
  const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const result={capturedAt:new Date().toISOString(),frame:frame.id,name:frame.name,theme:entry.theme,scenario:entry.scenario,scope,sourceUpdatedAt:frame.updatedAt,sourceSha256:crypto.createHash('sha256').update(await fs.readFile(`design/doop/screens/${frame.id}.html`)).digest('hex'),errors};
  try{
   const provenance=referenceManifest.find(item=>item.frame===frame.id);
   if(!provenance||provenance.sourceSha256!==result.sourceSha256)throw Error('Pinned source differs from the reference manifest');
   result.referenceOrigin=provenance.origin;
   await page.clock.setFixedTime(new Date(overlayScenarios.has(entry.scenario)?'2026-06-17T14:00:00.000Z':'2026-11-15T14:00:00.000Z'));
   const response=await page.goto(`${BASE}/design-review?scenario=${encodeURIComponent(entry.scenario)}`,{waitUntil:'networkidle'});
   if(response?.status()!==200)throw Error(`Native review returnedHTTP${response?.status()}`);
   await expect(page.locator('html')).toHaveClass(new RegExp(entry.theme));
   await expect(page.locator('main')).toBeVisible();
   await prepareNativeState(page,entry.scenario);
   const dialog=page.locator('[data-slot=dialog-content][data-state=open]');
   if(overlayScenarios.has(entry.scenario)){
    await expect(dialog).toBeVisible();await expect(dialog).toHaveCSS('opacity','1');
    await expect.poll(()=>dialog.evaluate(el=>{const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);return Math.abs(m.m11-1)<0.001&&Math.abs(m.m22-1)<0.001&&Math.abs(m.m41)<0.01&&Math.abs(m.m42)<0.01;})).toBe(true);
   }
   await page.mouse.move(0,0);
   const nativePath=`comparisons/${frame.id}-native.png`;
   await page.screenshot({path:`${root}/${nativePath}`,animations:'disabled',caret:'hide'});result.native=nativePath;
   const refBytes=await fs.readFile(`${root}/reference/${frame.id}.png`),nativeBytes=await fs.readFile(`${root}/${nativePath}`);
   result.referenceSha256=crypto.createHash('sha256').update(refBytes).digest('hex');
   if(result.referenceSha256!==provenance.sha256)throw Error('Reference PNG differs from the reference manifest');
   result.fullFrame=await compare(refBytes,nativeBytes,`${root}/comparisons/${frame.id}-full-diff.png`);result.fullDiff=`comparisons/${frame.id}-full-diff.png`;
   await sourcePage.setViewportSize({width:frame.width,height:frame.height});
   await sourcePage.setContent(await fs.readFile(`design/doop/screens/${frame.id}.html`,'utf8'),{waitUntil:'load'});await sourcePage.evaluate(()=>document.fonts.ready);
   let sourceSelector,nativeSelector;
   if(scope==='overlay-foreground'){sourceSelector='[data-node-label="Modal Backdrop"] > [data-node-label="Feature Card"]';nativeSelector='[data-slot=dialog-content][data-state=open]';}
   else if(scope==='feedback-foreground'){sourceSelector='[data-node-label="Sonner Feedback Stack"]';nativeSelector='[data-sonner-toast]';}
   else if(scope==='historical-component'){sourceSelector='body > [data-node-label], body > div > [data-node-label]';nativeSelector=`${entry.selector}:visible`;}
   if(sourceSelector){
    const sourceBox=await sourcePage.locator(sourceSelector).first().boundingBox();
    let nativeBox=await page.locator(nativeSelector).first().boundingBox();
    if(scope==='feedback-foreground'){
     await expect(page.locator(nativeSelector)).toHaveCount(2);
     const boxes=await page.locator(nativeSelector).evaluateAll(es=>es.map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));
     const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));nativeBox={x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};
    }
    if(!sourceBox||!nativeBox)throw Error('Missing comparison region');
    result.referenceBox=sourceBox;result.nativeBox=nativeBox;
    const a=await sharp(refBytes).extract(crop(sourceBox,frame.width,frame.height)).toBuffer();
    const nativeMeta=await sharp(nativeBytes).metadata();const b=await sharp(nativeBytes).extract(crop(nativeBox,nativeMeta.width,nativeMeta.height)).toBuffer();
    await fs.writeFile(`${root}/comparisons/${frame.id}-reference-region.png`,a);await fs.writeFile(`${root}/comparisons/${frame.id}-native-region.png`,b);
    result.region=await compare(a,b,`${root}/comparisons/${frame.id}-region-diff.png`,scope==='overlay-foreground');result.regionDiff=`comparisons/${frame.id}-region-diff.png`;
    result.referenceRegion=`comparisons/${frame.id}-reference-region.png`;result.nativeRegion=`comparisons/${frame.id}-native-region.png`;
   }
   if(scope==='overlay-foreground'){
    const sourceNeutral=await isolatedScreenshot(sourcePage,sourceSelector),nativeNeutral=await isolatedScreenshot(page,nativeSelector);
    const a=await sharp(sourceNeutral).extract(crop(result.referenceBox,frame.width,frame.height)).toBuffer();
    const nMeta=await sharp(nativeNeutral).metadata();const b=await sharp(nativeNeutral).extract(crop(result.nativeBox,nMeta.width,nMeta.height)).toBuffer();
    const stem=`comparisons/${frame.id}-isolated`;
    await fs.writeFile(`${root}/${stem}-reference.png`,a);await fs.writeFile(`${root}/${stem}-native.png`,b);
    const pixels=await compare(a,b,`${root}/${stem}-diff.png`);
    const placementMatches=['x','y','width','height'].every(key=>Math.abs(result.referenceBox[key]-result.nativeBox[key])<0.001);
    result.isolatedForeground={...pixels,placementMatches,exactMatch:pixels.exactMatch&&placementMatches,reference:`${stem}-reference.png`,native:`${stem}-native.png`,diff:`${stem}-diff.png`,method:'Entire foreground borderbox on a shared neutral backdrop; only body visibility/background changes, target visibility restored. Original foreground styles/content/geometry unchanged. Full-document capture avoids viewport scrollbars occluding the foreground; authored viewport dimensions remain unchanged. No pixel masks or tolerance.'};
   }
   if(scope==='feedback-foreground'){
    const sourceNeutral=await isolatedScreenshot(sourcePage,'[data-node-label="Sonner Feedback Stack"] > [data-node-label="Feature Card"]'),nativeNeutral=await isolatedScreenshot(page,'.doop-feedback-card');
    result.feedbackCards=[];
    const cards=sourcePage.locator('[data-node-label="Sonner Feedback Stack"] > [data-node-label="Feature Card"]');
    for(let i=0;i<await cards.count();i++){
     const sourceCard=cards.nth(i);const title=await sourceCard.locator('[data-node-label="Text Label"]').first().innerText();
     const nativeCard=page.getByRole('region',{name:title,exact:true});
     const referenceBox=await sourceCard.boundingBox(),nativeBox=await nativeCard.boundingBox();
     const a=await sharp(sourceNeutral).extract(crop(referenceBox,frame.width,frame.height)).toBuffer();
     const nMeta=await sharp(nativeNeutral).metadata();const b=await sharp(nativeNeutral).extract(crop(nativeBox,nMeta.width,nMeta.height)).toBuffer();
     const stem=`comparisons/${frame.id}-card-${i}`;await fs.writeFile(`${root}/${stem}-reference.png`,a);await fs.writeFile(`${root}/${stem}-native.png`,b);
     const pixels=await compare(a,b,`${root}/${stem}-diff.png`);
     const placementMatches=['x','y','width','height'].every(key=>Math.abs(referenceBox[key]-nativeBox[key])<0.001);
     result.feedbackCards.push({title,referenceBox,nativeBox,placementMatches,...pixels,reference:`${stem}-reference.png`,native:`${stem}-native.png`,diff:`${stem}-diff.png`});
    }
    result.foreground={comparedPixels:result.feedbackCards.reduce((s,c)=>s+c.comparedPixels,0),differentPixels:result.feedbackCards.reduce((s,c)=>s+c.differentPixels,0),exactMatch:result.feedbackCards.length===2&&result.feedbackCards.every(c=>c.exactMatch&&c.placementMatches)};
   }
   const measured=scope==='feedback-foreground'?result.foreground:scope==='overlay-foreground'?result.isolatedForeground:result.fullFrame;
   result.status=errors.length?'error':scope==='historical-component'||scope==='historical-landing'||scope==='canonical-layout-replacement'?'approved-layout-replacement':measured.exactMatch?'exact':'mismatch';
  }catch(error){result.status='error';result.error=error.message;console.error(frame.id,error.message.split('\n')[0]);}
  results.push(result);await context.close();
  console.log(`${results.length}/${FILTER?FILTER.length:canvas.frames.length} ${frame.name}: ${result.status}`);
  await fs.writeFile(`${root}/${FILTER?'partial-results':'results'}.json`,JSON.stringify(results,null,2));
 }
}finally{await browser.close();}
if(process.env.DOOP_STRICT==='1'&&results.some(r=>r.status==='mismatch'||r.status==='error'))process.exitCode=1;
