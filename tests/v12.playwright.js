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
  // C: one glass top bar. Icon-only actions keep title + accessible name, the inbox count is a badge, agenda chips are dot + name + days.
  const top=await p.evaluate(()=>{const bar=document.querySelector('#topbar'),cs=getComputedStyle(bar),blurred=[...document.querySelectorAll('body *')].filter(el=>{const s=getComputedStyle(el);return (s.backdropFilter&&s.backdropFilter!=='none'||s.webkitBackdropFilter&&s.webkitBackdropFilter!=='none')&&el.getClientRects().length;}).map(el=>el.id||el.className),
    buttons=[...bar.querySelectorAll('.button.icon-only')].map(b=>({id:b.id,text:b.textContent.trim(),label:b.getAttribute('aria-label'),title:b.title,svg:!!b.querySelector('svg')})),chips=[...bar.querySelectorAll('.agenda-item')].map(el=>({dot:!!el.querySelector('.dot'),label:el.getAttribute('aria-label'),when:el.querySelector('.agenda-when')?.textContent,tile:!!el.querySelector('.tile')})),
    sticky=cs.position==='sticky',label=bar.querySelector('.agenda-label');
   return {blurred,buttons,chips,sticky,labelName:label?.getAttribute('aria-label'),more:bar.querySelector('.agenda-more')?.getAttribute('aria-label'),badge:!!bar.querySelector('.demo-badge'),badgeText:bar.querySelector('.demo-badge')?.textContent,bottomPill:!!document.body.querySelector(':scope > .demo-badge')};});
  check(top.sticky&&top.blurred.join()==='topbar','The top bar is the only blur layer on the board: '+top.blurred.join());
  check(top.buttons.length===4&&top.buttons.every(b=>b.svg&&!b.text.replace(/\d+/g,'')&&b.label&&b.title),'Four named icon buttons: '+JSON.stringify(top.buttons));
  check(top.chips.length===3&&top.chips.every(c=>c.dot&&!c.tile&&c.label&&/^(过期 \d+ 天|今天|明天|\d+ 天)$/.test(c.when)),'Agenda chips are dot, name, bare days: '+JSON.stringify(top.chips));
  check(top.chips[0].label.includes('过期')&&top.labelName==='接下来'&&/全部 \d+ 项/.test(top.more),'Full meaning stays in the accessible names');
  check(top.badge&&top.badgeText==='演示'&&!top.bottomPill,'Demo note is a small badge in the bar, not a bottom pill');
  // Pending count is a badge on the tray icon with the full name on the button.
  await p.evaluate(()=>{window.pendingCount=()=>3;syncToolbar();});
  const inbox=await p.evaluate(()=>{const b=document.querySelector('#inbox-button');return {badge:b.querySelector('.count-badge')?.textContent,label:b.getAttribute('aria-label'),title:b.title};});
  check(inbox.badge==='3'&&inbox.label==='待确认 3'&&inbox.title==='待确认 3','Inbox count badge: '+JSON.stringify(inbox));
  await p.evaluate(()=>document.querySelector('#modal').close());
  // D: quiet block heads, one big fronted card, plain list rows, empty slot, rows of equal height.
  await p.mouse.move(2,300);await p.waitForTimeout(200);
  const d=await p.evaluate(()=>{const cs=(el,prop)=>getComputedStyle(el)[prop],head=document.querySelector('.block.domain .block-head'),count=head.querySelector('.asset-count'),pins=[...document.querySelectorAll('#board .asset-card.pinned')],rows=[...document.querySelectorAll('.block.domain,.block.server')].map(b=>Math.round(b.getBoundingClientRect().height)),listRow=document.querySelector('.compact-repo'),slot=document.querySelector('.block.empty-slot'),ch=head.querySelector('.chevron'),sum=head.querySelector('.block-summary');
   return {titleSize:cs(head.querySelector('.block-title'),'fontSize'),countBg:cs(count,'backgroundColor'),chevron:cs(ch,'opacity'),plus:cs(head.querySelector('.icon-button'),'opacity'),pins:pins.map(el=>({id:el.dataset.asset,big:el.querySelector('.card-event.big b')?.textContent,text:el.querySelector('.card-event')?.textContent.trim(),name:cs(el.querySelector('.card-name'),'fontSize')})),sumLabel:sum.getAttribute('aria-label'),sumText:sum.textContent.trim(),dots:sum.querySelectorAll('.dot').length,rows,
    listBg:cs(listRow,'backgroundColor'),listShadow:cs(listRow,'boxShadow'),listBorder:cs(listRow,'borderTopColor'),slot:!!slot&&slot.classList.contains('license'),slotBorder:slot&&cs(slot,'borderTopStyle'),slotName:slot?.querySelector('.block-title > span:nth-child(2)')?.textContent.trim(),slotAdd:slot?.querySelector('.block-empty')?.getAttribute('title'),
    cardTiles:document.querySelectorAll('#board .asset-card .card-head .tile').length,aligned:[...document.querySelectorAll('#board .asset-card:not(.pinned) .card-name')].filter(n=>n.getClientRects().length).every(n=>n.getBoundingClientRect().left>=n.closest('.asset-card').getBoundingClientRect().left+10)};});
  check(d.titleSize==='15px'&&d.countBg==='rgba(0, 0, 0, 0)','Block title 15px, count has no pill: '+d.titleSize+' '+d.countBg);
  check(d.chevron==='0'&&d.plus==='0','Chevron and add stay hidden until hover or focus');
  await p.hover('.block.domain');await p.waitForTimeout(250);
  check(await p.evaluate(()=>getComputedStyle(document.querySelector('.block.domain .chevron')).opacity==='1'&&getComputedStyle(document.querySelector('.block.domain .block-actions .icon-button')).opacity==='1'),'They appear on hover');
  check(d.pins.length===1&&d.pins[0].id==='demo-d1'&&/^\d+$/.test(d.pins[0].big)&&/天后到期/.test(d.pins[0].text)&&d.pins[0].name==='15px','Only the fronted card is big, with a big day count: '+JSON.stringify(d.pins));
  check(d.sumLabel==='1 项已过期 · 1 项即将到期'&&d.dots===2&&!/项/.test(d.sumText),'Block summary is two dots with counts, sentence in the label: '+d.sumText);
  check(new Set(d.rows).size===1,'Blocks in one row share a height: '+d.rows);
  check(d.listBg==='rgba(0, 0, 0, 0)'&&d.listShadow==='none','List rows have no card chrome');
  check(d.slot&&d.slotBorder==='dashed'&&d.slotName==='软件授权'&&/添加/.test(d.slotAdd),'Empty block is a dashed slot with name and plus: '+JSON.stringify([d.slot,d.slotBorder,d.slotName,d.slotAdd]));
  check(d.cardTiles===0&&d.aligned,'Demo cards draw no category tile and keep their text inset');
  check(errors.length===0,'No page errors: '+errors.join('; '));
  return 'PASS: demo board plain, origin hoisted to block header, mixed blocks keep sources, lock for private, hidden toggle icon+count, search not hoisted, category hints trimmed';
 }finally{await context.close();}
}
