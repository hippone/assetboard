// v12: depth and de-duplication. Shared origin moves to the block header, private repositories get a lock, counts replace words, demo data is plain.
async (page) => {
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const context=await page.context().browser().newContext({viewport:{width:1320,height:822}});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  // Demo board reads like a real one: no 示例 prefix, no demo account, one origin chip per shared-source block.
  await p.goto('http://127.0.0.1:4317/?demo');await p.waitForFunction(()=>typeof render==='function');await p.waitForTimeout(300);
  const demo=await p.evaluate(()=>({text:document.querySelector('#board').innerText,repoChip:document.querySelector('.block.repository .block-origin')?.textContent,repoSub:document.querySelectorAll('.block.repository .asset-card .card-sub').length,repoTags:document.querySelectorAll('.block.repository .account-tag').length,domainChip:!!document.querySelector('.block.domain .block-origin'),domainSubs:document.querySelectorAll('.block.domain .card-sub').length,locks:document.querySelectorAll('.block.repository .asset-card .lock-mark').length,lockNamed:[...document.querySelectorAll('.lock-mark')].every(el=>el.getAttribute('aria-label')==='私有仓库'&&el.title),subChip:document.querySelector('.block.subscription .block-origin')?.textContent}));
  check(!/示例|demo/i.test(demo.text),'Demo board has no 示例 or demo labels: '+demo.text.slice(0,200));
  check(demo.repoChip==='acme-labs','Repository block states the shared account once: '+demo.repoChip);
  check(demo.repoSub===0&&demo.repoTags===0,'Repository cards drop the repeated source and account tag');
  check(!demo.domainChip&&demo.domainSubs>=3,'Mixed providers keep per-card sources');
  check(demo.subChip==='Acme','Shared provider of subscriptions moves up: '+demo.subChip);
  check(!/公开仓库|私有仓库|日期待补充/.test(demo.text),'No public/private/undated wording on cards');
  check(demo.locks>0&&demo.lockNamed,'Private repositories carry a named lock');
  // Hidden toggle is an icon plus a count, with the full meaning in the accessible name.
  const toggle=await p.evaluate(()=>{const b=document.querySelector('.block.domain .hidden-toggle');return b&&{text:b.textContent.trim(),icon:!!b.querySelector('svg'),label:b.getAttribute('aria-label'),title:b.title};});
  check(toggle&&toggle.text==='1'&&toggle.icon&&/已隐藏 1 项/.test(toggle.label)&&toggle.title,'Hidden toggle is eye-off + count with a name: '+JSON.stringify(toggle));
  // Searching shows each card in full: no hoisting while a query hides part of a block.
  await p.fill('#search','tokyo');await p.waitForTimeout(250);
  check(await p.evaluate(()=>document.querySelectorAll('.block .block-origin').length===0),'No hoisted origin while searching');
  await p.fill('#search','');await p.waitForTimeout(150);
  // Category hints stay only where fields follow special rules.
  await p.evaluate(()=>addBlock());
  const hints=await p.evaluate(()=>[...document.querySelectorAll('#modal .category-choice')].map(b=>[b.querySelector('span:nth-child(2)').firstChild.textContent,!!b.querySelector('small')]));
  check(hints.filter(h=>h[1]).map(h=>h[0]).sort().join()==='Apple ID,Google 账号,手机号,银行卡','Only special-rule categories keep a hint: '+JSON.stringify(hints));
  check(errors.length===0,'No page errors: '+errors.join('; '));
  return 'PASS: demo board plain, origin hoisted to block header, mixed blocks keep sources, lock for private, hidden toggle icon+count, search not hoisted, category hints trimmed';
 }finally{await context.close();}
}
