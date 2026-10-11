// Run with the browser tool's filename option. Display order by recency, manual front/auto, drag swaps; never saves.
async (page) => {
 const p=await page.context().newPage();
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const errors=[];p.on('pageerror',error=>errors.push(error.message));
 const settle=()=>p.waitForTimeout(450);
 const center=async locator=>{const box=await locator.boundingBox();return {x:box.x+box.width/2,y:box.y+box.height/2};};
 const drag=async(from,to)=>{await p.mouse.move(from.x,from.y);await p.mouse.down();await p.mouse.move(from.x+8,from.y+3,{steps:3});await p.mouse.move(to.x,to.y,{steps:16});await p.waitForTimeout(150);await p.mouse.up();await settle();};
 const shown=block=>p.evaluate(block=>[...document.querySelectorAll(`.block.${block} .cards > .asset-card`)].filter(el=>el.style.display!=='none'&&el.style.visibility!=='hidden').map(el=>el.dataset.asset),block);
 const undo=()=>p.keyboard.press(process.platform==='darwin'?'Meta+z':'Control+z');
 try {
  await p.setViewportSize({width:1440,height:900});
  await p.goto('http://127.0.0.1:4317/');
  await p.evaluate(()=>{save=()=>{};const day=n=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);},ago=n=>new Date(Date.now()-n*36e5).toISOString();
   const asset=(id,type,name,extra={})=>({id,type,name,provider:'Test',account:'',purpose:'Order test',event:'',date:'',cost:'',art:'generic',url:'',source:'manual',...extra});
   // d0 is the most recent; stored order is shuffled; d19 is the oldest but due tomorrow.
   const domains=Array.from({length:20},(_,i)=>asset('d'+i,'domain','order-'+i+'.test',{updatedAt:ago(i+1),...(i===19?{date:day(1),dateKind:'expire'}:{})})).sort((a,b)=>(a.id.length-b.id.length)||(b.id<a.id?1:-1)).reverse();
   const repos=Array.from({length:10},(_,i)=>asset('r'+i,'repository','org/repo-'+i,{source:'github',externalId:'x'+i,updatedAt:ago(i+1)}));
   const legacy=['l2','l0','l1'].map(id=>asset(id,'server','legacy-'+id));
   state={blocks:[{id:'domain',width:100,height:null,density:'full',folded:false},{id:'repository',width:100,height:null,density:'full',folded:false},{id:'server',width:100,height:null,density:'full',folded:false}],assets:[...domains,...repos,...legacy],deletedExternalIds:[]};history=[];render();});
  await settle();
  let ids=await shown('domain');
  check(ids.join()==='d0,d1,d2,d3,d4,d5,d6,d7,d8,d9,d10,d11','Board shows the 12 most recently updated: '+ids.join());
  check(!ids.includes('d19'),'Urgency does not pull a card into the display area');
  check(await p.locator('.agenda').innerText().then(t=>t.includes('order-19.test')),'Urgent card still reaches the agenda');
  check((await shown('server')).join()==='l2,l0,l1','Records without dates keep their stored order');
  // (b) 放到前面 / 恢复自动排序, keyboard and undo.
  await p.evaluate(()=>showDetail('d15'));
  const front=p.locator('#detail [data-action="pin-front"]');await front.focus();await p.keyboard.press('Enter');await settle();
  ids=await shown('domain');
  check(ids[0]==='d15'&&ids[1]==='d0'&&ids.length===12,'放到前面 puts the card first and the rest follow recency: '+ids.join());
  check(await p.evaluate(()=>JSON.stringify(state.cardOrder.domain))==='["d15"]','Only the chosen card becomes manual order');
  check(await p.locator('#detail [data-action="auto-order"]').isVisible(),'Detail offers 恢复自动排序');
  await p.evaluate(()=>closeDetail());await undo();await settle();
  check((await shown('domain'))[0]==='d0'&&!(await p.evaluate(()=>state.cardOrder?.domain?.length)),'⌘Z undoes 放到前面');
  await p.evaluate(()=>showDetail('d15'));await p.click('#detail [data-action="pin-front"]');await settle();
  await p.click('#detail [data-action="auto-order"]');await settle();
  check((await shown('domain'))[0]==='d0'&&await p.evaluate(()=>!state.cardOrder?.domain),'恢复自动排序 clears the manual order');
  check(!(await p.locator('#detail [data-action="auto-order"]').count()),'恢复自动排序 hides once nothing is manual');
  await p.evaluate(()=>closeDetail());
  // A newer record goes first without touching the manual order.
  await p.evaluate(()=>{state.assets.push({id:'fresh',type:'domain',name:'fresh.test',provider:'Test',account:'',purpose:'',source:'manual',art:'generic',createdAt:new Date().toISOString()});render();});await settle();
  check((await shown('domain'))[0]==='fresh','A just-added record shows first');
  await p.evaluate(()=>{state.assets=state.assets.filter(a=>a.id!=='fresh');render();});await settle();
  // (a) Full view: drag a card from below the divider onto one above it (tall window so both are on screen).
  await p.setViewportSize({width:1440,height:1500});await settle();
  await p.click('.block.domain [data-action="all"]');await settle();
  const divider=await p.evaluate(()=>{const grid=document.querySelector('.block.domain .cards'),d=grid.querySelector('.limit-divider');return d?[...grid.children].indexOf(d):-1;});
  check(divider===12,'Full view divider sits after the board display area: '+divider);
  await drag(await center(p.locator('.block.domain [data-asset="d15"]')),await center(p.locator('.block.domain [data-asset="d2"]')));
  await p.click('[data-action="back"]');await settle();
  ids=await shown('domain');
  check(ids[2]==='d15'&&!ids.includes('d2'),'Swap brings the card into the display area at the target position: '+ids.join());
  check(await p.evaluate(()=>{const all=[...document.querySelectorAll('.block.domain .cards > .asset-card')].map(el=>el.dataset.asset);return all.indexOf('d2')===15;}),'The replaced card takes the dragged card’s old place');
  check(await p.evaluate(()=>state.cardOrder.domain.length===16),'Swap stores only the touched prefix');
  await undo();await settle();
  check((await shown('domain'))[2]==='d2','⌘Z undoes a swap');
  // Within one side of the divider, dragging still reorders.
  await p.click('.block.domain [data-action="all"]');await settle();
  await drag(await center(p.locator('.block.domain [data-asset="d3"]')),await center(p.locator('.block.domain [data-asset="d0"]')));
  check(await p.evaluate(()=>{const ids=[...document.querySelectorAll('.block.domain .cards > .asset-card')].map(el=>el.dataset.asset);return ids.indexOf('d3')<ids.indexOf('d1')&&ids.length===20;}),'Reorder above the divider still works');
  await p.click('[data-action="back"]');await settle();await undo();await settle();
  await p.setViewportSize({width:1440,height:900});await p.evaluate(()=>scrollTo(0,0));await settle();
  // (a) Board repositories: drag a list tile onto a featured card.
  const featured=await shown('repository');
  check(featured.length===4&&featured.join()==='r0,r1,r2,r3','Repositories feature the most recent in whole rows: '+featured.join());
  const tile=p.locator('.block.repository .compact-repo[data-asset="r8"]');
  await p.evaluate(()=>document.querySelector('.block.repository').scrollIntoView({block:'center'}));await settle();
  await drag(await center(tile),await center(p.locator('.block.repository .cards > .asset-card[data-asset="r1"]')));
  const after=await shown('repository');
  check(after[1]==='r8'&&!after.includes('r1'),'List tile swaps into the featured card: '+after.join());
  check(await p.evaluate(()=>!!document.querySelector('.block.repository .compact-repo[data-asset="r1"],.block.repository .compact-repo[data-spill="r1"]')),'Swapped-out repository moves to the list');
  check(!(await p.locator('.swap-target,.drop-slot,.is-dragging').count()),'Drag leaves no swap marks behind');
  await undo();await settle();
  check((await shown('repository')).join()==='r0,r1,r2,r3','⌘Z undoes the repository swap');
  check(!errors.length,'Page errors: '+errors.join(' | '));
  return 'PASS: recency display order, urgency never promotes, stored order without dates, 放到前面 by keyboard with undo, 恢复自动排序, new record first, full-view divider and swap with undo, reorder above divider, repository list-to-featured swap with undo';
 } finally { await p.close(); }
}
