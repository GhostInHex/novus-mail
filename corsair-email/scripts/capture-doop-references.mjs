import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { canvas } from './doop-source.mjs';
const root='../artifacts/doop-visual/reference';
await fs.mkdir(root,{recursive:true});
const sourceResults=JSON.parse(await fs.readFile('../artifacts/doop-audit/source-results.json','utf8'));
const previous=await fs.readFile(`${root}/manifest.json`, 'utf8').then(JSON.parse).catch(()=>[]);
const results=[];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const frame of canvas.frames){
 const pinned=await fs.readFile(`design/doop/screens/${frame.id}.html`);
 const local=sourceResults.find(r=>r.frame===frame.id);
 if(!local||hash(pinned)!==local.sha256)throw Error(`${frame.id}: source render must be regenerated`);
 const authored=await fs.readFile(`../artifacts/doop-audit/${local.screenshot}`);
 let image,origin,officialEqualsLocal=null;
 try {image=await fs.readFile(`${root}/${frame.id}.png`);origin=previous.find(r=>r.frame===frame.id)?.origin || 'official-doop-render';
  const a=await sharp(image).removeAlpha().raw().toBuffer();const b=await sharp(authored).removeAlpha().raw().toBuffer();officialEqualsLocal=origin==='official-doop-render'?a.equals(b):null;
 }catch(error){if(error.code!=='ENOENT')throw error;image=authored;origin='pinned-source-html-render';await fs.writeFile(`${root}/${frame.id}.png`,image);}
 const metadata=await sharp(image).metadata();
 if(metadata.width!==frame.width||metadata.height!==frame.height)throw Error(`${frame.id}: wrong reference dimensions`);
 results.push({frame:frame.id,width:metadata.width,height:metadata.height,sha256:hash(image),sourceSha256:hash(pinned),sourceUpdatedAt:frame.updatedAt,origin,officialEqualsLocal});
}
await fs.writeFile(`${root}/manifest.json`,JSON.stringify(results,null,2));
console.log({references:results.length,official:results.filter(r=>r.origin==='official-doop-render').length,officialExactLocal:results.filter(r=>r.officialEqualsLocal===true).length,note:'The screenshot endpoint returned429 after15 downloads; remaining references are unchanged pinned HTML rendered at the same DPR/viewport. Origins and hashes are explicit.'});
