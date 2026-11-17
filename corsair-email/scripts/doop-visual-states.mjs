export const emailProposal = {kind:'email',to:'ari@northstarhq.com',subject:'Re: launch review for 1:00 PM',body:'Hi Ari,\n\n3 PM works for me. I will review the updated deck before we meet.\n\nSee you then,\nVinay'};
export const secondProposal = {kind:'email',to:'nadia@example.com',subject:'Re: partnership intro',body:'Hi Nadia,\n\nThanks for the introduction. I will review the details and follow up.\n\nVinay'};
export const eventProposal = {kind:'event',summary:'Launch review',start:'2026-06-18T09:00:00.000Z',end:'2026-06-18T09:30:00.000Z',attendees:'ari@northstarhq.com, vinay@example.com',location:'Google Meet',description:'Review the updated deck and agree on next steps.'};
export const prompts={
 'compose':'Draft a reply to Ari and check whether I am free at 3 PM.',
 'triage':'Show only the messages that need my response',
 'tool-activity':'Draft replies to the top two threads and check my calendar.',
 'draft':'Draft a reply saying 3 PM works for me.',
 'draft-edit':'Make the reply warmer and mention the updated deck.',
 'event-proposal':'Schedule 30 minutes with Ari tomorrow at 9 AM.',
 'event-edit':'Schedule 30 minutes with Ari tomorrow at 9 AM.',
 'retry':'Draft a reply to the top thread.',
};
export function triageFixture(){
 const people=[['Calendar Digest','Confirm the meeting time adjustment',1],['Nadia Flores','Partnership intro and next steps',3],['Mika Patel','Investor follow-up',1],['Priya Shah','Candidate loop updates',3]];
 return {total:8,threads:people.flatMap(([sender,reason,count],person)=>Array.from({length:count},(_,i)=>({threadId:`source-thread-${person}`,sender,subject:reason,priorityBand:person===0?'high':'normal',summaryReason:reason})))};
}
export function chatHistoryFixture(){
 const specs=[['Launch review with Ari','2026-06-17T11:42:00.000Z',6],['Messages that need my reply','2026-06-17T10:18:00.000Z',4],['Friday follow-ups','2026-06-15T11:00:00.000Z',8],['Unread mail summary','2026-06-14T11:00:00.000Z',3],['Roadmap planning','2026-06-08T11:00:00.000Z',5]];
 return specs.map(([title,updatedAt,count],i)=>({id:`reference-chat-${i}`,title,updatedAt,lastInboxCheckpointAt:null,turns:Array.from({length:count},(_,j)=>({id:`history-${i}-${j}`,role:j%2?'assistant':'user',content:j===0?title:'Saved conversation message',tools:[],proposals:[],createdAt:updatedAt}))}));
}
export async function prepareNativeState(page, scenario){
 if(scenario==='week')await page.getByRole('button',{name:'Next week',exact:true}).click();
 if(scenario==='collapsed-sidebar')await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
 if(scenario==='month'||scenario==='selected-day'){
  await page.getByRole('tab',{name:'Month',exact:true}).click();
  if(scenario==='selected-day')await page.locator('.dashboard-calendar-dates button[aria-pressed=true]').click();
 }
 if(scenario==='approval')await page.getByRole('switch',{name:'Auto-approve actions'}).click();
 if(scenario==='history')await page.getByRole('button',{name:'Chat history',exact:true}).click();
 if(scenario==='command')await page.getByLabel('Command',{exact:true}).fill('schedule meeting with Ari tomorrow 9am');
 if(prompts[scenario]){
  const requestEvents=[];
  if(scenario==='compose')requestEvents.push({type:'tool',label:'Checked the conversation'},{type:'tool',label:'Checked Google Calendar'},{type:'token',text:'You are free at 3 PM. I prepared a reply for your review.'},{type:'proposal',proposal:{...eventProposal,start:'2026-11-15T15:00:00.000Z',end:'2026-11-15T15:30:00.000Z',attendees:'ari@example.com'}});
  if(scenario==='triage')requestEvents.push({type:'token',text:'Here are the threads waiting on you.'},{type:'triage',result:triageFixture()},{type:'tool',label:'Triaged inbox · reply candidates'});
  if(scenario==='draft'||scenario==='draft-edit')requestEvents.push({type:'tool',label:'Read thread · Checked calendar'},{type:'proposal',proposal:emailProposal},...(scenario==='draft'?[{type:'proposal',proposal:secondProposal}]:[]));
  if(scenario==='event-proposal'||scenario==='event-edit')requestEvents.push({type:'tool',label:'Checked Google Calendar · This time is free'},{type:'proposal',proposal:eventProposal});
  if(scenario==='tool-activity')requestEvents.push({type:'token',text:'Preparing your next steps'},{type:'tool',label:'Read 8 reply candidates'},{type:'tool',label:'Opened Ari Morgan’s conversation'},{type:'tool',label:'Checked tomorrow’s calendar'});
  if(scenario==='tool-activity'){
   await page.evaluate(events=>{
    const original=window.fetch;
    window.fetch=async (input,init)=>{
     if(String(input).endsWith('/api/agent')){
      return new Response(new ReadableStream({start(controller){
       const encoder=new TextEncoder();for(const event of events)controller.enqueue(encoder.encode('data: '+JSON.stringify(event)+'\n\n'));
       init?.signal?.addEventListener('abort',()=>controller.close(),{once:true});
      }}),{headers:{'Content-Type':'text/event-stream'}});
     }
     return original(input,init);
    };
   },requestEvents);
  }else await page.route('**/api/agent',route=>scenario==='retry'?route.fulfill({status:503,json:{error:'The connection was interrupted. Your message is saved. Try again to prepare the draft.'}}):route.fulfill({contentType:'text/event-stream',body:requestEvents.map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')}));
  await page.getByLabel('Message your assistant').fill(prompts[scenario]);
  await page.getByLabel('Message your assistant').press('Enter');
  if(scenario==='retry')await page.getByRole('button',{name:'Retry response'}).waitFor();
  else if(scenario==='triage')await page.locator('.doop-agent-triage').waitFor();
  else if(scenario==='tool-activity')await page.locator('.doop-tool-activity').waitFor();
  else if(scenario==='compose')await page.locator('.doop-embedded-event').waitFor();
  else await page.locator('.doop-source-artifact').first().waitFor();
  if(scenario==='draft-edit'||scenario==='event-edit')await page.getByRole('button',{name:'Edit',exact:true}).first().click();
 }
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(async img=>{img.loading='eager';await img.decode();}));if(document.activeElement instanceof HTMLElement)document.activeElement.blur();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
}
