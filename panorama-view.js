// Panorama view (v13b P2): the read-only whole-board overview. Everything is derived from `state` by panorama.js; this file only draws it.
// Status here is the registered status (expiry, manual stop), never a live probe, and the view says so (DESIGN-PRINCIPLES: no probing, not real-time).
uiGlyphs.grid='<rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/>';
uiGlyphs.eyeOff='<path d="M3.5 12s3-5.5 8.5-5.5c1.2 0 2.3.3 3.2.7M20.5 12s-1.1 2-3.2 3.6M9.9 9.9a3 3 0 0 0 4.2 4.2M4 4l16 16"/>';
let panoFocus=null,panoOrigin=null,panoOpen=false,panoReturn=null,panoFrame=0,panoObserver=null,panoKey='',panoLooseOpen=false;
const panoExpanded=new Set();
const PANO_FOCUS_CAP=6;
const PANO_TYPE_LABEL={domain:'域名',repository:'仓库',database:'数据库'};
const panoDot=(tone,stopped)=>`<i class="pd${tone?' '+tone:''}${stopped?' off':''}" aria-hidden="true"></i>`;
function panoSyncTime(){const times=state.assets.map(a=>Date.parse(a.syncedAt)).filter(Boolean);if(!times.length)return '';return new Date(Math.max(...times)).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});}
function panoStatus(a){
 if(a.stopped)return {text:'已停用',tone:''};
 if(!a.date)return {text:'',tone:''};
 const s=assetDateStatus(a);return {text:s.label,tone:s.level==='overdue'?'red':s.level==='soon'?'amber':''};
}
function panoChip(chip,laneId,extra=''){
 const a=chip.asset,status=panoStatus(a),label=[displayName(a),cats[a.type].name,chip.standby?'备用':'',chip.proxied?'经代理':'',status.text,chip.alsoOn?`另挂在 ${chip.alsoOn} 台服务器`:''].filter(Boolean).join('，');
 return `<button class="pano-chip${chip.stopped?' stopped':''}${chip.tone?' '+chip.tone:''}${extra}" data-nav data-chip="${esc(a.id)}" data-lane="${esc(laneId||'')}" ${panoShared&&panoShared.has(a.id)?'data-shared="1"':''} aria-label="${esc(label)}" title="${esc(label)}"><span class="pc-ic" aria-hidden="true">${icon(a.type)}</span><span class="pc-nm">${esc(displayName(a))}</span>${chip.standby?'<small class="pc-flag" aria-hidden="true">备</small>':''}${chip.proxied?'<svg class="pc-px" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.2"/><circle cx="6" cy="6" r="1.3"/></svg>':''}${chip.alsoOn?`<span class="pc-alt" aria-hidden="true">${icon('server')}</span>`:''}${panoDot(chip.tone,chip.stopped)}</button>`;
}
let panoShared=null;
function panoLaneHead(lane,view){
 const a=lane.server,ip=lane.ip,status=panoStatus(a),provider=a.provider&&a.provider!=='SSH'?a.provider:'';
 const ipLine=ip?`<span class="pl-ip">${ip.inner?'<em class="ip-inner" title="内网地址">内</em>':''}<span class="ip-text">${esc(ip.ip)}</span>${ip.more?`<em class="ip-more" aria-label="另有 IPv6">+${ip.more}</em>`:''}</span>`:'';
 const label=[a.name,ip?.ip,`挂载 ${lane.total} 项`,status.text].filter(Boolean).join('，');
 return `<button class="pano-lane-head" data-nav data-lane-head="${esc(lane.id)}" aria-label="${esc(label)}" title="${esc(label)}">${cardTile(a,'sm')}<span class="pl-tx"><b class="pl-nm">${esc(displayName(a))}</b>${ip||provider?`<span class="pl-sub">${ipLine}${provider?`<span class="pl-prov">${esc(provider)}</span>`:''}</span>`:''}</span></button>`;
}
function panoCounts(lane,groups){
 const icons={domain:'domain',repository:'repository',database:'database'};
 return `<span class="pl-cnts">${groups.filter(g=>g.total).map(g=>`<span class="pl-cnt" title="${PANO_TYPE_LABEL[g.key]} ${g.total}" aria-label="${PANO_TYPE_LABEL[g.key]} ${g.total}">${icon(icons[g.key])}${g.total>99?'99+':g.total}</span>`).join('')}${lane.hidden?`<span class="pl-cnt hid" title="已隐藏 ${lane.hidden} 项" aria-label="已隐藏 ${lane.hidden} 项">${ui('eyeOff')}${lane.hidden}</span>`:''}</span>`;
}
function panoLane(lane,fit){
 const view=laneView(lane,fit),status=panoStatus(lane.server);
 const stl=`<div class="pl-st"><span class="pl-state ${status.tone}">${panoDot(status.tone,lane.stopped)}${esc(status.text)}</span>${panoCounts(lane,lane.groups)}</div>`;
 let body='';
 if(view.level===1){
  body=`<div class="pl-kids">${view.groups.map(g=>{
   const open=panoExpanded.has(lane.id+':'+g.key),list=open?lane.groups.find(x=>x.key===g.key).chips:g.shown,more=open?0:g.more;
   if(!list.length)return '';
   return `<div class="pl-grp" data-group="${g.key}">${list.map(c=>panoChip(c,lane.id)).join('')}${more?`<button class="pano-more" data-nav data-more="${esc(lane.id+':'+g.key)}" aria-label="另外 ${more} 项，展开" title="展开">+${more}</button>`:open&&g.total>(fit.perType?.[g.key]||0)?`<button class="pano-more" data-nav data-more="${esc(lane.id+':'+g.key)}" aria-label="收起" title="收起">−</button>`:''}</div>`;}).join('')}${lane.total===0?`<div class="pl-empty" aria-hidden="true"></div>`:''}</div>`;
 }else if(view.level===2){
  body=`<div class="pl-dots" aria-hidden="true">${view.dots.map(d=>`<i class="pdot${d.tone?' '+d.tone:''}${d.stopped?' off':''}"></i>`).join('')}${view.more?`<small>+${view.more}</small>`:''}</div>`;
 }
 if(view.level===3)return `<article class="pano-lane tile${lane.stopped?' stopped':''}" data-lane="${esc(lane.id)}"><button class="pano-lane-head" data-nav data-lane-head="${esc(lane.id)}" aria-label="${esc(lane.server.name)}，挂载 ${lane.total} 项${status.text?'，'+esc(status.text):''}" title="${esc(lane.server.name)}">${panoDot(status.tone,lane.stopped)}<b class="pl-nm">${esc(displayName(lane.server))}</b><small>${lane.total}</small></button></article>`;
 return `<article class="pano-lane l${view.level}${lane.stopped?' stopped':''}" data-lane="${esc(lane.id)}">${panoLaneHead(lane,view)}${stl}${body}</article>`;
}
function panoTray(acc,fit,onlyOne){
 const a=acc.asset,status=a?panoStatus(a):{text:'',tone:''};
 const head=a?`<div class="pano-tray-head">${icon('subscription')}<b>${esc(displayName(a))}</b>${status.text&&status.tone?`<small class="${status.tone}">${panoDot(status.tone)}${esc(status.text)}</small>`:''}</div>`:onlyOne?'':`<div class="pano-tray-head none"><b>无账号</b></div>`;
 return `<section class="pano-tray" style="flex:${acc.lanes.length} 1 0" data-account="${esc(acc.id||'')}"${a?` aria-label="${esc(displayName(a))}"`:''}>${head}<div class="pano-lanes">${acc.lanes.map(l=>panoLane(l,fit)).join('')}</div></section>`;
}
function panoLoose(model){
 if(!model.unmounted.total)return '';
 const cap=capUnmounted(model,panoLooseOpen);
 return `<aside class="pano-loose${panoLooseOpen?' open':''}" aria-label="未挂载，${model.unmounted.total} 项"><div class="pano-loose-head">${icon('server')}<span>未挂载</span><b>${model.unmounted.total>99?'99+':model.unmounted.total}</b></div><div class="pano-loose-chips">${cap.shown.map(c=>panoChip(c,'')).join('')}${cap.more?`<button class="pano-more" data-nav data-loose-more aria-label="另外 ${cap.more} 项，展开" title="展开">+${cap.more}</button>`:panoLooseOpen&&model.unmounted.total>PANORAMA_UNMOUNTED_CAP?'<button class="pano-more" data-nav data-loose-more aria-label="收起" title="收起">−</button>':''}</div></aside>`;
}
function panoTotals(t){return [['server','服务器',t.server],['domain','域名',t.domain],['repository','仓库',t.repository],['database','数据库',t.database]].map(([type,name,n])=>`<span class="pano-total" title="${name} ${n}" aria-label="${name} ${n}">${icon(type)}${n}</span>`).join('');}

