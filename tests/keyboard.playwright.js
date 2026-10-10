// Run with the browser tool's filename option. Keyboard map (search, focus moves, detail, hide, 放到前面, swaps, undo/redo, forms, help overlay) and category quick actions; never saves.
async (page) => {
 const p=await page.context().newPage();
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const errors=[];p.on('pageerror',error=>errors.push(error.message));
 const settle=()=>p.waitForTimeout(300);
 const mod=process.platform==='darwin'?'Meta':'Control';
 const focused=()=>p.evaluate(()=>{const el=document.activeElement;return {id:el?.closest?.('[data-asset]')?.dataset.asset||'',cls:el?.className||'',tag:el?.tagName||'',block:el?.closest?.('.block')?.dataset.block||''};});
 const order=block=>p.evaluate(block=>[...document.querySelectorAll(`.block.${block} .cards > .asset-card`)].filter(el=>el.style.display!=='none').map(el=>el.dataset.asset),block);
 const key=async k=>{await p.keyboard.press(k);await settle();};
 try {
  await p.setViewportSize({width:1440,height:900});
  await p.goto('http://127.0.0.1:4317/');
  await p.evaluate(()=>{save=()=>{};window.__copied=[];copyText=(text,done)=>{window.__copied.push(text);toast(done);};window.__opened=[];window.open=url=>{window.__opened.push(url);};
   const ago=n=>new Date(Date.now()-n*36e5).toISOString();
   const asset=(id,type,name,extra={})=>({id,type,name,provider:'Test',account:'',purpose:'Keyboard test',event:'',date:'',cost:'',art:'generic',url:'',source:'manual',...extra});
   const domains=Array.from({length:16},(_,i)=>asset('d'+i,'domain','key-'+i+'.test',{updatedAt:ago(i+1),url:i===0?'https://dash.example.org/key-0':''}));
   const servers=[asset('s0','server','vps-a',{updatedAt:ago(1),host:'203.0.113.10',sshUser:'deploy',url:'https://console.example.org/a'}),asset('s1','server','vps-b',{updatedAt:ago(2),host:'198.51.100.24',sshPort:'2222'}),asset('s2','server','nas',{updatedAt:ago(3)})];
   const repos=[asset('r0','repository','demo-org/site',{updatedAt:ago(1),url:'https://github.com/demo-org/site',source:'github',externalId:'1'})];
   state={blocks:[{id:'domain',width:50,height:null,density:'full',folded:false},{id:'server',width:50,height:null,density:'full',folded:false},{id:'repository',width:100,height:null,density:'full',folded:false}],assets:[...domains,...servers,...repos],deletedExternalIds:[]};history=[];future=[];render();});
  await settle();

  // Help overlay and search.
  await key('Shift+Slash');
  check(await p.locator('#keys-help:not([hidden]) .keys-card').count()===1,'? opens the shortcut overlay');
  check(await p.evaluate(()=>{const s=getComputedStyle(document.querySelector('.keys-card'));return parseFloat(s.animationDuration)<=.2;}),'Overlay motion stays within 0.2s');
  await key('Escape');
  check(await p.locator('#keys-help').isHidden(),'Esc closes the overlay');
  await key('Slash');
  check(await p.evaluate(()=>document.activeElement.id==='search'),'/ focuses search');
  await p.keyboard.type('nhfx');await settle();
  check(!(await p.evaluate(()=>document.querySelector('#modal').open))&&(await p.inputValue('#search'))==='nhfx','Letters typed into search are not captured');
  await key('Escape');check((await p.inputValue('#search'))==='','Esc clears the search first');
  await key('Escape');
  await key(`${mod}+k`);
  check(await p.evaluate(()=>document.activeElement.id==='search'),'⌘K focuses search');
  await key('ArrowDown');
  let f=await focused();check(f.id==='d0','↓ in search jumps to the first card: '+JSON.stringify(f));
  check(await p.evaluate(()=>getComputedStyle(document.activeElement.closest('.asset-card')).outlineStyle==='solid'),'Keyboard focus draws a ring around the whole card');

  // Arrow navigation inside and across blocks.
  await key('ArrowRight');f=await focused();check(f.id==='d1','→ moves to the next card in the block');
  await key('ArrowLeft');await key('ArrowLeft');f=await focused();check(f.id==='d0','← walks back and stops at the first card: '+JSON.stringify(f));
  const rightmost=await p.evaluate(()=>{const cards=[...document.querySelectorAll('.block.domain .cards > .asset-card')].filter(el=>el.style.display!=='none');const top=cards[0].getBoundingClientRect().top;return cards.filter(el=>Math.abs(el.getBoundingClientRect().top-top)<2).pop().dataset.asset;});
  await p.focus(`.block.domain [data-asset="${rightmost}"] .card-open`);
  await key('ArrowRight');f=await focused();check(f.block==='domain'&&f.id!==rightmost,'→ at the end of a row wraps inside the block');
  await p.focus(`.block.domain [data-asset="${rightmost}"] .card-open`);
  for(let i=0;i<8&&(await focused()).block==='domain';i++)await key('ArrowDown');
  f=await focused();check(f.block==='repository','↓ leaves the block for the one below: '+JSON.stringify(f));

  // Enter opens the detail, Esc closes it and returns focus.
  await p.focus('.block.server [data-asset="s0"] .card-open');
  await key('Enter');check(await p.locator('#detail').isVisible(),'Enter opens the detail');
  check(await p.locator('#detail .quick-row [data-quick="copy-ip"]').count()===1,'Detail lists the quick actions beyond the card');
  await key('Escape');check(await p.locator('#detail').isHidden(),'Esc closes the detail');
  f=await focused();check(f.id==='s0','Focus returns to the card');

  // Quick actions: at most two, only on hover/focus, keyboard O and ⌘C.
  check(await p.locator('.block.server [data-asset="s0"] .quick-action').count()===2,'Server card shows two quick actions');
  check(await p.locator('.block.server [data-asset="s2"] .quick-action').count()===0,'No quick actions without a link or host');
  check(await p.evaluate(()=>getComputedStyle(document.querySelector('[data-asset="s1"] .quick-action')).opacity==='0'),'Quick actions stay hidden until hover or focus');
  check(await p.evaluate(()=>getComputedStyle(document.querySelector('[data-asset="s0"] .quick-action')).opacity==='1'),'Focusing a card reveals its quick actions');
  await key(`${mod}+c`);
  check((await p.evaluate(()=>window.__copied)).join()==='ssh deploy@203.0.113.10','⌘C on a server copies the SSH command');
  await key('o');
  check((await p.evaluate(()=>window.__opened)).join()==='https://console.example.org/a','O opens the console link');
  await p.focus('.block.repository [data-asset="r0"] .card-open');await key(`${mod}+c`);
  check((await p.evaluate(()=>window.__copied)).pop()==='https://github.com/demo-org/site.git','⌘C on a repository copies the clone URL');

  // 放到前面, undo and redo.
  await p.focus('.block.domain [data-asset="d3"] .card-open');
  await key('f');
  check((await order('domain'))[0]==='d3','F puts the card first');
  f=await focused();check(f.id==='d3','Focus follows the card');
  await key(`${mod}+z`);check((await order('domain'))[0]==='d0','⌘Z undoes 放到前面');
  await key(`${mod}+Shift+z`);check((await order('domain'))[0]==='d3','⇧⌘Z redoes it');
  await key(`${mod}+z`);

  // ⌥→ swaps with the neighbour.
  await p.focus('.block.domain [data-asset="d0"] .card-open');
  await key('Alt+ArrowRight');
  check((await order('domain')).slice(0,2).join()==='d1,d0','⌥→ swaps with the neighbour');
  await key(`${mod}+z`);

  // Hide moves focus to the neighbour; restore from the hidden view.
  await p.focus('.block.domain [data-asset="d1"] .card-open');
  await key('h');
  check(await p.evaluate(()=>!!state.assets.find(a=>a.id==='d1').hiddenAt),'H hides the card');
  f=await focused();check(f.id==='d2','Focus moves to the next card after hiding: '+f.id);
  await p.click('.block.domain [data-action="toggle-hidden"]');await settle();
  check(await p.locator('.block.domain .flip-card .quick-action').count()===0,'Hidden flip cards show no quick actions');
  await p.focus('.block.domain .flip-card[data-asset="d1"] .flip-actions .button');
  await key('h');
  check(await p.evaluate(()=>!state.assets.find(a=>a.id==='d1').hiddenAt),'H on a hidden card restores it');
  await p.evaluate(()=>{showHiddenBlocks.clear();render();});await settle();

  // X swaps two cards across the divider in 查看全部.
  await p.click('.block.domain [data-action="all"]');await settle();
  const shownCount=await p.evaluate(()=>[...document.querySelector('.block.domain .cards').children].indexOf(document.querySelector('.block.domain .limit-divider')));
  check(shownCount>0,'Full view shows the divider');
  const ids=await p.evaluate(()=>[...document.querySelectorAll('.block.domain .cards > .asset-card')].map(el=>el.dataset.asset));
  const below=ids[ids.length-1];
  await p.focus(`.block.domain [data-asset="${below}"] .card-open`);await key('x');
  check(await p.locator('.swap-mark').count()===1,'X marks the first card');
  await p.focus('.block.domain [data-asset="d0"] .card-open');await key('x');
  const swapped=await p.evaluate(()=>[...document.querySelectorAll('.block.domain .cards > .asset-card')].map(el=>el.dataset.asset));
  check(swapped[0]===below&&swapped[swapped.length-1]==='d0','Second X swaps the pair across the divider: '+swapped.join());
  check(!(await p.locator('.swap-mark').count()),'The swap mark is cleared');
  f=await focused();check(f.id==='d0','Focus stays on the card where X was pressed');
  await key(`${mod}+z`);
  await key('Escape');check(await p.evaluate(()=>focusCategory===null),'Esc leaves 查看全部');

  // N creates an asset in the focused block; ⌘Enter saves, Esc closes.
  await p.focus('.block.server [data-asset="s1"] .card-open');
  await key('n');
  check(await p.evaluate(()=>document.querySelector('#asset-form')?.dataset.type==='server'),'N opens the form for the focused block');
  await p.fill('#asset-form [name="name"]','vps-new');await p.fill('#asset-form [name="host"]','bad host');
  await key(`${mod}+Enter`);
  check(await p.evaluate(()=>document.querySelector('#modal').open&&!state.assets.some(a=>a.name==='vps-new')),'Invalid host blocks saving');
  await p.fill('#asset-form [name="host"]','192.0.2.5');
  await key(`${mod}+Enter`);
  check(await p.evaluate(()=>!document.querySelector('#modal').open&&state.assets.find(a=>a.name==='vps-new')?.host==='192.0.2.5'),'⌘Enter saves the form with the host');
  await p.evaluate(()=>document.querySelector('#board').focus?.());await p.evaluate(()=>document.activeElement.blur());
  await key('n');
  check(await p.evaluate(()=>document.querySelector('#modal').open&&!document.querySelector('#asset-form')),'N outside a block asks for the category first');
  await key('Escape');
  check(!(await p.evaluate(()=>document.querySelector('#modal').open)),'Esc closes the dialog');
  await p.focus('.block.server [data-asset="s0"] .card-open');await key('e');
  check(await p.evaluate(()=>document.querySelector('#asset-form')?.dataset.id==='s0'),'E edits the focused card');
  await key('h');
  check(await p.evaluate(()=>!state.assets.find(a=>a.id==='s0').hiddenAt),'Letters inside the form are not captured');
  await key('Escape');

  check(!errors.length,'Page errors: '+errors.join(' | '));
  return 'PASS: ? overlay, / and ⌘K search, ↓ from search, arrow focus within and across blocks with a focus ring, Enter/Esc detail, quick actions (two max, hover/focus only, ⌘C copy, O open, none on flip cards), F with ⌘Z/⇧⌘Z, ⌥→ swap, H hide and restore with focus, X swap across the divider, N/E forms with ⌘Enter and validation';
 } finally { await p.close(); }
}
