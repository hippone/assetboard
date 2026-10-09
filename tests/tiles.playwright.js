// Category icon tiles and card type (DESIGN-PRINCIPLES §9 rules 13–15). Run with the browser tool's filename option.
async (page) => {
 const p=await page.context().newPage();
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const errors=[];p.on('pageerror',error=>errors.push(error.message));
 try {
  await p.goto('http://127.0.0.1:4317/?demo');
  await p.waitForFunction(()=>typeof render==='function'&&document.querySelector('.asset-card'));
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const result=await p.evaluate(png=>{
   const types=Object.keys(cats),missing=types.filter(t=>!icons[t]),shapes=new Set(types.map(t=>icons[t]));
   state.blocks=types.map(id=>({id,width:25,height:null,density:'full',folded:false}));
   state.assets=types.map((type,i)=>({id:'t-'+type,type,name:'示例 '+type,provider:'示例来源',account:'demo',purpose:'只在悬停和详情出现的用途',source:'manual',art:'generic',updatedAt:new Date(Date.now()-i*1000).toISOString()}));
   state.assets.push({id:'t-site',type:'domain',name:'site.example',provider:'示例',siteIcon:png,source:'manual',art:'generic',updatedAt:new Date().toISOString()},
    {id:'t-custom',type:'server',name:'自定义图标',provider:'示例',iconData:png.replace('image/png','image/webp'),siteIcon:png,source:'manual',art:'generic',updatedAt:new Date().toISOString()},
    {id:'t-card',type:'bankcard',name:'带站点图标的卡',provider:'示例银行',network:'Visa',last4:'4821',siteIcon:png,source:'manual',art:'generic',updatedAt:new Date().toISOString()});
   render();
   const tileOf=id=>document.querySelector(`#board [data-asset="${id}"] .card-head .tile`);
   const typeTiles=types.map(t=>{const el=tileOf('t-'+t);return {t,ok:!!el&&el.classList.contains('type-art')&&!!el.querySelector('svg')&&!el.querySelector('img'),stroke:el?.querySelector('svg')?.getAttribute('stroke-width'),size:el&&Math.round(el.getBoundingClientRect().width)};});
   const site=tileOf('t-site'),custom=tileOf('t-custom'),bank=tileOf('t-card');
   const cardsEl=[...document.querySelectorAll('#board .asset-card:not(.flip-card)')];
   const serif=[...document.querySelectorAll('body, #board *, #agenda *')].map(el=>getComputedStyle(el).fontFamily).filter(f=>/Georgia|Times|(^|,\s*)serif|Avenir|Menlo/i.test(f.replace(/sans-serif/gi,'')));
   const layers=cardsEl.map(el=>[...el.querySelectorAll('.card-open .card-copy > *, .card-foot .card-event')].filter(x=>x.offsetParent&&x.textContent.trim()).length);
   const heights=cardsEl.map(el=>el.getBoundingClientRect().height);
   return {missing,distinct:shapes.size===types.length,typeTiles,
    site:!!site&&site.classList.contains('site-art')&&!!site.querySelector('img')&&!site.querySelector('svg'),
    custom:!!custom&&custom.classList.contains('custom-art')&&!custom.classList.contains('site-art')&&custom.querySelector('img')?.getAttribute('src').startsWith('data:image/webp'),
    bank:!!bank&&!!bank.querySelector('img')&&!bank.querySelector('svg'),
    serif:[...new Set(serif)],maxLayers:Math.max(...layers),purposeOnCard:document.querySelectorAll('#board .card-purpose').length+[...document.querySelectorAll('#board .card-open')].filter(el=>el.textContent.includes('只在悬停')).length,
    purposeHover:document.querySelector('#board [data-asset="t-domain"] .card-open').title.includes('只在悬停'),maxHeight:Math.max(...heights),
    headTiles:document.querySelectorAll('#board .block-title .tile svg').length===types.length};
  },png);
  check(!result.missing.length,'Categories without an icon: '+result.missing.join(', '));
  check(result.distinct,'Every category icon is distinct');
  for(const t of result.typeTiles)check(t.ok&&t.stroke==='1.5'&&t.size===32,`Category ${t.t} shows its 1.5px line icon in a 32px tile: `+JSON.stringify(t));
  check(result.site,'A fetched site icon replaces the category icon');
  check(result.custom,'A custom icon wins over a site icon and the category icon');
  check(result.bank,'Priority types use a real icon too when there is one');
  check(!result.serif.length,'Only system sans-serif fonts: '+result.serif.join(' | '));
  check(result.maxLayers<=3,'A card shows at most three text layers, got '+result.maxLayers);
  check(result.purposeOnCard===0&&result.purposeHover,'Purpose lives in the hover title and detail, not on the card');
  check(result.maxHeight<=104,'Full cards stay compact, tallest is '+result.maxHeight);
  check(result.headTiles,'Every block header carries its category tile');

  // The same tile shows up wherever the asset does: detail, agenda chips, compact strips, folded peeks, flip cards and search.
  const spots=await p.evaluate(()=>{
   const out={};showDetail('t-site');out.detail=!!document.querySelector('#detail .detail-head .tile.lg.site-art img');closeDetail();
   const day=new Date();day.setDate(day.getDate()+3);const a=state.assets.find(x=>x.id==='t-database');a.date=day.toISOString().slice(0,10);render();
   out.agenda=!!document.querySelector('#agenda .agenda-item[data-id="t-database"] .tile.sm svg');
   state.blocks.find(b=>b.id==='server').density='compact';render();
   const compactTile=document.querySelector('#board .block.server [data-asset="t-custom"] .card-head .tile');out.compact=!!compactTile&&Math.round(compactTile.getBoundingClientRect().width)===20&&!!compactTile.querySelector('img');
   state.blocks.find(b=>b.id==='domain').folded=true;render();out.peek=document.querySelectorAll('#board .block.domain .peek-mark .tile.sm').length===2;
   state.blocks.find(b=>b.id==='domain').folded=false;state.assets.find(x=>x.id==='t-license').hiddenAt=new Date().toISOString();showHiddenBlocks.add('license');render();
   out.flip=!!document.querySelector('#board .flip-card .flip-face.front .tile.type-art svg');showHiddenBlocks.clear();render();
   return out;});
  for(const [k,v] of Object.entries(spots))check(v,'Tile missing in '+k);
  // Hovering a card swaps link chips for actions without changing its height; a hidden card keeps its name readable.
  const card=p.locator('#board [data-asset="t-server"]');const rest=(await card.boundingBox()).height;await card.hover();await p.waitForTimeout(250);
  check(Math.abs((await card.boundingBox()).height-rest)<.5,'Hover must not change the card height');
  await p.mouse.move(1,1);
  await p.evaluate(()=>{showHiddenBlocks.add('license');render();});
  check(await p.locator('#board .flip-card .flip-face.back strong').evaluate(e=>e.getBoundingClientRect().height>=14&&e.textContent.length>0),'A hidden card shows its name on the back');
  await p.evaluate(()=>{showHiddenBlocks.clear();render();});
  await p.fill('#search','只在悬停');await p.waitForTimeout(250);
  check(await p.locator('#board .asset-card .card-head .tile').count()>0&&await p.locator('#board .card-hit').count()>0,'Search results show tiles and say when the match is in the purpose');
  await p.fill('#search','');
  check(!errors.length,'Page errors: '+errors.join(' | '));
  return 'PASS: every category has a distinct 1.5px icon, real icons win, system sans only, three text layers, compact cards, tiles in header/detail/agenda/compact/peek/flip/search, stable hover height, readable hidden card';
 } finally { await p.close(); }
}
