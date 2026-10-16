// v0.3.0 polish: first item selected on a wide window, status and amount in one column, the panorama in the middle column with a sidebar entry, idle servers in a row.
async (page) => {
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const browser=page.context().browser(),errors=[];
 const open=async(w,h)=>{const c=await browser.newContext({viewport:{width:w,height:h}});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4317/?demo');await p.waitForFunction(()=>typeof panoramaOpen==='function');await p.waitForTimeout(300);return {c,p};};
 let {c,p}=await open(1320,860);
 try{
  // Wide: the inspector is there from the start with the first row selected; focus did not move into it.
  const s=await p.evaluate(()=>({open:!document.querySelector('#detail').hidden,first:document.querySelector('#board [data-asset]').dataset.asset,selected:document.querySelector('#board .row.selected')?.dataset.asset,docked:document.body.classList.contains('inspecting'),focusIn:!!document.activeElement?.closest('#detail')}));
  check(s.open&&s.selected===s.first&&s.docked&&!s.focusIn,'Wide window opens with the first item in the docked inspector, focus untouched: '+JSON.stringify(s));
  // One right column: the amount sits under the status, right edges line up.
  const r=await p.evaluate(()=>{const row=document.querySelector('#board .row[data-asset="demo-s1"]'),d=row.querySelector('.r-date').getBoundingClientRect(),m=row.querySelector('.r-cost').getBoundingClientRect();return {below:m.top>=d.bottom-1,right:Math.abs(m.right-d.right)<2};});
  check(r.below&&r.right,'Amount stacks under the status in one right-aligned column: '+JSON.stringify(r));
  // Group heads lead the rhythm.
  check(await p.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.group-title')).fontSize)>=15),'Group titles are larger than rows');
  // Sidebar entry opens the panorama in the middle column; the sidebar stays.
  await p.click('#sidebar [data-action="panorama"]');await p.waitForTimeout(250);
  const q=await p.evaluate(()=>{const pano=document.querySelector('#panorama').getBoundingClientRect(),side=document.querySelector('#sidebar').getBoundingClientRect();return {open:!document.querySelector('#panorama').hidden,left:Math.round(pano.left),side:Math.round(side.width),sideVisible:getComputedStyle(document.querySelector('#sidebar')).visibility==='visible',active:document.querySelector('#sidebar [data-action="panorama"]').classList.contains('active'),bg:getComputedStyle(document.querySelector('#panorama')).backgroundColor,tm:Math.round(document.querySelector('.pano-tm').getBoundingClientRect().right)<=Math.round(pano.right)};});
  check(q.open&&q.left===q.side&&q.sideVisible&&q.active&&q.tm&&!/rgba\(0, 0, 0, 0\)/.test(q.bg),'Panorama fills the middle column on an opaque surface, sidebar entry active: '+JSON.stringify(q));
  // Idle servers: home-nas holds nothing, so it is a small card in the row under the map.
  const idle=await p.evaluate(()=>{const n=document.querySelector('.tm-lane.idle[data-lane="demo-s3"]');return n&&Math.round(n.getBoundingClientRect().height);});
  check(idle===40,'home-nas sits in the idle row as a 40px card: '+idle);
  // Server heads say only name and address.
  check(await p.evaluate(()=>!document.querySelector('.tm-lane .pl-state')&&!document.querySelector('.tm-lane .tm-n')&&/203\.0\.113\.10/.test(document.querySelector('.tm-lane[data-lane="demo-s1"] .pano-lane-head').textContent)),'Server heads: name and IP only');
  check(await p.evaluate(()=>!/→/.test(document.querySelector('.tm-leaf[data-chip="demo-r0"]').textContent)),'A repository on one server does not repeat that server');
  // Picking a view in the sidebar leaves the panorama.
  await p.click('#sidebar [data-id="domain"]');await p.waitForTimeout(250);
  check(await p.evaluate(()=>document.querySelector('#panorama').hidden&&document.querySelector('#view-title').textContent==='域名'),'A sidebar view closes the panorama and shows that view');
  await c.close();
  // Narrow: no automatic selection; the panorama covers the window and the strip folds into +N.
  ({c,p}=await open(900,720));
  check(await p.evaluate(()=>document.querySelector('#detail').hidden),'Below 1180 px nothing is selected on open');
  await p.keyboard.press('p');await p.waitForTimeout(250);
  const n=await p.evaluate(()=>{const strip=document.querySelector('.pano-loose-chips'),r=strip.getBoundingClientRect();return {fit:[...strip.children].every(x=>x.getBoundingClientRect().right<=r.right+1),more:document.querySelector('.pano-loose [data-loose-more]')?.textContent};});
  check(n.fit&&/^\+\d+$/.test(n.more||''),'Narrow strip shows what fits and +N: '+JSON.stringify(n));
  const g=await p.evaluate(()=>{const tm=document.querySelector('.pano-tm').getBoundingClientRect(),strip=document.querySelector('.pano-loose').getBoundingClientRect(),lanes=[...document.querySelectorAll('.tm-lane')].map(n=>n.getBoundingClientRect().bottom);return {clear:Math.max(...lanes)<=strip.top+1&&tm.bottom<=strip.top+1,active:[...document.querySelectorAll('#sidebar .nav-item.active')].map(n=>n.dataset.id).join()};});
  check(g.clear,'The map and its idle row stay above the unmounted strip: '+JSON.stringify(g));
  check(g.active==='panorama','Only the 全景 entry is active while it is open: '+g.active);
  check(!errors.length,'No page errors: '+errors.join());
  return 'PASS: first item selected on wide only, focus kept, status+amount column, group rhythm, panorama in the middle column with sidebar entry and opaque surface, idle row, name+IP heads, no repeated server, sidebar view leaves panorama, narrow strip +N';
 }finally{await c.close();}
}
