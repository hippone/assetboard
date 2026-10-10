// Panorama view (v13b P2): the read-only whole-board overview. Everything is derived from `state` by panorama.js; this file only draws it.
// Status here is the registered status (expiry, manual stop), never a live probe, and the view says so (DESIGN-PRINCIPLES: no probing, not real-time).
uiGlyphs.grid='<rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/>';
uiGlyphs.eyeOff='<path d="M3.5 12s3-5.5 8.5-5.5c1.2 0 2.3.3 3.2.7M20.5 12s-1.1 2-3.2 3.6M9.9 9.9a3 3 0 0 0 4.2 4.2M4 4l16 16"/>';
let panoOpen=false,panoReturn=null,panoFrame=0,panoObserver=null,panoKey='',panoLooseOpen=false;
const panoExpanded=new Set();
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
function panoramaHtml(model,fit){
 const sync=panoSyncTime(),tag=`登记状态 · 非实时${sync?' · 同步 '+sync:''}`;
 const body=model.lanes.length?`<div class="pano-trays">${model.accounts.map(acc=>panoTray(acc,fit,model.accounts.length===1)).join('')}</div>`:`<div class="pano-empty"><p>还没有服务器</p><button class="button icon-only" data-action="pano-add" aria-label="添加服务器" title="添加服务器">${ui('plus')}</button></div>`;
 return `<header class="pano-bar"><h2 class="pano-title">${ui('grid')}全景</h2><div class="pano-totals">${panoTotals(model.totals)}</div><span class="pano-spacer"></span><div class="pano-legend" aria-hidden="true"><span>${panoDot('red')}已过期</span><span>${panoDot('amber')}即将到期</span><span>${panoDot('')}登记中</span><span>${panoDot('',true)}已停用</span></div><span class="pano-tag" title="只显示你登记和同步的数据，不探测网络">${tag}</span><button class="button icon-only pano-close" data-action="pano-close" aria-label="关闭全景" title="关闭全景（Esc）">×</button></header><div class="pano-body" data-level="${fit.level}" data-layout="${fit.layout}">${body}${panoLoose(model)}</div>`;
}
function panoramaRender(){
 const root=$('#panorama');if(!panoOpen||!root)return;
 const model=buildPanorama(state.assets,{cardOrder:state.cardOrder||{}});panoShared=model.shared;
 const fit=panoramaFit({lanes:model.lanes.length,accounts:model.accounts.length,width:innerWidth,height:innerHeight});
 const keep=document.activeElement?.closest?.('#panorama')?document.activeElement:null,saved=keep&&{chip:keep.dataset.chip,lane:keep.dataset.laneHead,more:keep.dataset.more,loose:'looseMore' in keep.dataset,close:keep.classList.contains('pano-close')};
 root.innerHTML=panoramaHtml(model,fit);root.dataset.level=fit.level;
 if(saved){const sel=saved.chip?`[data-chip="${CSS.escape(saved.chip)}"]`:saved.lane?`[data-lane-head="${CSS.escape(saved.lane)}"]`:saved.more?`[data-more="${CSS.escape(saved.more)}"]`:saved.loose?'[data-loose-more]':saved.close?'.pano-close':'';(sel&&root.querySelector(sel)||root.querySelector('[data-nav]')||root.querySelector('.pano-close'))?.focus({preventScroll:true});}
}
function panoramaOpen(show=!panoOpen){
 const root=$('#panorama');if(!root||show===panoOpen)return;
 if(show){
  if($('#modal').open||!$('#keys-help').hidden)return;
  if(!$('#detail').hidden)closeDetail();
  panoReturn=document.activeElement;panoOpen=true;panoLooseOpen=false;panoExpanded.clear();
  root.hidden=false;document.body.classList.add('pano-open');$('main').inert=true;
  panoramaRender();(root.querySelector('[data-nav]')||root.querySelector('.pano-close')).focus({preventScroll:true});
  panoObserver||=new ResizeObserver(()=>{if(!panoOpen||panoFrame)return;panoFrame=requestAnimationFrame(()=>{panoFrame=0;const key=innerWidth+'x'+innerHeight;if(key===panoKey)return;panoKey=key;panoramaRender();});});
  panoKey=innerWidth+'x'+innerHeight;panoObserver.observe(root);
 }else{
  panoOpen=false;panoObserver?.disconnect();cancelAnimationFrame(panoFrame);panoFrame=0;
  root.hidden=true;root.innerHTML='';document.body.classList.remove('pano-open');$('main').inert=false;
  if(panoReturn?.isConnected)panoReturn.focus({preventScroll:true});panoReturn=null;
 }
}
const togglePanorama=show=>panoramaOpen(show);
// Keep the overview in step with the board while it is open.
{const boardRender=render;render=function(){boardRender.apply(this,arguments);if(panoOpen)panoramaRender();};}
// Keyboard: P toggles, Esc closes (but lets an open detail or dialog take it first), arrows move between lanes and chips, board letter keys sit still.
function panoNavItems(){return [...document.querySelectorAll('#panorama [data-nav]')].filter(n=>n.getClientRects().length);}
function panoMove(from,key){
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
 if(key==='p'&&!mod&&!e.altKey&&!e.shiftKey&&!dialogs&&!typing(e)&&!e.target.closest?.('#detail')){e.preventDefault();e.stopImmediatePropagation();panoramaOpen();return;}
 if(!panoOpen)return;
 if(mod&&key==='k'){panoramaOpen(false);return;}
 if(key==='Escape'){if(dialogs||!$('#detail').hidden)return;e.preventDefault();e.stopImmediatePropagation();panoramaOpen(false);return;}
 if(dialogs||typing(e)||e.target.closest?.('#detail'))return;
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
 const target=e.target.closest('[data-chip],[data-lane-head]');if(target)showDetail(target.dataset.chip||target.dataset.laneHead);
});
// Shared things: hovering or focusing one copy rings the others.
function panoRing(id){document.querySelectorAll('#panorama .pano-chip.peer').forEach(n=>n.classList.remove('peer'));if(!id)return;document.querySelectorAll(`#panorama .pano-chip[data-chip="${CSS.escape(id)}"][data-shared]`).forEach(n=>n.classList.add('peer'));}
document.addEventListener('pointerover',e=>{if(panoOpen&&e.pointerType==='mouse')panoRing(e.target.closest?.('#panorama .pano-chip[data-shared]')?.dataset.chip);});
document.addEventListener('pointerout',e=>{if(panoOpen&&e.target.closest?.('#panorama .pano-chip'))panoRing(null);});
document.addEventListener('focusin',e=>{if(panoOpen)panoRing(e.target.closest?.('#panorama .pano-chip[data-shared]')?.dataset.chip);});
document.addEventListener('focusout',()=>{if(panoOpen)panoRing(null);});
setIconButton($('#panorama-button'),'grid','全景（P）');
