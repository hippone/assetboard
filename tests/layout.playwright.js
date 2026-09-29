// Run with the browser tool's filename option. Uses an isolated page and never saves.
async (page) => {
 const p=await page.context().newPage();
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const errors=[];p.on('pageerror',error=>errors.push(error.message));
 const settle=()=>p.waitForTimeout(450);
 const center=async selector=>{const box=await p.locator(selector).boundingBox();return {x:box.x+box.width/2,y:box.y+box.height/2};};
 const drag=async(from,to,{hold}={})=>{await p.mouse.move(from.x,from.y);await p.mouse.down();await p.mouse.move(from.x+8,from.y+3,{steps:3});await p.mouse.move(to.x,to.y,{steps:16});await p.waitForTimeout(120);if(hold)await hold();await p.mouse.up();await settle();};
 const order=selector=>p.evaluate(selector=>[...document.querySelectorAll(selector)].map(element=>element.dataset.asset||element.dataset.block).join(','),selector);
 const clean=()=>p.evaluate(()=>!document.querySelector('.drop-slot,.is-dragging,.drop-into,.drop-refused')&&!document.body.classList.contains('drag-active'));
 try {
  await p.setViewportSize({width:1280,height:900});
  await p.route('**/*',route=>route.continue());
  await p.goto('http://127.0.0.1:4317/');
  await p.evaluate(()=>{save=()=>{};const asset=(id,type,name,extra={})=>({id,type,name,provider:'Test',account:'',purpose:'Layout test',event:'',date:'',cost:'',art:'generic',url:'',source:'manual',...extra});
   state={blocks:[{id:'domain',width:50,collapsed:false,height:null},{id:'server',width:50,collapsed:false,height:null},{id:'subscription',width:50,collapsed:false,height:null}],assets:[asset('d1','domain','one.example'),asset('d2','domain','two.example'),asset('d3','domain','three.example'),asset('d4','domain','four.example'),asset('d5','domain','five.example'),asset('cf','domain','zone.example',{source:'cloudflare'}),asset('s1','server','box.example'),asset('u1','subscription','tool.example')]};render();});
  await settle();

  // A click still opens details; a drag never does.
  await p.locator('[data-asset="d1"] .card-open').click();
  check(await p.locator('#detail').isVisible(),'Click must open details');
  await p.keyboard.press('Escape');

  // Card reorder follows the pointer, with the drop previewed by a placeholder.
  const d1=await center('[data-asset="d1"]'),d3=await center('[data-asset="d3"]');
  await drag(d1,{x:d3.x+40,y:d3.y},{hold:async()=>check(await p.locator('.domain .drop-slot').count()===1,'Dragging must leave one placeholder')});
  check((await order('.domain [data-asset]')).startsWith('d2,d3,d1'),'Card drag must reorder within the block');
  check(await p.locator('#detail').isHidden(),'A drag must not open details');
  check(await clean(),'Drag state must be cleaned up');

  // Esc cancels: nothing moves and nothing opens.
  const before=await order('.domain [data-asset]');
  await drag(await center('[data-asset="d2"]'),await center('[data-asset="d5"]'),{hold:()=>p.keyboard.press('Escape')});
  check(await order('.domain [data-asset]')===before,'Esc must cancel the drag');
  check(await p.locator('#detail').isHidden(),'Cancelled drag must not open details');

  // Dragging a card onto another block changes its category; synced assets are refused.
  await drag(await center('[data-asset="d5"]'),await center('.block.server'),{hold:async()=>{check(await p.locator('.block.server.drop-into').count()===1,'Target block must be highlighted');check((await p.locator('.float-tip').textContent()).includes('服务器'),'Tip must name the target block');}});
  check(await p.evaluate(()=>state.assets.find(a=>a.id==='d5').type)==='server','Cross-block drop must change the category');
  check(await p.locator('.block.server [data-asset="d5"]').count()===1,'Moved card must render in the target block');
  await drag(await center('[data-asset="cf"]'),await center('.block.server'),{hold:async()=>check(await p.locator('.block.server.drop-refused').count()===1,'Synced asset must show a refusal')});
  check(await p.evaluate(()=>state.assets.find(a=>a.id==='cf').type)==='domain','Synced asset must keep its category');
  check(await clean(),'Refused drag must be cleaned up');

  // Block reorder by dragging the header, no layout mode.
  const head=await p.locator('.block.subscription .block-head').boundingBox();
  const domainHead=await p.locator('.block.domain .block-head').boundingBox();
  await drag({x:head.x+head.width-120,y:head.y+head.height/2},{x:domainHead.x+60,y:domainHead.y+domainHead.height/2});
  check((await order('#board > .block')).startsWith('subscription'),'Header drag must reorder blocks');

  // Keyboard: Option + arrows move the focused card or block.
  await p.locator('[data-asset="d3"] .card-open').focus();
  await p.keyboard.press('Alt+ArrowLeft');await settle();
  check((await order('.domain [data-asset]')).startsWith('d3,d2'),'Option + Left must move the card earlier');
  check(await p.evaluate(()=>document.activeElement?.closest('[data-asset]')?.dataset.asset)==='d3','Focus must stay on the moved card');
  await p.locator('.block.subscription .block-title').focus();
  await p.keyboard.press('Alt+ArrowRight');await settle();
  check((await order('#board > .block')).startsWith('domain,subscription'),'Option + Right must move the block later');

  // Right edge follows the pointer (⌘ disables snapping), and snaps to 2/3 without it.
  const edge=async(id,axis)=>p.locator(`.block.${id} > .resize-edge[data-edge="${axis}"]`).boundingBox();
  let x=await edge('domain','x');const width=(await p.locator('.block.domain').boundingBox()).width;
  await p.keyboard.down('Meta');await drag({x:x.x+4,y:x.y+x.height/2},{x:x.x+4+37,y:x.y+x.height/2});await p.keyboard.up('Meta');
  check(Math.abs((await p.locator('.block.domain').boundingBox()).width-width-37)<1,'Resize must follow the pointer within one pixel');
  const target=await p.evaluate(()=>{const board=document.querySelector('#board'),style=getComputedStyle(board),inner=board.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);return {inner,left:document.querySelector('.block.domain').getBoundingClientRect().left};});
  x=await edge('domain','x');
  await drag({x:x.x+4,y:x.y+x.height/2},{x:target.left+(2/3)*(target.inner+4)-4,y:x.y+x.height/2});
  check(Math.abs(await p.evaluate(()=>state.blocks.find(b=>b.id==='domain').width)-66.7)<.05,'Width must snap to 2/3 when released 5px past it');
  check(await p.evaluate(async()=>{const node=document.querySelector('.domain');window.dispatchEvent(new Event('resize'));await new Promise(requestAnimationFrame);return node===document.querySelector('.domain');}),'Window resize must preserve DOM nodes');

  // Bottom edge fixes the height by whole rows, pulling past the content returns to auto, double-click restores auto.
  let y=await edge('domain','y');
  await drag({x:y.x+y.width/2,y:y.y+4},{x:y.x+y.width/2,y:y.y-160});
  check(await p.evaluate(()=>state.blocks.find(b=>b.id==='domain').height)>0,'Bottom edge must set a fixed height');
  check(await p.locator('.block.domain.fixed [data-action="all"]').isVisible(),'Hidden cards must offer 查看全部');
  y=await edge('domain','y');
  await drag({x:y.x+y.width/2,y:y.y+4},{x:y.x+y.width/2,y:y.y+400});
  check(await p.evaluate(()=>state.blocks.find(b=>b.id==='domain').height)===null,'Pulling past the content must return to auto height');
  y=await edge('domain','y');
  await drag({x:y.x+y.width/2,y:y.y+4},{x:y.x+y.width/2,y:y.y-160});
  y=await edge('domain','y');
  await p.mouse.dblclick(y.x+y.width/2,y.y+4);await settle();
  check(await p.evaluate(()=>state.blocks.find(b=>b.id==='domain').height)===null,'Double-click must restore auto height');

  // Restoring the last hidden asset returns the block to its normal view.
  await p.evaluate(()=>{state.assets.find(a=>a.id==='d4').hiddenAt='2026-09-01';render();});await settle();
  await p.locator('[data-action="toggle-hidden"][data-id="domain"]').click();
  await p.locator('.block.domain [data-asset="d4"] [data-action="restore-asset"]').click({force:true});await settle();
  check(await p.locator('.block.domain.showing-hidden').count()===0,'Restoring the last hidden asset must leave the hidden view');
  check(await p.evaluate(()=>document.activeElement?.closest('[data-asset]')?.dataset.asset)==='d4','Focus must move to the restored card');
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.locator('[data-action="collapse"][data-id="domain"]').click();
  check(await p.locator('.domain .asset-card').first().evaluate(e=>e.offsetHeight<60),'Compact card must shrink');
  check(await p.evaluate(()=>document.getAnimations().length===0),'Reduced motion must disable layout animation');
  await p.setViewportSize({width:390,height:844});
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow');
  check(!errors.length,'Page errors: '+errors.join(' | '));
  return 'PASS: click vs drag, hidden view exit after last restore, card and block reorder, cross-block move and refusal, Esc cancel, keyboard move, edge resize with snapping and auto height, stable resize DOM, compact cards, reduced motion, mobile bounds';
 } finally { await p.close(); }
}
