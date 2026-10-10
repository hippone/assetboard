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
  // B: depth tokens. Canvas gradient, recessed tray without an outer border, raised card with inner highlight, faint text readable in both schemes.
  const lum=c=>{const v=c.map(x=>{x/=255;return x<=.03928?x/12.92:((x+.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];},ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((m,n)=>n-m);return (x+.05)/(y+.05);};
  for(const scheme of ['light','dark']){
   await p.emulateMedia({colorScheme:scheme});await p.waitForTimeout(250);
   const d=await p.evaluate(()=>{const cs=sel=>getComputedStyle(document.querySelector(sel)),rgb=v=>{const m=document.createElement('i');m.style.color=v.trim();document.body.append(m);const cv=document.createElement('canvas');cv.width=cv.height=1;const x=cv.getContext('2d');x.fillStyle=getComputedStyle(m).color;x.fillRect(0,0,1,1);m.remove();return [...x.getImageData(0,0,1,1).data].slice(0,3);},root=getComputedStyle(document.documentElement);
    return {bodyImage:cs('body').backgroundImage,trayShadow:cs('.block').boxShadow,trayBg:cs('.block').backgroundColor,trayBorder:cs('.block').borderTopColor,cardShadow:cs('.asset-card').boxShadow,cardImage:cs('.asset-card').backgroundImage,faint:rgb(root.getPropertyValue('--faint')),card:rgb(root.getPropertyValue('--card-bottom')),muted:rgb(root.getPropertyValue('--muted'))};});
   check(/gradient/.test(d.bodyImage),scheme+' canvas is a gradient');
   check(/inset/.test(d.trayShadow)&&/rgba\(0, 0, 0, 0\)|transparent/.test(d.trayBorder)&&Number((d.trayBg.match(/[\d.]+/g)||[])[3]??1)<.5,scheme+' tray is recessed, translucent and has no outer border: '+d.trayBg+' '+d.trayBorder);
   check(/gradient/.test(d.cardImage)&&/inset/.test(d.cardShadow)&&(d.cardShadow.match(/rgba?\(/g)||[]).length>=4,scheme+' card is a gradient with a layered shadow and inner highlight: '+d.cardShadow);
   check(ratio(d.faint,d.card.slice(0,3))>=4.5,scheme+' faint text on card >= 4.5: '+ratio(d.faint,d.card.slice(0,3)).toFixed(2));
  }
  await p.emulateMedia({colorScheme:'light'});
  check(errors.length===0,'No page errors: '+errors.join('; '));
  return 'PASS: demo board plain, origin hoisted to block header, mixed blocks keep sources, lock for private, hidden toggle icon+count, search not hoisted, category hints trimmed';
 }finally{await context.close();}
}