// Focused state (v13b P3): one server is the protagonist. Left rail = every server, centre = the hero card with its addresses, three columns of what sits on it.
function panoRail(model,id){
 return `<nav class="pano-rail" aria-label="服务器">${model.lanes.map(l=>{const st=panoStatus(l.server),ip=l.ip;return `<button class="pf-srv${l.id===id?' on':''}" data-nav data-pick="${esc(l.id)}" ${l.id===id?'aria-current="true"':''} aria-label="${esc([l.server.name,ip?.ip,`挂载 ${l.total} 项`,st.text].filter(Boolean).join('，'))}" title="${esc(l.server.name)}">${panoDot(st.tone,l.stopped)}<span class="pf-tx"><b>${esc(displayName(l.server))}</b>${ip?`<small>${esc(ip.ip)}</small>`:''}</span><em>${l.total}</em></button>`;}).join('')}</nav>`;
}
function panoHero(lane,model){
 const a=lane.server,status=panoStatus(a),provider=a.provider&&a.provider!=='SSH'?a.provider:'',ips=assetIps(a);
 const account=lane.account?model.accounts.find(x=>x.id===lane.account)?.asset:null;
 const label=[a.name,ips.map(x=>x.ip).join('、'),`挂载 ${lane.total} 项`,status.text].filter(Boolean).join('，');
 return `${account?`<button class="pf-acct" data-nav data-open="${esc(account.id)}" aria-label="账号 ${esc(displayName(account))}" title="${esc(displayName(account))}">${icon('subscription')}<span>${esc(displayName(account))}</span></button>`:''}
 <article class="pano-hero${lane.stopped?' stopped':''}" data-hero="${esc(lane.id)}"><button class="ph-head" data-nav data-hero-head aria-label="${esc(label)}" title="${esc(label)}">${cardTile(a,'sm')}<span class="pl-tx"><b class="ph-nm">${esc(displayName(a))}</b>${provider?`<span class="pl-prov">${esc(provider)}</span>`:''}</span></button>
 ${ips.length?`<div class="ip-pills ph-ips">${ips.map(x=>`<button class="ip-pill" data-action="copy-ip" data-ip="${esc(x.ip)}" title="复制 IP" aria-label="复制 IP ${esc(x.ip)}">${x.inner?'<em>内</em>':''}${esc(x.ip)}</button>`).join('')}</div>`:''}
 <div class="ph-st"><span class="pl-state ${status.tone}">${panoDot(status.tone,lane.stopped)}${esc(status.text)}</span>${panoCounts(lane,lane.groups)}</div></article>`;
}
function panoFocusColumns(lane){
 const cols=lane.groups.filter(g=>g.total).map(g=>{
  const key=lane.id+':f:'+g.key,open=panoExpanded.has(key),list=open?g.chips:g.chips.slice(0,PANO_FOCUS_CAP),more=g.total-PANO_FOCUS_CAP;
  return `<section class="pf-col" data-group="${g.key}" aria-label="${PANO_TYPE_LABEL[g.key]} ${g.total}"><h3>${icon(g.key)}<span>${g.total>99?'99+':g.total}</span></h3>${list.map(c=>panoChip(c,lane.id)).join('')}${more>0?`<button class="pano-more" data-nav data-more="${esc(key)}" aria-label="${open?'收起':`另外 ${more} 项，展开`}" title="${open?'收起':'展开'}">${open?'−':'+'+more}</button>`:''}</section>`;}).join('');
 return cols?`<div class="pf-cols">${cols}</div>`:'';
}
function panoFocusHtml(model,lane,fit){
 return `<div class="pano-body pano-focused" data-level="f" data-layout="${fit.layout}">${panoRail(model,lane.id)}<div class="pf-stage">${panoHero(lane,model)}${panoFocusColumns(lane)}</div>${panoLoose(model)}</div>`;
}
function panoFlip(el,from){
 if(!el||!from||matchMedia('(prefers-reduced-motion:reduce)').matches||!el.animate)return;
 const to=el.getBoundingClientRect();if(!to.width||!to.height||!from.width)return;
 el.animate([{transformOrigin:'0 0',transform:`translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width},${from.height/to.height})`,opacity:.35},{transformOrigin:'0 0',transform:'none',opacity:1}],{duration:200,easing:'cubic-bezier(.2,.8,.2,1)'});
}
function panoramaFocus(id,from,stay=false){
 if(!panoOpen)return;
 const lane=buildPanorama(state.assets,{cardOrder:state.cardOrder||{}}).lanes.find(l=>l.id===id);if(!lane)return;
 panoOrigin=from||panoOrigin;panoFocus=id;panoramaRender();
 const root=$('#panorama');if(!stay)root.querySelector('.ph-head')?.focus({preventScroll:true});
 panoFlip(root.querySelector('.pano-hero'),from);
}
function panoramaUnfocus(){
 if(!panoOpen||!panoFocus)return;
 const id=panoFocus;panoFocus=null;panoramaRender();
 const root=$('#panorama'),head=root.querySelector(`[data-lane-head="${CSS.escape(id)}"]`);head?.focus({preventScroll:true});
 if(head&&!matchMedia('(prefers-reduced-motion:reduce)').matches)root.querySelector('.pano-body')?.animate([{opacity:.4},{opacity:1}],{duration:150,easing:'ease-out'});
}
function panoramaHtml(model,fit){
 const sync=panoSyncTime(),tag=`登记状态 · 非实时${sync?' · 同步 '+sync:''}`;
 const body=model.lanes.length?`<div class="pano-trays">${model.accounts.map(acc=>panoTray(acc,fit,model.accounts.length===1)).join('')}</div>`:`<div class="pano-empty"><p>还没有服务器</p><button class="button icon-only" data-action="pano-add" aria-label="添加服务器" title="添加服务器">${ui('plus')}</button></div>`;
 const focusLane=panoFocus&&model.lanes.find(l=>l.id===panoFocus);if(panoFocus&&!focusLane)panoFocus=null;
 return `<header class="pano-bar"><h2 class="pano-title">${ui('grid')}全景</h2><div class="pano-totals">${panoTotals(model.totals)}</div><span class="pano-spacer"></span><div class="pano-legend" aria-hidden="true"><span>${panoDot('red')}已过期</span><span>${panoDot('amber')}即将到期</span><span>${panoDot('')}登记中</span><span>${panoDot('',true)}已停用</span></div><span class="pano-tag" title="只显示你登记和同步的数据，不探测网络">${tag}</span><button class="button icon-only pano-close" data-action="pano-close" aria-label="关闭全景" title="关闭全景（Esc）">×</button></header>${focusLane?panoFocusHtml(model,focusLane,fit):`<div class="pano-body" data-level="${fit.level}" data-layout="${fit.layout}">${body}${panoLoose(model)}</div>`}`;
}
function panoramaRender(){
 const root=$('#panorama');if(!panoOpen||!root)return;
 if(panoDrag)panoDragEnd(true);if(panoLink)panoLinkEnd();
 const model=buildPanorama(state.assets,{cardOrder:state.cardOrder||{}});panoShared=model.shared;
 const fit=panoramaFit({lanes:model.lanes.length,accounts:model.accounts.length,width:innerWidth,height:innerHeight});
 const keep=document.activeElement?.closest?.('#panorama')?document.activeElement:null,saved=keep&&{pick:keep.dataset.pick,hero:'heroHead' in keep.dataset,open:keep.dataset.open,chip:keep.dataset.chip,lane:keep.dataset.laneHead,more:keep.dataset.more,loose:'looseMore' in keep.dataset,close:keep.classList.contains('pano-close')};
 root.innerHTML=panoramaHtml(model,fit);root.dataset.level=fit.level;
 if(saved){const sel=saved.pick?`[data-pick="${CSS.escape(saved.pick)}"]`:saved.hero?'[data-hero-head]':saved.open?`[data-open="${CSS.escape(saved.open)}"]`:saved.chip?`[data-chip="${CSS.escape(saved.chip)}"]`:saved.lane?`[data-lane-head="${CSS.escape(saved.lane)}"]`:saved.more?`[data-more="${CSS.escape(saved.more)}"]`:saved.loose?'[data-loose-more]':saved.close?'.pano-close':'';(sel&&root.querySelector(sel)||root.querySelector('[data-nav]')||root.querySelector('.pano-close'))?.focus({preventScroll:true});}
}
function panoramaOpen(show=!panoOpen,serverId=null){
 const root=$('#panorama');if(!root||show===panoOpen)return;
 if(show){
  if($('#modal').open||!$('#keys-help').hidden)return;
  if(!$('#detail').hidden)closeDetail();
  panoReturn=document.activeElement;panoOpen=true;panoFocus=serverId&&state.assets.some(a=>a.id===serverId&&a.type==='server'&&!a.hiddenAt)?serverId:null;panoLooseOpen=false;panoExpanded.clear();
  root.hidden=false;document.body.classList.add('pano-open');$('main').inert=true;
  panoramaRender();(root.querySelector(panoFocus?'.ph-head':'[data-nav]')||root.querySelector('.pano-close')).focus({preventScroll:true});
  panoObserver||=new ResizeObserver(()=>{if(!panoOpen||panoFrame)return;panoFrame=requestAnimationFrame(()=>{panoFrame=0;const key=innerWidth+'x'+innerHeight;if(key===panoKey)return;panoKey=key;panoramaRender();});});
  panoKey=innerWidth+'x'+innerHeight;panoObserver.observe(root);
 }else{
  panoOpen=false;panoFocus=null;panoObserver?.disconnect();cancelAnimationFrame(panoFrame);panoFrame=0;
  root.hidden=true;root.innerHTML='';document.body.classList.remove('pano-open');$('main').inert=false;
  if(panoReturn?.isConnected)panoReturn.focus({preventScroll:true});panoReturn=null;
 }
}
const togglePanorama=show=>panoramaOpen(show);
// Keep the overview in step with the board while it is open.
{const boardRender=render;render=function(){boardRender.apply(this,arguments);if(panoOpen)panoramaRender();};}
// Keyboard: P toggles, Esc closes (but lets an open detail or dialog take it first), arrows move between lanes and chips, board letter keys sit still.
function panoNavItems(){return [...document.querySelectorAll('#panorama [data-nav]')].filter(n=>n.getClientRects().length);}
function panoMoveFocus(from,key){
 const items=panoNavItems(),rail=items.filter(n=>n.closest('.pano-rail')),top=items.filter(n=>n.closest('.pf-stage')&&!n.closest('.pf-col')),loose=items.filter(n=>n.closest('.pano-loose'));
 const cols=[...document.querySelectorAll('#panorama .pf-col')].map(c=>items.filter(n=>n.closest('.pf-col')===c)).filter(c=>c.length),col=cols.findIndex(c=>c.includes(from));
 const step=(list,d)=>list[list.indexOf(from)+d],vertical=key==='ArrowDown'||key==='ArrowUp',d=key==='ArrowDown'||key==='ArrowRight'?1:-1;
 if(vertical){
  if(rail.includes(from))step(rail,d)?.focus();
  else if(top.includes(from)){if(d>0&&top.at(-1)===from)(cols[0]?.[0]||loose[0])?.focus();else step(top,d)?.focus();}
  else if(col>=0){const n=step(cols[col],d);if(n)n.focus();else if(d<0)top.at(-1)?.focus();else loose[0]?.focus();}
  else if(loose.includes(from)&&d<0)(cols[0]?.at(-1)||top.at(-1))?.focus();
  return;
 }
 if(rail.includes(from)){if(d>0)top.find(n=>n.dataset.heroHead!==undefined)?.focus();return;}
 if(top.includes(from)){if(d<0)(rail.find(n=>n.classList.contains('on'))||rail[0])?.focus();return;}
 if(col>=0){const row=cols[col].indexOf(from),next=cols[col+d];if(next)next[Math.min(row,next.length-1)].focus();else if(d<0)(rail.find(n=>n.classList.contains('on'))||rail[0])?.focus();return;}
 if(loose.includes(from))step(loose,d)?.focus();
}
function panoMove(from,key){
 if(panoFocus)return panoMoveFocus(from,key);
 const items=panoNavItems(),at=items.indexOf(from);if(at<0)return;
 const laneOf=n=>n.dataset.laneHead||n.dataset.lane||(n.closest('.pano-loose')?'~':''),heads=items.filter(n=>n.dataset.laneHead);
 if(key==='ArrowDown'||key==='ArrowUp'){const next=items[at+(key==='ArrowDown'?1:-1)];if(next&&laneOf(next)===laneOf(from)&&!(from.dataset.laneHead&&key==='ArrowUp'))next.focus();return;}
 if(from.closest('.pano-loose')){const next=items[at+(key==='ArrowRight'?1:-1)];if(next?.closest('.pano-loose'))next.focus();return;}
 const here=heads.findIndex(n=>n.dataset.laneHead===laneOf(from)),target=heads[here+(key==='ArrowRight'?1:-1)];
 if(!target)return;
 // Keep the row: land on the same position inside the neighbouring lane when it has one.
 const own=items.filter(n=>laneOf(n)===laneOf(from)),row=own.indexOf(from),others=items.filter(n=>laneOf(n)===target.dataset.laneHead);
 (others[Math.min(row,others.length-1)]||target).focus();
}
document.addEventListener('keydown',e=>{
 const key=e.key.length===1?e.key.toLowerCase():e.key,mod=e.metaKey||e.ctrlKey;
 const dialogs=$('#modal').open||!$('#keys-help').hidden;
 if(key==='p'&&!mod&&!e.altKey&&!e.shiftKey&&!dialogs&&!typing(e)&&!e.target.closest?.('#detail')){e.preventDefault();e.stopImmediatePropagation();if(panoOpen){panoramaOpen(false);return;}const card=document.activeElement?.closest?.('#board [data-asset]'),a=card&&state.assets.find(x=>x.id===card.dataset.asset),server=a&&(a.type==='server'?a:serverChain(state.assets,a).servers.find(x=>!x.hiddenAt));panoramaOpen(true,server?.id||null);return;}
 if(!panoOpen)return;
 if(panoDrag||panoLink){if(panoKeys(e,key))return;}
 if(mod&&key==='k'){panoramaOpen(false);return;}
 if(key==='Escape'){if(dialogs||!$('#detail').hidden)return;e.preventDefault();e.stopImmediatePropagation();if(panoFocus)panoramaUnfocus();else panoramaOpen(false);return;}
 if(dialogs||typing(e)||e.target.closest?.('#detail'))return;
 if(key==='l'&&!mod&&!e.altKey&&!e.shiftKey){const chip=e.target.closest?.('#panorama .pano-chip[data-chip]');e.preventDefault();e.stopImmediatePropagation();if(chip)panoLinkStart(chip);return;}
 if(!mod&&!e.altKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)){
  const from=e.target.closest?.('#panorama [data-nav]');e.preventDefault();e.stopImmediatePropagation();
  if(from)panoMove(from,key);else panoNavItems()[0]?.focus();return;
 }
 // The overview is read-only: board shortcuts (E, H, F, X, N, I, O, /) do nothing here. ? and ⌘Z stay.
 if(!mod&&!e.altKey&&e.key!=='?'&&e.key!=='Tab'&&e.key!=='Enter'&&e.key!==' '&&(e.key.length===1))e.preventDefault(),e.stopImmediatePropagation();
},true);
document.addEventListener('click',e=>{
 const open=e.target.closest?.('[data-action="panorama"]');if(open){panoramaOpen(true);return;}
 if(!panoOpen||!e.target.closest?.('#panorama'))return;
 const close=e.target.closest('[data-action="pano-close"]');if(close){panoramaOpen(false);return;}
 if(e.target.closest('[data-action="pano-add"]')){panoramaOpen(false);assetForm('server');return;}
 const more=e.target.closest('[data-more]');if(more){const k=more.dataset.more;panoExpanded.has(k)?panoExpanded.delete(k):panoExpanded.add(k);panoramaRender();return;}
 if(e.target.closest('[data-loose-more]')){panoLooseOpen=!panoLooseOpen;panoramaRender();return;}
 const pick=e.target.closest('[data-pick]');if(pick){if(pick.dataset.pick!==panoFocus)panoramaFocus(pick.dataset.pick,pick.getBoundingClientRect(),true);return;}
 const opener=e.target.closest('[data-open]');if(opener){showDetail(opener.dataset.open);return;}
 if(e.target.closest('[data-hero-head]')){showDetail(panoFocus);return;}
 const lane=e.target.closest('[data-lane-head]');if(lane){panoramaFocus(lane.dataset.laneHead,lane.getBoundingClientRect());return;}
 const chip=e.target.closest('[data-chip]');if(chip)showDetail(chip.dataset.chip);
});
// Shared things: hovering or focusing one copy rings the others.
function panoRing(id){document.querySelectorAll('#panorama .peer').forEach(n=>n.classList.remove('peer'));if(!id)return;if(panoFocus)for(const other of panoShared?.get(id)||[])if(other!==panoFocus)document.querySelector(`#panorama .pf-srv[data-pick="${CSS.escape(other)}"]`)?.classList.add('peer');document.querySelectorAll(`#panorama .pano-chip[data-chip="${CSS.escape(id)}"][data-shared]`).forEach(n=>n.classList.add('peer'));}
document.addEventListener('pointerover',e=>{if(panoOpen&&e.pointerType==='mouse')panoRing(e.target.closest?.('#panorama .pano-chip[data-shared]')?.dataset.chip);});
document.addEventListener('pointerout',e=>{if(panoOpen&&e.target.closest?.('#panorama .pano-chip'))panoRing(null);});
document.addEventListener('focusin',e=>{if(panoOpen)panoRing(e.target.closest?.('#panorama .pano-chip[data-shared]')?.dataset.chip);});
document.addEventListener('focusout',()=>{if(panoOpen)panoRing(null);});
setIconButton($('#panorama-button'),'grid','全景（P）');

