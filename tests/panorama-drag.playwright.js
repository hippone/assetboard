// v13b P4: drag a chip onto another server (move here / ⌥ also here / unmounted strip = unlink), cancel paths, undo, focused state, keyboard twin.
async (page) => {
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const context=await page.context().browser().newContext({viewport:{width:1320,height:822}});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://127.0.0.1:4317/?demo');await p.waitForFunction(()=>typeof panoramaOpen==='function');await p.waitForTimeout(300);
  const servers=id=>p.evaluate(i=>serverChain(state.assets,state.assets.find(a=>a.id===i)).servers.map(s=>s.id).sort().join(),id);
  const center=async sel=>{const b=await p.locator(sel).first().boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2,b};};
  const history0=()=>p.evaluate(()=>history.length);
  const open=async()=>{if(await p.evaluate(()=>document.querySelector('#panorama').hidden))await p.keyboard.press('p');await p.waitForTimeout(200);};
  await open();
  check(await servers('demo-d2')==='demo-s1','Start: notes-lab.dev sits on tokyo-vps');
  // A press with a small wobble is still a click: it opens the detail and nothing moves.
  let c=await center('.pano-chip[data-chip="demo-d2"][data-lane="demo-s1"]');
  await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(c.x+2,c.y+1);await p.mouse.up();await p.waitForTimeout(150);
  check(await p.evaluate(()=>!document.querySelector('#detail').hidden&&document.querySelector('#detail h2').textContent==='notes-lab.dev'),'Under 4px is a click, not a drag');
  await p.keyboard.press('Escape');await p.waitForTimeout(150);
  // Drag to frankfurt-vps: lifted ghost, dashed hole, legal lanes bright and the rest at 55%, a slot in the target, then the drop moves it.
  const h0=await history0();
  c=await center('.pano-chip[data-chip="demo-d2"][data-lane="demo-s1"]');
  const t=await center('.pano-lane[data-lane="demo-s2"]');
  await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(c.x+30,c.y+10,{steps:3});await p.mouse.move(t.x,t.y,{steps:8});await p.waitForTimeout(250);
  const mid=await p.evaluate(()=>({ghost:!!document.querySelector('.pano-ghost'),hole:!!document.querySelector('.pano-chip.drag-hole'),dragging:document.querySelector('#panorama').classList.contains('dragging'),on:document.querySelector('.drop-on')?.dataset.lane,slot:!!document.querySelector('.pano-lane[data-lane="demo-s2"] .pano-slot'),dim:getComputedStyle(document.querySelector('.pano-lane[data-lane="demo-s1"]')).opacity,bright:getComputedStyle(document.querySelector('.pano-lane[data-lane="demo-s2"]')).opacity,shadow:getComputedStyle(document.querySelector('.pano-ghost')).boxShadow!=='none',live:document.querySelector('#pano-live').textContent}));
  check(mid.ghost&&mid.hole&&mid.dragging&&mid.on==='demo-s2'&&mid.slot,'Lifted ghost, hole, snapped target with a slot: '+JSON.stringify(mid));
  check(mid.dim==='0.55'&&mid.bright==='1'&&mid.shadow,'Others at 55%, target bright, ghost raised: '+JSON.stringify(mid));
  check(/移到 frankfurt-vps/.test(mid.live),'The move is announced: '+mid.live);
  await p.mouse.up();await p.waitForTimeout(250);
  check(await servers('demo-d2')==='demo-s2','Dropped: now on frankfurt-vps only');
  check(await p.evaluate(()=>document.querySelector('#detail').hidden&&!document.querySelector('.pano-ghost')&&!document.querySelector('.dragging')&&!document.querySelector('.drag-hole')),'No detail from the drop, ghost and states cleaned up');
  check(await p.evaluate(()=>/已移到 frankfurt-vps/.test(document.querySelector('#toast').textContent)&&!!document.querySelector('#toast .toast-undo')),'Toast with undo');
  check(await history0()===h0+1,'One drag is one undo step');
  await p.keyboard.press('Control+z');await p.waitForTimeout(250);
  check(await servers('demo-d2')==='demo-s1','⌘Z puts it back');
  // ⌥ at the drop = also here.
  c=await center('.pano-chip[data-chip="demo-d2"][data-lane="demo-s1"]');const t2=await center('.pano-lane[data-lane="demo-s2"]');
  await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(t2.x,t2.y,{steps:10});await p.keyboard.down('Alt');await p.mouse.up();await p.keyboard.up('Alt');await p.waitForTimeout(250);
  check(await servers('demo-d2')==='demo-s1,demo-s2','⌥ drop keeps the old server and adds the new one');
  check(await p.evaluate(()=>/也挂到 frankfurt-vps/.test(document.querySelector('#toast').textContent)),'Toast says also');
  await p.keyboard.press('Control+z');await p.waitForTimeout(250);
  // Onto the unmounted strip: unlinks from the lane it left.
  c=await center('.pano-chip[data-chip="demo-d2"][data-lane="demo-s1"]');const lz=await center('.pano-loose');
  await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(lz.x,lz.y,{steps:10});await p.waitForTimeout(150);
  check(await p.evaluate(()=>document.querySelector('.pano-loose').classList.contains('drop-on')),'The unmounted strip is a target');
  await p.mouse.up();await p.waitForTimeout(250);
  check(await servers('demo-d2')===''&&await p.evaluate(()=>!!document.querySelector('.pano-loose-chips [data-chip="demo-d2"]')||!!document.querySelector('[data-loose-more]')),'Unlinked and now unmounted');
  await p.keyboard.press('Control+z');await p.waitForTimeout(250);
  check(await servers('demo-d2')==='demo-s1','Undo relinks');
  // Cancel paths: Esc mid-drag, drop in empty space, drop back on the origin lane. State never changes.
  const snap=()=>p.evaluate(()=>JSON.stringify(state.assets.map(a=>[a.id,a.links])));const before=await snap();const h1=await history0();
  c=await center('.pano-chip[data-chip="demo-d2"][data-lane="demo-s1"]');
  await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(t.x,t.y,{steps:6});await p.keyboard.press('Escape');await p.waitForTimeout(250);
  check(await p.evaluate(()=>!document.querySelector('.pano-ghost')&&!document.querySelector('.dragging')&&!document.querySelector('#panorama').hidden),'Esc cancels the drag and keeps the overview open');
  await p.mouse.up();await p.waitForTimeout(100);
  c=await center('.pano-chip[data-chip="demo-d2"][data-lane="demo-s1"]');
  await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(700,28,{steps:6});
  check(await p.evaluate(()=>!document.querySelector('.drop-on')),'Nothing snaps in empty space');await p.mouse.up();await p.waitForTimeout(300);
  c=await center('.pano-chip[data-chip="demo-d2"][data-lane="demo-s1"]');const origin=await center('.pano-lane[data-lane="demo-s1"]');
  await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(origin.x,origin.y+40,{steps:6});
  check(await p.evaluate(()=>!document.querySelector('.drop-on')),'The lane it came from is not a target');await p.mouse.up();await p.waitForTimeout(300);
  check(await snap()===before&&await history0()===h1,'Cancelled drags change nothing and leave no undo step');
  // From the unmounted strip onto a lane: attaches (no detach target when it came from there).
  const looseId=await p.evaluate(()=>document.querySelector('.pano-loose-chips .pano-chip').dataset.chip);
  c=await center(`.pano-loose .pano-chip[data-chip="${looseId}"]`);const t3=await center('.pano-lane[data-lane="demo-s3"]');
  await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(t3.x,t3.y,{steps:10});
  check(await p.evaluate(()=>!document.querySelector('.pano-loose').classList.contains('drop-ok')),'Coming from the strip there is no unlink target');
  await p.mouse.up();await p.waitForTimeout(250);
  check(await servers(looseId)==='demo-s3','Dropped from the strip onto home-nas');
  await p.keyboard.press('Control+z');await p.waitForTimeout(200);
  // Focused state: drop on a rail entry.
  await p.click('[data-lane-head="demo-s1"]');await p.waitForTimeout(300);
  c=await center('.pf-col .pano-chip[data-chip="demo-d2"]');const rail=await center('.pf-srv[data-pick="demo-s2"]');
  await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(rail.x,rail.y,{steps:10});await p.waitForTimeout(150);
  check(await p.evaluate(()=>document.querySelector('.drop-on')?.dataset.pick==='demo-s2'),'A rail entry is a target in the focused state');
  await p.mouse.up();await p.waitForTimeout(250);
  check(await servers('demo-d2')==='demo-s2'&&await p.evaluate(()=>document.querySelector('.pano-hero').dataset.hero==='demo-s1'&&!document.querySelector('.pf-col .pano-chip[data-chip="demo-d2"]')),'Moved off the hero server; the hero stays');
  await p.keyboard.press('Control+z');await p.waitForTimeout(250);
  // Keyboard twin: L outlines the legal servers, arrows choose, Enter moves, ⌥Enter also, Esc cancels.
  await p.keyboard.press('Escape');await p.waitForTimeout(200);
  await p.focus('.pano-chip[data-chip="demo-d2"][data-lane="demo-s1"]');await p.keyboard.press('l');await p.waitForTimeout(100);
  const kb=await p.evaluate(()=>({ok:[...document.querySelectorAll('.drop-ok')].map(n=>n.dataset.lane||(n.classList.contains('pano-loose')?'loose':'?')),on:document.querySelector('.drop-on')?.dataset.lane,live:document.querySelector('#pano-live').textContent}));
  check(kb.ok.join()==='demo-s2,demo-s3,loose'&&kb.on==='demo-s2','L outlines frankfurt, home-nas and the strip, the first one chosen: '+JSON.stringify(kb));
  await p.keyboard.press('ArrowRight');check(await p.evaluate(()=>document.querySelector('.drop-on').dataset.lane)==='demo-s3','→ chooses the next');
  await p.keyboard.press('Escape');await p.waitForTimeout(100);
  check(await servers('demo-d2')==='demo-s1'&&await p.evaluate(()=>!document.querySelector('.drop-ok')&&document.activeElement.dataset.chip==='demo-d2'),'Esc cancels and returns to the chip');
  await p.keyboard.press('l');await p.keyboard.press('Enter');await p.waitForTimeout(250);
  check(await servers('demo-d2')==='demo-s2','Enter moves it to the chosen server');
  await p.keyboard.press('Control+z');await p.waitForTimeout(250);
  await p.focus('.pano-chip[data-chip="demo-d2"][data-lane="demo-s1"]');await p.keyboard.press('l');await p.keyboard.press('Alt+Enter');await p.waitForTimeout(250);
  check(await servers('demo-d2')==='demo-s1,demo-s2','⌥Enter also hangs it there');
  await p.keyboard.press('Control+z');await p.waitForTimeout(200);
  // Reduced motion: a cancelled drag does not glide.
  await p.emulateMedia({reducedMotion:'reduce'});
  c=await center('.pano-chip[data-chip="demo-d2"][data-lane="demo-s1"]');
  await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(c.x+50,c.y+20,{steps:4});await p.keyboard.press('Escape');
  check(await p.evaluate(()=>!document.querySelector('.pano-ghost')),'Reduced motion: the ghost is gone at once');await p.mouse.up();
  // Board: L on a card opens the link picker (the manual path outside the panorama).
  await p.emulateMedia({reducedMotion:'no-preference'});await p.mouse.up();await p.keyboard.press('Escape');await p.waitForTimeout(200);if(await p.evaluate(()=>!document.querySelector('#panorama').hidden))await p.keyboard.press('Escape');await p.waitForTimeout(200);
  await p.focus('#board [data-asset="demo-d2"] .card-open');await p.keyboard.press('l');await p.waitForTimeout(200);
  check(await p.evaluate(()=>$('#modal').open&&/关联到/.test(document.querySelector('#modal').textContent)),'L on a board card opens the link picker');
  check(!errors.length,'No page errors: '+errors.join());
  return 'PASS: 4px threshold, lifted ghost + hole + slot + 55% dim, move/⌥ also/unmounted unlink, one undo step, cancel paths, from the strip, focused rail target, keyboard L twin, reduced motion';
 }finally{await context.close();}
}
