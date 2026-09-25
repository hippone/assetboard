// Run with the browser tool's filename option. Uses an isolated page and never saves.
async (page) => {
 const p=await page.context().newPage();
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 try {
  await p.route('**/*',route=>route.continue());
  await p.goto('http://127.0.0.1:4317/');
  await p.evaluate(()=>{save=()=>{};state=structuredClone(seed);render();});
  await p.locator('#edit').click();
  await p.waitForTimeout(300);
  const handle=await p.locator('.domain .resize-handle').boundingBox();
  const before=await p.locator('.domain').boundingBox();
  await p.mouse.move(handle.x+10,handle.y+10);
  await p.mouse.down();
  await p.mouse.move(handle.x+90,handle.y+40,{steps:20});
  await p.mouse.up();
  await p.waitForTimeout(300);
  const after=await p.locator('.domain').boundingBox();
  check(Math.abs(after.width-before.width-80)<1,'Resize must follow the pointer within one pixel');
  check(await p.evaluate(async()=>{const node=document.querySelector('.domain');window.dispatchEvent(new Event('resize'));await new Promise(requestAnimationFrame);return node===document.querySelector('.domain');}),'Window resize must preserve DOM nodes');
  await p.locator('.domain .drag-handle').dragTo(p.locator('.server'));
  check((await p.locator('.block').first().getAttribute('data-block'))==='server','Drag ordering failed');
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.locator('[data-action="collapse"][data-id="domain"]').click();
  check(await p.locator('.domain .asset-card').first().evaluate(e=>e.offsetHeight<60),'Compact card must shrink');
  check(await p.evaluate(()=>document.getAnimations().length===0),'Reduced motion must disable layout animation');
  await p.setViewportSize({width:390,height:844});
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow');
  return 'PASS: pointer geometry, stable resize DOM, reorder, compact cards, reduced motion, mobile bounds';
 } finally { await p.close(); }
}