// ---- P4: drag a chip onto another server (the one write the panorama allows) -------------------------------------------------------------
// Default drop = move here, ⌥ = also here, onto the unmounted strip = unlink from the server it came out of. Esc or a drop on empty space cancels. One drag = one undo step.
let panoPress=null,panoDrag=null,panoLink=null,panoSuppress=false;
const PANO_SNAP=40,PANO_MOVE_PX=4,PANO_TOUCH_HOLD=400;
const panoSay=text=>{const n=$('#pano-live');if(n)n.textContent=text;};
const panoReduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
function panoTargets(id,from){
 const asset=state.assets.find(x=>x.id===id),out=[];if(!asset)return out;
 const add=(el,sid)=>{const server=state.assets.find(x=>x.id===sid);if(el&&server&&sid!==from&&linkAllowed(asset,server))out.push({el,id:sid,name:displayName(server)});};
 if(panoFocus){document.querySelectorAll('#panorama .pf-srv[data-pick]:not(.on)').forEach(el=>add(el,el.dataset.pick));add($('#panorama .pano-hero'),panoFocus);}
 else document.querySelectorAll('#panorama .pano-lane[data-lane]').forEach(el=>add(el,el.dataset.lane));
 if(from){let loose=$('#panorama .pano-loose');if(!loose){loose=document.createElement('aside');loose.className='pano-loose pano-loose-temp';loose.setAttribute('aria-hidden','true');loose.innerHTML=`<div class="pano-loose-head">${icon('server')}<span>未挂载</span></div>`;$('#panorama .pano-body')?.append(loose);}out.push({el:loose,id:null,name:'未挂载'});}
 return out;
}
function panoMark(targets,on){for(const t of targets){t.el.classList.toggle('drop-ok',!!on);if(!on)t.el.classList.remove('drop-on');}}
function panoSlot(t,asset){
 document.querySelectorAll('#panorama .pano-slot').forEach(n=>n.remove());
 if(!t||!t.id||!t.el.classList.contains('pano-lane')||!t.el.classList.contains('l1'))return;
 const key=asset.type==='domain'?'domain':asset.type==='repository'?'repository':'database',kids=t.el.querySelector('.pl-kids');if(!kids)return;
 let group=kids.querySelector(`.pl-grp[data-group="${key}"]`);if(!group){group=document.createElement('div');group.className='pl-grp';group.dataset.group=key;kids.append(group);}
 const slot=document.createElement('div');slot.className='pano-slot';slot.setAttribute('aria-hidden','true');group.append(slot);
}
function panoPick(x,y){
 let best=null,bd=1e9;
 for(const t of panoDrag.targets){const r=t.el.getBoundingClientRect(),d=Math.hypot(Math.max(r.left-x,0,x-r.right),Math.max(r.top-y,0,y-r.bottom));if(d<=PANO_SNAP&&d<bd){best=t;bd=d;}}
 return best;
}
function panoSetOver(t){
 if(panoDrag.over===t)return;
 panoDrag.over?.el.classList.remove('drop-on');panoDrag.over=t;
 if(t){t.el.classList.add('drop-on');panoSay(t.id?`移到 ${t.name}，⌥ 也挂到`:'解除关联');}
 panoSlot(t,panoDrag.asset);
}
function panoDragStart(press,e){
 const asset=state.assets.find(x=>x.id===press.id);if(!asset)return;
 clearTimeout(press.timer);
 const r=press.el.getBoundingClientRect(),ghost=press.el.cloneNode(true);
 ghost.classList.add('pano-ghost');['data-nav','data-chip','data-lane','data-shared','title','aria-label'].forEach(a=>ghost.removeAttribute(a));ghost.setAttribute('aria-hidden','true');ghost.tabIndex=-1;
 ghost.style.cssText=`width:${r.width}px;height:${r.height}px`;$('#panorama').append(ghost);
 press.el.classList.add('drag-hole');$('#panorama').classList.add('dragging');
 const targets=panoTargets(press.id,press.from);panoMark(targets,true);
 panoDrag={id:press.id,asset,from:press.from,el:press.el,ghost,off:{x:press.x-r.left,y:press.y-r.top},home:r,targets,over:null};
 panoDragMove(e);panoSay('拖动中，Esc 取消');
}
function panoDragMove(e){
 const d=panoDrag;d.ghost.style.transform=`translate(${e.clientX-d.off.x}px,${e.clientY-d.off.y}px) scale(1.04)`;
 panoSetOver(panoPick(e.clientX,e.clientY));
}
// Finish a drag. `drop` commits onto the snapped target; otherwise (Esc, empty space, a re-render) the chip glides home.
function panoDragEnd(abort,e){
 const d=panoDrag;if(!d)return;panoDrag=null;
 const target=!abort&&e?d.over:null;
 d.targets.forEach(t=>t.el.classList.remove('drop-ok','drop-on'));document.querySelectorAll('#panorama .pano-slot,#panorama .pano-loose-temp').forEach(n=>n.remove());
 $('#panorama')?.classList.remove('dragging');d.el.classList.remove('drag-hole');
 panoSuppress=true;setTimeout(()=>{panoSuppress=false;},80);
 if(target){d.ghost.remove();panoRelink(d.id,{from:d.from,to:target.id,keep:!!e.altKey});return;}
 const home=d.el.isConnected?d.el.getBoundingClientRect():null;
 if(home&&!abort&&!panoReduced()&&d.ghost.animate){const a=d.ghost.animate([{transform:d.ghost.style.transform},{transform:`translate(${home.left}px,${home.top}px) scale(1)`}],{duration:150,easing:'ease-out'});a.onfinish=a.oncancel=()=>d.ghost.remove();}else d.ghost.remove();
 panoSay('已取消');
}
function panoRelink(id,{from,to,keep}){
 checkpoint();const r=moveMount(state.assets,id,{from,to,keep});
 if(!r.ok){history.pop();panoSay('没有变化');return r;}
 save();render();
 const text=r.kind==='detach'?'已解除关联':r.kind==='also'?`也挂到 ${r.server.name}`:`已移到 ${r.server.name}`;
 toast(text,true);panoSay(text);
 const keepFocus=document.querySelector(`#panorama [data-chip="${CSS.escape(id)}"]`)||document.querySelector(`#panorama [data-lane-head="${CSS.escape(to||'')}"],#panorama [data-pick="${CSS.escape(to||'')}"]`)||document.querySelector('#panorama [data-nav]');
 keepFocus?.focus({preventScroll:true});return r;
}
document.addEventListener('pointerdown',e=>{
 if(!panoOpen||e.button>0||panoDrag)return;
 const el=e.target.closest?.('#panorama .pano-chip[data-chip]');if(!el)return;
 const press={id:el.dataset.chip,from:el.dataset.lane||'',el,x:e.clientX,y:e.clientY,type:e.pointerType,timer:0};
 if(e.pointerType==='touch')press.timer=setTimeout(()=>{if(panoPress===press)panoDragStart(press,{clientX:press.x,clientY:press.y});},PANO_TOUCH_HOLD);
 panoPress=press;
},true);
document.addEventListener('pointermove',e=>{
 if(panoDrag){e.preventDefault();panoDragMove(e);return;}
 if(!panoPress)return;
 const moved=Math.hypot(e.clientX-panoPress.x,e.clientY-panoPress.y);
 if(panoPress.type==='touch'){if(moved>8){clearTimeout(panoPress.timer);panoPress=null;}return;}
 if(moved>=PANO_MOVE_PX){const press=panoPress;panoPress=null;panoDragStart(press,e);}
},true);
document.addEventListener('pointerup',e=>{clearTimeout(panoPress?.timer);panoPress=null;if(panoDrag)panoDragEnd(false,e);},true);
document.addEventListener('pointercancel',()=>{clearTimeout(panoPress?.timer);panoPress=null;if(panoDrag)panoDragEnd(true);},true);
document.addEventListener('touchmove',e=>{if(panoDrag&&e.cancelable)e.preventDefault();},{passive:false,capture:true});
document.addEventListener('click',e=>{if(panoSuppress&&e.target.closest?.('#panorama')){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('dragstart',e=>{if(panoOpen&&e.target.closest?.('#panorama'))e.preventDefault();},true);
// Keyboard twin of the drag: L on a chip outlines the legal servers, ←→ choose, Enter moves here, ⌥Enter also hangs it here, Esc cancels.
function panoLinkStart(chip){
 const id=chip.dataset.chip,from=chip.dataset.lane||'',targets=panoTargets(id,from);
 if(!targets.length){panoSay('没有可挂的服务器');return;}
 panoLink={id,from,asset:state.assets.find(x=>x.id===id),targets,i:0,chip};panoMark(targets,true);panoLinkShow();
}
function panoLinkShow(){const l=panoLink;l.targets.forEach((t,i)=>t.el.classList.toggle('drop-on',i===l.i));const t=l.targets[l.i];panoSay(t.id?`移到 ${t.name}，⌥ 回车为也挂到`:'解除关联');t.el.scrollIntoView?.({block:'nearest',inline:'nearest'});panoSlot(t,l.asset);}
function panoLinkEnd(){const l=panoLink;if(!l)return;panoLink=null;l.targets.forEach(t=>t.el.classList.remove('drop-ok','drop-on'));document.querySelectorAll('#panorama .pano-slot,#panorama .pano-loose-temp').forEach(n=>n.remove());}
// Returns true when the key was consumed by an active drag or link mode.
function panoKeys(e,key){
 if(panoDrag){if(key==='Escape'){e.preventDefault();e.stopImmediatePropagation();panoDragEnd(true);return true;}return false;}
 const l=panoLink;e.preventDefault();e.stopImmediatePropagation();
 if(key==='Escape'){panoLinkEnd();panoSay('已取消');l.chip.isConnected&&l.chip.focus();return true;}
 if(key==='ArrowRight'||key==='ArrowDown'){l.i=(l.i+1)%l.targets.length;panoLinkShow();return true;}
 if(key==='ArrowLeft'||key==='ArrowUp'){l.i=(l.i-1+l.targets.length)%l.targets.length;panoLinkShow();return true;}
 if(key==='Enter'){const t=l.targets[l.i];panoLinkEnd();panoRelink(l.id,{from:l.from,to:t.id,keep:e.altKey});return true;}
 return true;
}
