const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
 domain:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
 server:'<rect x="4" y="3" width="16" height="7" rx="2"/><rect x="4" y="14" width="16" height="7" rx="2"/><path d="M7 6h1m-1 11h1m7-11h2m-2 11h2"/>',
 subscription:'<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M3 10h18m-14 5h5"/>',
 database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
 license:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
 repository:'<path d="M6 4h11a2 2 0 0 1 2 2v13H7a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Z"/><path d="M4 16a3 3 0 0 1 3-3h12M8 8h7"/>',
 deployment:'<path d="m12 2 8 9-8 11-8-11 8-9Z"/><path d="M12 2v20M4 11h16"/>',
 storage:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M8 15h.01"/>'
};
const cats = {domain:{name:'域名',hint:'网站的地址，也是创作的起点',symbol:'◎'},server:{name:'服务器',hint:'承载项目的每一台机器',symbol:'▤'},subscription:{name:'订阅与工具',hint:'每天陪你工作的好工具',symbol:'✳'},database:{name:'数据库',hint:'让每一份数据都有归处',symbol:'▱'},license:{name:'软件授权',hint:'买下的工具，不再遗忘',symbol:'◇'},repository:{name:'代码仓库',hint:'项目的代码与历史',symbol:'⌘'},deployment:{name:'部署服务',hint:'Pages 与 Worker 等线上服务',symbol:'◆'},storage:{name:'对象存储',hint:'R2 Bucket 等存储资源',symbol:'▣'}};
const seed={blocks:[],assets:[]};
const key='assetboard-prototype-v1';
const nativeStore=window.__ASSETBOARD_NATIVE__;
window.assetboardConnectionState=connections=>{
 if(!nativeStore)return;
 Object.assign(nativeStore,connections);
 const cloudflareStatus=$('#cloudflare-status');
 if(cloudflareStatus)cloudflareStatus.textContent=nativeStore.cloudflareConnected?'已连接 · 可重新同步':nativeStore.keychainUnavailable?'本机钥匙串暂未响应，可重新输入令牌同步':'尚未连接';
 const githubStatus=$('#github-status');
 if(githubStatus)githubStatus.textContent=nativeStore.githubConnected?'已连接 · 可重新同步':nativeStore.keychainUnavailable?'本机钥匙串暂未响应，可使用 gh 同步':'尚未连接';
};
let state=structuredClone(seed),editing=false,query='',focusCategory=null,history=[],activeAsset=null,lastFocus=null,toastTimer,showHiddenBlocks=new Set(),assetFormSnapshot=null;
let migratedLegacyData=false;
try{const saved=nativeStore?nativeStore.data:JSON.parse(localStorage.getItem(key));if(saved&&Array.isArray(saved.blocks)&&Array.isArray(saved.assets)&&saved.blocks.every(b=>cats[b.id])){const migration=removeUntouchedDemo(saved);state=migration.board;migratedLegacyData=!!(migration.removed||migration.removedBlocks);}}catch{} if(!Array.isArray(state.deletedExternalIds))state.deletedExternalIds=[];
let saveSequence=0;
window.assetboardSaved=(sequence,success)=>{if(sequence!==saveSequence)return;$('#save-status').textContent=success?'已保存在此 Mac':'尚未保存';if(!success)toast('本机文件保存失败，请保留窗口后重试');};
function save(){try{if(nativeStore){$('#save-status').textContent='正在保存到此 Mac…';window.webkit.messageHandlers.assetboard.postMessage({action:'save',sequence:++saveSequence,data:state});}else{localStorage.setItem(key,JSON.stringify(state));$('#save-status').textContent='已保存在此浏览器';}}catch{$('#save-status').textContent='尚未保存';toast('未能保存，请保留此窗口');}}
function checkpoint(){history.push(JSON.stringify(state));if(history.length>25)history.shift();}
function toast(message,undoable=false){clearTimeout(toastTimer);const offer=undoable&&history.length;$('#toast').innerHTML=`<span>${esc(message)}</span>${offer?'<button class="toast-undo" data-action="undo">撤销</button>':''}`;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),offer?6000:3000);}
function undo(){if(!history.length){toast('没有可撤销的修改');return;}state=JSON.parse(history.pop());save();if(activeAsset&&!state.assets.some(a=>a.id===activeAsset))closeDetail();else if(activeAsset)showDetail(activeAsset);render();toast('已撤销上一次修改');}
function confirmDialog(title,message,confirmLabel,danger=false){return new Promise(resolve=>{modal(title,`<p class="form-note confirm-message">${esc(message).replaceAll('\n','<br>')}</p><div class="confirm-actions"><button class="button ${danger?'danger':'primary'}" id="confirm-yes">${esc(confirmLabel)}</button><button class="button" id="confirm-no">取消</button></div>`);const dialog=$('#modal');let settled=false;const finish=value=>{if(settled)return;settled=true;dialog.removeEventListener('close',cancel);resolve(value);},cancel=()=>finish(false);dialog.addEventListener('close',cancel);$('#confirm-yes').onclick=()=>{finish(true);dialog.close();};$('#confirm-no').onclick=()=>dialog.close();$('#confirm-no').focus();});}

function isHidden(a){return !!(a&&a.hiddenAt);}
function rememberDeleted(a){const key=assetSyncKey(a);if(!key)return;if(!Array.isArray(state.deletedExternalIds))state.deletedExternalIds=[];if(!state.deletedExternalIds.includes(key))state.deletedExternalIds.push(key);if(a.id&&!state.deletedExternalIds.includes(a.id))state.deletedExternalIds.push(a.id);}
function icon(type){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${icons[type]}</svg>`;}
function art(asset){
 if(typeof asset.iconData==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(asset.iconData)&&asset.iconData.length<400000)return `<div class="art custom-art" aria-hidden="true"><img src="${asset.iconData}" alt="" draggable="false"></div>`;
 if(asset.source==='github'||asset.source==='cloudflare')return `<div class="art source-art" aria-hidden="true">${icon(asset.type)}</div>`;
 if(['note','orbit','build','rack','rack2','figma','claude','db','db2'].includes(asset.art))return `<div class="art" aria-hidden="true"><img src="assets/${asset.art}.png" alt="" width="320" height="320" draggable="false"></div>`;
 const wrap=(bg,body)=>`<div class="art" style="background:${bg}" aria-hidden="true"><svg viewBox="0 0 220 130" fill="none">${body}</svg></div>`;
 switch(asset.art){
 case 'note':return wrap('#dce5cf','<rect x="52" y="14" width="115" height="130" rx="5" fill="#fafbf2" transform="rotate(-9 52 14)"/><path d="M76 44h56m-56 10h42m-42 31h54m-54 9h34" stroke="#c0cbb1" stroke-width="3"/><path d="M115 65c-18-25-35-5-16 9l16 11 16-11c19-14 2-34-16-9" fill="#7e9868"/><text x="66" y="34" font-family="Georgia" font-size="10" fill="#617452" transform="rotate(-9 66 34)">a little halfnote.</text>');
 case 'orbit':return wrap('#e5e5f2','<circle cx="110" cy="65" r="31" fill="#c4bce0"/><ellipse cx="110" cy="65" rx="68" ry="22" transform="rotate(-28 110 65)" stroke="#81759e" stroke-width="1.4"/><ellipse cx="110" cy="65" rx="55" ry="27" transform="rotate(42 110 65)" stroke="#f9f7ff" stroke-width="1.5"/><circle cx="161" cy="35" r="7" fill="#736990"/><circle cx="76" cy="101" r="4" fill="#fcf9ed"/>');
 case 'build':return wrap('#e9cda9','<path d="m65 76 37-21 38 21-38 22Z" fill="#926847"/><path d="m65 76 37 22v28l-37-22Z" fill="#b38961"/><path d="m102 98 38-22v28l-38 22Z" fill="#d0a47a"/><path d="m95 40 37-21 38 21-38 22Z" fill="#f5e4c9"/><path d="m95 40 37 22v28l-37-22Z" fill="#d9b792"/><path d="m132 62 38-22v28l-38 22Z" fill="#bb916b"/><circle cx="48" cy="28" r="3" fill="#fff4df"/>');
 case 'rack':case 'rack2': {const dark=asset.art==='rack';return wrap(dark?'#d6e3eb':'#dce6e7',`<ellipse cx="110" cy="116" rx="52" ry="7" fill="#738e9d" opacity=".14"/><path d="m73 27 29-15 49 12-27 17Z" fill="${dark?'#8ba4b5':'#9db5b6'}"/><path d="m124 41 27-17v74l-27 16Z" fill="#698796"/><rect x="73" y="27" width="52" height="87" rx="5" fill="${dark?'#b4c9d5':'#bed0ce'}"/>${[38,61,84].map(y=>`<rect x="80" y="${y}" width="38" height="18" rx="3" fill="#eaf0f2"/><circle cx="87" cy="${y+9}" r="2" fill="#7e98a5"/><path d="M97 ${y+7}h14m-14 4h14" stroke="#b6c8cc" stroke-width="1.5"/>`).join('')}`);}
 case 'figma':return wrap('#eee9e3','<rect x="83" y="20" width="28" height="28" rx="14" fill="#ee785e"/><path d="M111 20h14a14 14 0 0 1 0 28h-14Z" fill="#eda597"/><path d="M97 48h14v28H97a14 14 0 0 1 0-28" fill="#a58acf"/><circle cx="125" cy="62" r="14" fill="#79b6d2"/><path d="M97 76h14v14a14 14 0 1 1-14-14" fill="#8ab59b"/>');
 case 'claude':return wrap('#efdfcd',`<g transform="translate(110 65)" stroke="#bc7755" stroke-width="6" stroke-linecap="round">${Array.from({length:12},(_,i)=>`<path d="M${Math.cos(i*Math.PI/6)*12} ${Math.sin(i*Math.PI/6)*12} ${Math.cos(i*Math.PI/6)*(i%2?33:40)} ${Math.sin(i*Math.PI/6)*(i%2?33:40)}"/>`).join('')}</g>`);
 case 'db':case 'db2':return wrap(asset.art==='db'?'#d9e6df':'#e3dff0',`<ellipse cx="110" cy="110" rx="45" ry="7" fill="#708b83" opacity=".12"/><path d="M73 37v53c0 25 74 25 74 0V37" fill="${asset.art==='db'?'#8bab9c':'#ada0c7'}"/><ellipse cx="110" cy="37" rx="37" ry="14" fill="${asset.art==='db'?'#bed6c9':'#d1c7e5'}"/><path d="M73 56c0 21 74 21 74 0M73 74c0 21 74 21 74 0" stroke="#ffffff60" stroke-width="2"/><path d="m115 53-17 24h12l-5 15 20-24h-14Z" fill="#fff" opacity=".85"/>`);
 default:return wrap('#e4e9db',`<text x="110" y="85" text-anchor="middle" font-size="55" font-family="Georgia" fill="#849775">${esc(asset.name.slice(0,1).toUpperCase())}</text>`);
 }
}
function matches(a){return !query||[a.name,a.provider,a.purpose,a.reason,a.account,cats[a.type]?.name].join(' ').toLowerCase().includes(query.toLowerCase());}
function safeManagementUrl(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&url.hostname&&!url.username&&!url.password?url.href:null;}catch{return null;}}
function displayName(a){return a.source==='github'&&a.name.includes('/')?a.name.slice(a.name.indexOf('/')+1):a.name;}
function eventInfo(a){if(a.syncMissing)return {text:'本次未返回',cls:'warn'};const status=assetDateStatus(a);if(status.level==='none')return {text:a.event||'日期待补充',cls:''};return {text:status.label,cls:status.level==='overdue'?'warn overdue':status.level==='soon'?'warn':''};}
function card(a,canDemote=false){const link=safeManagementUrl(a.url),event=eventInfo(a);return `<article class="asset-card" data-asset="${esc(a.id)}">${editing?`<button class="asset-drag-handle" draggable="true" aria-label="拖动 ${esc(a.name)} 排序，也可用方向键">⠿</button>`:''}<button class="card-open" data-action="detail" data-id="${esc(a.id)}" aria-label="查看 ${esc(a.name)} 详情">${art(a)}<div class="card-copy"><span class="card-name" title="${esc(a.name)}">${esc(displayName(a))}</span><span class="card-provider">${esc(a.provider)} · ${esc(a.account)}</span><span class="card-purpose">${esc(a.purpose||'用途待补充')}</span></div></button><div class="card-foot"><span class="card-event ${event.cls}"><i class="dot"></i>${esc(event.text)}</span>${canDemote?`<button class="repo-swap" data-action="repo-swap" data-id="${esc(a.id)}" aria-label="将 ${esc(a.name)} 移到下方列表">移到列表</button>`:''}<button class="card-hide" data-action="hide-asset" data-id="${esc(a.id)}" aria-label="隐藏 ${esc(a.name)}">隐藏</button>${link&&new URL(link).hostname!=='example.com'?`<button class="open-link" data-action="external" data-id="${esc(a.id)}" aria-label="打开 ${esc(a.name)} 管理链接">↗</button>`:''}</div></article>`;}
function flippedCard(a){return `<article class="asset-card flip-card" data-asset="${esc(a.id)}"><div class="flip-inner"><div class="flip-face front">${art(a)}<div class="card-copy"><span class="card-name">${esc(displayName(a))}</span></div></div><div class="flip-face back"><span class="flip-label">已隐藏</span><strong title="${esc(a.name)}">${esc(displayName(a))}</strong><span class="flip-note">仅在本机隐藏，可随时恢复；不表示退订或删除线上资源。</span><div class="flip-actions"><button class="button" data-action="restore-asset" data-id="${esc(a.id)}">恢复</button><button class="button" data-action="delete-asset" data-id="${esc(a.id)}">删除记录</button></div></div></div></article>`;}
function compactRepository(a){return `<div class="compact-repo" data-asset="${esc(a.id)}">${editing?`<button class="asset-drag-handle" draggable="true" aria-label="拖动 ${esc(a.name)} 排序，也可用方向键">⠿</button>`:''}<button class="compact-repo-open" data-action="detail" data-id="${esc(a.id)}" aria-label="查看 ${esc(a.name)} 详情" title="${esc(a.name)}">${icon('repository')}<span>${esc(displayName(a))}</span></button><button class="repo-swap" data-action="repo-swap" data-id="${esc(a.id)}" aria-label="将 ${esc(a.name)} 显示为卡片">显示卡片</button></div>`;}
function renderBlock(b){
 const viewingHidden=showHiddenBlocks.has(b.id);
 const typed=state.assets.filter(a=>a.type===b.id&&matches(a));
 const hiddenCount=state.assets.filter(a=>a.type===b.id&&isHidden(a)).length;
 const visible=orderAssets(typed.filter(a=>!isHidden(a)),state.cardOrder?.[b.id]);
 const hiddenAssets=orderAssets(typed.filter(a=>isHidden(a)),state.cardOrder?.[b.id]);
 const assets=viewingHidden?hiddenAssets:visible;
 const collapsed=b.collapsed&&!query&&!focusCategory;
 const fixed=b.height&&!collapsed&&!focusCategory&&!query&&!viewingHidden;
 const levels=state.assets.filter(a=>a.type===b.id&&!isHidden(a)).map(a=>assetDateStatus(a).level),overdue=levels.filter(level=>level==='overdue').length,soon=levels.filter(level=>level==='soon').length;
 const summary=[overdue&&`${overdue} 项已过期`,soon&&`${soon} 项即将到期`].filter(Boolean).join(' · ');
 const repositoryLayout=b.id==='repository'&&!query&&!focusCategory&&!collapsed&&!viewingHidden&&assets.length>6;
 const rawGroups=repositoryLayout?repositoryGroups(assets,state.featuredRepositoryIds):null;
 const groups=rawGroups?{featured:orderAssets(rawGroups.featured,state.cardOrder?.repository),compact:orderAssets(rawGroups.compact,state.cardOrder?.repository)}:null;
 const searchHiddenHtml=(!viewingHidden&&query&&hiddenAssets.length)?hiddenAssets.map(flippedCard).join(''):'';
 const cardsHtml=viewingHidden?assets.map(flippedCard).join(''):groups?`${groups.featured.map(a=>card(a,true)).join('')}<div class="compact-repositories"><div class="compact-repositories-title">其余 ${groups.compact.length} 个仓库</div><div class="compact-repositories-grid">${groups.compact.map(compactRepository).join('')}</div></div>${searchHiddenHtml}`:(assets.map(a=>card(a)).join('')+searchHiddenHtml);
 const emptyHtml=viewingHidden?'<div class="block-empty">这个区块没有已隐藏的资产</div>':`<button type="button" class="block-empty" data-action="add-asset" data-id="${b.id}">添加你的第一项资产</button>`;
 const hiddenToggle=hiddenCount?`<button class="text-button hidden-toggle ${viewingHidden?'active':''}" data-action="toggle-hidden" data-id="${b.id}" aria-pressed="${viewingHidden}" title="${viewingHidden?'返回显示未隐藏资产':'查看本区块已隐藏资产'}">${viewingHidden?'返回':`已隐藏 (${hiddenCount})`}</button>`:'';
 return `<section class="block ${b.id} ${collapsed?'collapsed':''} ${fixed?'fixed':''} ${viewingHidden?'showing-hidden':''}" data-block="${b.id}" style="--width:${b.width};--compact-columns:${Math.min(2,Math.max(1,assets.length||1))}">
 <header class="block-head"><button class="drag-handle icon-button" draggable="true" aria-label="拖动${cats[b.id].name}区块">⠿</button>
 <button class="block-title" data-action="collapse" data-id="${b.id}" aria-expanded="${!collapsed}" aria-controls="cards-${b.id}" title="${collapsed?'展开资产卡片':'切换为图标与名称'}"><span>${cats[b.id].name}</span><span class="asset-count">${viewingHidden?hiddenCount:visible.length}</span><span class="chevron">${collapsed?'⌄':'⌃'}</span></button>
 ${summary&&!viewingHidden?`<span class="block-summary ${overdue?'overdue':''}">${summary}</span>`:''}
 <div class="block-actions">${hiddenToggle}<button class="text-button" data-action="all" data-id="${b.id}" aria-label="查看全部${cats[b.id].name}" hidden>查看全部</button><button class="icon-button" data-action="add-asset" data-id="${b.id}" aria-label="添加${cats[b.id].name}资产">＋</button><button class="icon-button" data-action="settings" data-id="${b.id}" aria-label="${cats[b.id].name}区块设置">⋯</button></div></header>
 <div class="cards" id="cards-${b.id}" ${fixed?`style="height:${b.height}px"`:''}>${cardsHtml||emptyHtml}</div>
 ${!collapsed?`<div class="resize-handle" role="separator" aria-label="调整${cats[b.id].name}区块大小"></div>`:''}</section>`;
}
let layoutFrame=0;
function render(){
 if(typeof applyBoardTheme==='function'&&!themePreview)applyBoardTheme(state.theme);
 cancelAnimationFrame(layoutFrame);
 const previous=new Map([...document.querySelectorAll('.block')].map(el=>[el.dataset.block,el.getBoundingClientRect()]));
 document.body.classList.toggle('editing',editing);$('#editbar').hidden=!editing;$('#edit').textContent=editing?'完成':'调整布局';$('#edit').setAttribute('aria-pressed',String(editing));$('#undo').disabled=!history.length;
 $('#board').classList.toggle('full-view',!!focusCategory);$('#focusbar').hidden=!focusCategory;$('#focusbar').innerHTML=focusCategory?`<button class="button" data-action="back">← 返回大板</button><strong>${esc(cats[focusCategory].name)} · 全部资产</strong>`:'';
 const blocks=query?Object.keys(cats).filter(id=>state.assets.some(a=>a.type===id&&matches(a))).map(id=>state.blocks.find(b=>b.id===id)||{id,width:50}):state.blocks.filter(b=>!focusCategory||b.id===focusCategory);
 const welcome=!query&&state.assets.length===0;
 $('#board').hidden=welcome;$('#welcome').hidden=!welcome;
 document.querySelectorAll('#welcome .native-only').forEach(el=>el.hidden=!nativeStore);
 $('#board').innerHTML=blocks.map(renderBlock).join('');
 renderAgenda();
 $('#empty').hidden=welcome||blocks.length>0;
 $('#empty-title').textContent=query?'没有找到这项资产':'资产还没摆上大板';
 $('#empty-note').textContent=query?'试试名称、平台或用途，收起区块中的资产也会被搜索。':'添加一个类别区块，就能看到已录入的资产。';
 $('#clear-search').textContent=query?'清除搜索':'添加区块';
 layoutFrame=requestAnimationFrame(()=>{
  layoutFrame=0;updateOverflow();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const positions=[...document.querySelectorAll('.block')].map(el=>({el,from:previous.get(el.dataset.block),to:el.getBoundingClientRect()}));
  for(const {el,from,to} of positions){
   if(!from||!to.width||!to.height)continue;
   const dx=from.left-to.left,dy=from.top-to.top,sx=from.width/to.width,sy=from.height/to.height;
   if(Math.abs(dx)>1||Math.abs(dy)>1||Math.abs(from.width-to.width)>1||Math.abs(from.height-to.height)>1){
    el.animate([{transformOrigin:'0 0',transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`},{transformOrigin:'0 0',transform:'none'}],{duration:240,easing:'cubic-bezier(.22,1,.36,1)'});
   }
  }
 });
}
function syncToolbar(){const pending=pendingCount();$('#inbox-button').textContent=pending?`待确认 ${pending}`:'待确认';if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'toolbarState',editing,query,pending});}
function agendaItem({asset,status}){return `<button class="agenda-item ${status.level}" data-action="detail" data-id="${esc(asset.id)}"><strong>${esc(displayName(asset))}</strong><span>${esc(status.label)}${asset.cost&&asset.cost!=='未知'?' · '+esc(asset.cost):''}</span>${asset.reason?`<small>${esc(asset.reason)}</small>`:''}</button>`;}
function renderAgenda(){
 const bar=$('#agenda'),events=upcomingEvents(state.assets),dated=state.assets.some(a=>!isHidden(a)&&dayNumber(a.date)!==null);
 bar.hidden=!!query||!!focusCategory||!state.assets.length;
 const body=events.length?events.slice(0,3).map(agendaItem).join('')+(events.length>3?`<button class="text-button" data-action="agenda-all">全部 ${events.length} 项</button>`:''):dated?'<span class="agenda-empty">60 天内没有到期或扣款</span><button class="text-button" data-action="agenda-all">查看全部日期</button>':'<button class="text-button agenda-empty" data-action="inbox">还没有记录到期或扣款日期 · 粘贴一段续费通知试试</button>';
 bar.innerHTML=`<span class="agenda-label">接下来</span><div class="agenda-items">${body}</div>`;
 syncToolbar();
}
function agendaAll(){const events=upcomingEvents(state.assets,new Date(),Infinity);modal('全部日期',events.length?`<div class="agenda-list">${events.map(agendaItem).join('')}</div><p class="form-note">按日期排序，已隐藏的资产不在此列。设为每月或每年重复的日期会自动顺延到下一次。</p>`:'<p class="form-note">还没有资产记录日期。在资产资料中填写“下一日期”，或从待确认资料中补充。</p>');}
function updateOverflow(){
 const grids=[...document.querySelectorAll('.block.fixed')].map(block=>{const grid=block.querySelector('.cards'),cards=[...grid.querySelectorAll('.asset-card')],style=getComputedStyle(grid),bottom=parseFloat(style.paddingBottom)||0;return {block,grid,cards,bottom,minHeight:(cards[0]?.offsetHeight||100)+(parseFloat(style.paddingTop)||0)+bottom};});
 for(const {grid,minHeight} of grids){const value=minHeight+'px';if(grid.style.minHeight!==value)grid.style.minHeight=value;}
 const visibility=grids.map(item=>{const limit=item.grid.offsetTop+item.grid.clientHeight-item.bottom+1;return {...item,hidden:item.cards.map(card=>card.offsetTop+card.offsetHeight>limit)};});
 for(const {block,cards,hidden} of visibility){cards.forEach((card,i)=>{const value=hidden[i]?'hidden':'';if(card.style.visibility!==value)card.style.visibility=value;if(card.inert!==hidden[i])card.inert=hidden[i];});const all=block.querySelector('[data-action="all"]');all.hidden=!hidden.some(Boolean);all.title='还有资产未显示，查看全部';}
}
function sourceLabel(a){if(a.syncMissing)return `${a.source==='github'?'GitHub':'Cloudflare'} 本次未返回`;if(a.source==='github')return `GitHub 仓库 · ${a.syncStatus||'状态未知'}`;if(a.source==='cloudflare')return `Cloudflare ${a.resourceKind||'Zone'} · ${a.syncStatus||'状态未知'}`;return a.source==='manual'?'手动录入':'演示资产';}
function dateText(a){const status=assetDateStatus(a);if(status.level==='none')return a.date||'待补充';return `${status.date} · ${status.label}${billingCycles[a.cycle]?` · ${billingCycles[a.cycle].label}重复`:''}`;}
function showDetail(id){const a=state.assets.find(a=>a.id===id);if(!a)return;lastFocus=document.activeElement;activeAsset=id;const link=safeManagementUrl(a.url),realLink=link&&new URL(link).hostname!=='example.com',lastSync=a.syncedAt&&!isNaN(Date.parse(a.syncedAt))?new Date(a.syncedAt).toLocaleString('zh-CN'):'';$('#detail-content').innerHTML=`${art(a)}<span class="eyebrow">${esc(cats[a.type].name)} / ASSET DETAILS</span><h2>${esc(a.name)}</h2><p class="detail-sub">${esc(a.provider)} · ${esc(a.account)}</p><span class="detail-badge">${esc(a.purpose||'用途待补充')}</span><div class="detail-actions">${realLink?`<button class="button primary" data-action="external" data-id="${esc(id)}">打开管理 ↗</button>`:''}<button class="button" data-action="edit-asset" data-id="${esc(id)}">编辑资料</button></div><div class="detail-actions secondary-actions"><button class="button" data-action="${a.hiddenAt?'restore-asset':'hide-asset'}" data-id="${esc(id)}">${a.hiddenAt?'恢复显示':'隐藏'}</button><button class="button danger-quiet" data-action="delete-asset" data-id="${esc(id)}">删除记录</button></div><p class="form-note detail-note-inline">隐藏只在本机生效，可随时恢复；删除只清除 Assetboard 记录，不会取消订阅或删除线上资源。</p><div class="facts">${[['保留原因',a.reason||'待补充'],['关联用途',a.purpose||'待补充'],['费用',a.cost||'未知'],['下一日期',dateText(a)],['账号',a.account],['记录状态',sourceLabel(a)],...(lastSync?[['最近同步',lastSync]]:[])].map(([k,v])=>`<div class="fact"><span>${k}</span><span>${esc(v)}</span></div>`).join('')}</div><details><summary>备注与来源</summary><p>${esc(a.notes||'暂无补充备注。')}</p>${a.source==='cloudflare'?'<p>同步自 Cloudflare 授权资源列表；列表元数据不能确定账单或到期日。编辑名称或账号后，下次同步会使用平台值。</p>':a.source==='github'?'<p>同步自 GitHub 仓库元数据；不读取代码、密钥或账单。编辑名称或账号后，下次同步会使用平台值。</p>':a.source==='manual'?'<p>此记录由你手动录入。</p>':'<p>此记录为原型演示数据，金额和日期不代表实际账户。</p>'}</details>`;$('#detail').hidden=false;$('#close-detail').focus();}
function closeDetail(){ $('#detail').hidden=true;activeAsset=null;if(lastFocus?.isConnected)lastFocus.focus();}
function modal(title,html,view=''){$('#modal-title').textContent=title;$('#modal-content').innerHTML=html;$('#modal').dataset.view=view;if(!html.includes('id="asset-form"')&&!html.includes("id='asset-form'")&&!html.includes('id="dirty-save"'))assetFormSnapshot=null;if(nativeStore)$('#modal-content').querySelectorAll('.form-note').forEach(el=>{if(el.textContent.includes('浏览器'))el.textContent=el.textContent.replaceAll('当前浏览器','此 Mac').replaceAll('此浏览器','此 Mac');});if(!$('#modal').open)$('#modal').showModal();}
function addBlock(){modal('给大板添一个区块',Object.entries(cats).map(([id,c])=>`<button class="category-choice" data-action="choose-block" data-id="${id}" ${state.blocks.some(b=>b.id===id)?'disabled':''}><span>${c.symbol}</span><span>${c.name}<small>${c.hint}</small></span><span class="plus">${state.blocks.some(b=>b.id===id)?'✓':'＋'}</span></button>`).join('')+'<p class="form-note">区块按类别展示已有资产。添加后可以自由移动、调整大小。</p>');}
function manualImport(){modal('选择资产类别',Object.entries(cats).map(([id,c])=>`<button class="category-choice" data-action="choose-asset-type" data-id="${id}"><span>${c.symbol}</span><span>${c.name}<small>${c.hint}</small></span><span class="plus">＋</span></button>`).join(''));}

function snapshotAssetForm(form){if(!form)return null;const data=new FormData(form);const values={};for(const [k,v] of data.entries()){if(k==='icon')continue;values[k]=String(v);}return {id:form.dataset.id||'',type:form.dataset.type||'',values,hadFile:false};}
function isAssetFormDirty(){const form=$('#asset-form');if(!form||!assetFormSnapshot)return false;if(form.elements.icon?.files?.length)return true;const data=new FormData(form);for(const key of Object.keys(assetFormSnapshot.values)){if(String(data.get(key)??'')!==assetFormSnapshot.values[key])return true;}for(const [k] of data.entries()){if(k==='icon'||k==='removeIcon')continue;if(!(k in assetFormSnapshot.values)&&String(data.get(k)??''))return true;}if(form.elements.removeIcon?.checked)return true;return false;}
function requestCloseModal(){if(isAssetFormDirty()){const resumeTitle=$('#modal-title').textContent,resumeView=$('#modal').dataset.view,live=[...$('#modal-content').childNodes],baseline=assetFormSnapshot;modal('未保存的修改',`<p class="form-note">表单有未保存的内容。可以保存、放弃修改，或继续编辑。</p><div class="dirty-actions"><button class="button primary" id="dirty-save">保存</button><button class="button" id="dirty-discard">放弃</button><button class="button" id="dirty-keep">继续编辑</button></div>`);const resume=()=>{$('#modal-title').textContent=resumeTitle;$('#modal').dataset.view=resumeView;$('#modal-content').replaceChildren(...live);assetFormSnapshot=baseline;};$('#dirty-save').onclick=()=>{resume();$('#asset-form').requestSubmit();};$('#dirty-discard').onclick=()=>{assetFormSnapshot=null;$('#modal').close();};$('#dirty-keep').onclick=resume;return;}assetFormSnapshot=null;$('#modal').close();}
function assetForm(type,id,fill={},candidateKey=''){const a=id?state.assets.find(a=>a.id===id):null,v={...(a||{}),...fill},link=safeManagementUrl(v.url),synced=['cloudflare','github'].includes(a?.source),kind=dateKinds[v.dateKind]?v.dateKind:'expire';modal(a?'编辑资产资料':`添加${cats[type].name}资产`,`<form id="asset-form" class="form" data-type="${type}" data-id="${id||''}" data-candidate="${esc(candidateKey)}"><label>资产名称<input name="name" required maxlength="100" value="${esc(v.name||'')}" placeholder="例如 my-project.dev"></label>${synced?'':`<label>类别<select name="type">${Object.entries(cats).map(([key,c])=>`<option value="${key}" ${key===type?'selected':''}>${c.name}</option>`).join('')}</select></label>`}<label>平台<input name="provider" maxlength="80" value="${esc(v.provider||'')}" placeholder="例如 Cloudflare"></label><label>账号<input name="account" maxlength="100" value="${esc(v.account||'')}" placeholder="用于区分同平台的账号"></label><label>用途<input name="purpose" maxlength="100" value="${esc(v.purpose||'')}" placeholder="它用来做什么？"></label><label>保留原因<input name="reason" maxlength="120" value="${esc(v.reason||'')}" placeholder="为什么还留着它？例如：客户站点仍在使用"></label><div class="field-row"><label>下一日期<input type="date" name="date" value="${esc(v.date||'')}"></label><label>日期类型<select name="dateKind">${Object.entries(dateKinds).map(([key,k])=>`<option value="${key}" ${key===kind?'selected':''}>${k.label}</option>`).join('')}</select></label><label>重复<select name="cycle"><option value="">不重复</option>${Object.entries(billingCycles).map(([key,c])=>`<option value="${key}" ${key===v.cycle?'selected':''}>${c.label}</option>`).join('')}</select></label></div><span class="form-note">设为每月或每年重复后，日期过去会自动顺延到下一次。</span><label>费用说明<input name="cost" maxlength="80" value="${esc(v.cost==='未知'?'':v.cost||'')}" placeholder="例如 ¥ 89 / 年"></label><label>管理链接<input name="url" type="url" maxlength="2000" value="${esc(link&&new URL(link).hostname!=='example.com'?link:'')}" placeholder="https://..." pattern="https?://.*"></label><label>自定义图标<input name="icon" type="file" accept="image/png,image/jpeg,image/webp"></label>${a?.iconData?'<label class="check-label"><input name="removeIcon" type="checkbox">移除当前自定义图标</label>':''}<span class="form-note">PNG、JPEG 或 WebP，最大 256 KB。图标随本机资产备份保存。</span><label>备注<textarea name="notes" rows="3" maxlength="2000">${esc(v.notes||'')}</textarea></label><button class="button primary" type="submit">${a?'保存修改':'添加资产'}</button><span class="form-note">资产资料仅保存在${nativeStore?'此 Mac':'此浏览器'}；管理链接会在系统浏览器中打开。</span></form>`);const form=$('#asset-form');assetFormSnapshot=snapshotAssetForm(form);}
function cloudflareDialog(){
 if(!nativeStore){toast('Cloudflare 同步仅在 macOS App 中可用');return;}
 const connected=nativeStore.cloudflareConnected;
 modal('Cloudflare · 只读同步',`<div class="form"><p class="form-note">使用 Cloudflare API Token。按需授予 Zone Read、Account Read、Pages Read、Workers Scripts Read 和 R2 Storage Read。应用只列出授权范围内的 Zone、Pages 项目、Worker 脚本与 R2 Bucket，不读取脚本代码、对象内容或账单。权限不足的类别会明确跳过。</p><button class="button" data-action="setup-cloudflare">前往 Cloudflare 网页创建只读 Token ↗</button><label>${connected?'更换令牌（留空则使用已保存令牌）':'只读 API 令牌'}<input id="cloudflare-token" type="password" autocomplete="off" spellcheck="false" placeholder="${connected?'留空使用现有令牌':'粘贴令牌'}"></label><p id="cloudflare-status" class="form-note">${connected?'已连接 · 可重新同步或更换令牌':nativeStore.cloudflareChecking?'正在检查本机钥匙串…':nativeStore.keychainUnavailable?'本机钥匙串暂未响应，可重新输入令牌同步':'尚未连接'}</p><button id="cloudflare-sync" class="button primary">${connected?'重新同步':'验证权限并同步'}</button>${connected?'<button id="cloudflare-disconnect" class="button">断开本机连接</button>':''}<p class="form-note">令牌经验证后存入 macOS 钥匙串。断开不会撤销 Cloudflare 后台的令牌，已同步资产仍保留。</p></div>`);
 $('#cloudflare-sync').onclick=()=>{const token=$('#cloudflare-token').value;$('#cloudflare-token').value='';$('#cloudflare-sync').disabled=true;$('#cloudflare-status').textContent='正在验证权限并读取全部分页…';window.webkit.messageHandlers.assetboard.postMessage({action:'cloudflareSync',token});};
 if(connected)$('#cloudflare-disconnect').onclick=()=>window.webkit.messageHandlers.assetboard.postMessage({action:'cloudflareDisconnect'});
}
window.assetboardCloudflareResult=result=>{
 if(!result.ok){const status=$('#cloudflare-status');if(status)status.textContent=result.error||'同步失败';const button=$('#cloudflare-sync');if(button)button.disabled=false;return;}
 if(result.disconnected){nativeStore.cloudflareConnected=false;cloudflareDialog();toast('已删除本机保存的 Cloudflare 令牌');return;}
 checkpoint();const merge=mergeCloudflare(state,result);state=merge.board;
 nativeStore.cloudflareConnected=true;save();render();$('#modal').close();toast(`Cloudflare 读取 ${merge.read} 项，新增 ${merge.added} 项`,true);
 syncFollowUp('Cloudflare',merge,result.warnings||[]);
};
function githubDialog(){
 if(!nativeStore){toast('GitHub 同步仅在 macOS App 中可用');return;}
 const connected=nativeStore.githubConnected;
 modal('GitHub · 只读同步',`<div class="form"><p class="form-note">推荐创建 GitHub 细粒度个人访问令牌，只选择需要整理的仓库，仓库权限保留 Metadata → Read。也可使用已有令牌，但其实际权限可能更广。应用只读取授权范围内的仓库名称、归属、可见性、归档状态和链接；不请求代码或账单。组织仓库可能需要管理员审批。</p><button id="github-local-sync" class="button primary">使用本机 gh 登录同步</button><span class="form-note">需已安装并登录 GitHub CLI。此次不会将令牌另存到 Assetboard 钥匙串；后续可再次用 gh 同步。</span><label>${connected?'更换令牌（留空则使用已保存令牌）':'或者填写 GitHub 令牌'}<input id="github-token" type="password" autocomplete="off" spellcheck="false" placeholder="${connected?'留空使用现有令牌':'粘贴令牌'}"></label><p id="github-status" class="form-note">${connected?'已连接 · 可重新同步或更换令牌':'尚未连接'}</p><button id="github-sync" class="button">${connected?'使用已保存令牌重新同步':'验证填写的令牌并同步'}</button>${connected?'<button id="github-disconnect" class="button">断开本机连接</button>':''}<p class="form-note">填写的令牌经验证后保存在 macOS 钥匙串。断开会删除 Assetboard 保存的令牌，已同步资产仍保留；彻底撤销访问需前往 GitHub 后台删除令牌。</p></div>`);
 $('#github-local-sync').onclick=()=>{$('#github-local-sync').disabled=true;$('#github-status').textContent='正在使用本机 gh 登录读取仓库…';window.webkit.messageHandlers.assetboard.postMessage({action:'githubSyncLocal'});};
 $('#github-sync').onclick=()=>{const token=$('#github-token').value;$('#github-token').value='';$('#github-sync').disabled=true;$('#github-status').textContent='正在验证权限并读取全部分页…';window.webkit.messageHandlers.assetboard.postMessage({action:'githubSync',token});};
 if(connected)$('#github-disconnect').onclick=()=>window.webkit.messageHandlers.assetboard.postMessage({action:'githubDisconnect'});
}
function gmailDialog(){
 if(!nativeStore){toast('Gmail 导入仅在 macOS App 中可用');return;}
 modal('Gmail · 本地筛选导入',`<div class="form"><p class="form-note">先在 Google Cloud 网页启用 Gmail API，创建“桌面应用”OAuth 客户端并下载 JSON。授权使用 Gmail Readonly：Google 授予的是整个邮箱只读权限；Assetboard 实际只搜索账单、收据、续费、订阅和服务通知，不发送或修改邮件。匹配内容仅保存在此 Mac 的 SQLite 数据库。</p><button class="button" data-action="setup-gmail">前往 Google Cloud 获取 OAuth 客户端 ↗</button><button id="gmail-sync" class="button primary">${nativeStore.gmailConfigured?'重新搜索并导入匹配邮件':'选择 OAuth JSON 并授权导入'}</button>${nativeStore.gmailConfigured?'<button id="gmail-reconfigure" class="button">更换 OAuth 客户端 JSON</button>':''}<p id="gmail-status" class="form-note">筛选词：invoice、receipt、billing、renewal、subscription、payment、账单、续费、订阅、服务通知。只搜索最近 14 个月，最多处理 2000 封匹配邮件；超出时本次不写入。导入后在“待确认”中逐组核对。</p></div>`);
 $('#gmail-sync').onclick=()=>{$('#gmail-sync').disabled=true;$('#gmail-status').textContent='正在本机完成授权并读取匹配邮件；首次连接会打开 Google 授权网页…';window.webkit.messageHandlers.assetboard.postMessage({action:'gmailSync'});};
 if(nativeStore.gmailConfigured)$('#gmail-reconfigure').onclick=()=>{window.webkit.messageHandlers.assetboard.postMessage({action:'gmailSync',configure:true});};
}
window.assetboardGmailResult=result=>{
 if(!result.ok){const status=$('#gmail-status');if(status)status.textContent=result.error||'Gmail 导入失败';const button=$('#gmail-sync');if(button)button.disabled=false;return;}
 nativeStore.gmailConfigured=true;$('#modal').close();toast(`Gmail 本地导入完成：匹配 ${result.count} 封邮件`);requestEvidence(()=>inboxDialog(false));
};
window.assetboardGitHubResult=result=>{
 if(!result.ok){const status=$('#github-status');if(status)status.textContent=result.error||'同步失败';for(const id of ['#github-sync','#github-local-sync']){const button=$(id);if(button)button.disabled=false;}return;}
 if(result.disconnected){nativeStore.githubConnected=false;githubDialog();toast('已删除本机保存的 GitHub 令牌');return;}
 checkpoint();const merge=mergeGitHub(state,result);state=merge.board;
 nativeStore.githubConnected=!!result.connected||nativeStore.githubConnected;save();render();$('#modal').close();toast(`GitHub 读取成功：读取 ${merge.read} 个仓库，新增 ${merge.added} 项`,true);
 syncFollowUp('GitHub',merge,[]);
};
let pendingCollisions=[];
function syncFollowUp(source,merge,warnings){
 pendingCollisions=merge.collisions;if(!pendingCollisions.length&&!warnings.length)return;
 const warningHtml=warnings.length?`<p class="form-note">已导入可读取的 ${merge.read} 项；以下类别未读取，已有记录不会被删除或标记为缺失：</p>${warnings.map(message=>`<p class="form-note">${esc(message)}</p>`).join('')}`:'';
 const collisionHtml=pendingCollisions.length?`<p class="form-note">以下资源与已有本地记录同名，但无法用平台唯一 ID 确认是同一项。勾选的记录会用同步结果覆盖名称、账号等平台字段；只改 Assetboard 记录，不会取消订阅或删除线上资源。未勾选的下次同步会再询问。</p><div class="collision-list">${pendingCollisions.map((item,index)=>`<label class="check-label"><input type="checkbox" name="collision" value="${index}">${esc(item.name)}</label>`).join('')}</div><div class="confirm-actions"><button class="button primary" data-action="apply-collisions">覆盖所选</button><button class="button" data-action="close-modal">保留本地记录</button></div>`:'';
 modal(pendingCollisions.length?`${source} 同步：同名记录待确认`:`${source} 部分类别未读取`,warningHtml+collisionHtml);
}
window.assetboardOCRResult=result=>{
 if(!result.ok){toast(result.error||'本地识别失败');return;}
 requestEvidence(()=>{const candidate=candidates().find(item=>item.ids.includes(result.id));if(candidate)candidateReview(candidate);else inboxDialog(false);});
};
// Imported evidence stays in SQLite; decisions about it live in the board so undo keeps both in step.
let evidenceRows=[],evidenceVersion=0,candidateCache={key:null,list:[]},afterEvidence=null,pasteCandidate=null,pasteRow=null;
const evidenceKinds={gmail:'Gmail',ocr:'截图/PDF',paste:'粘贴的文字'};
function candidates(){const decisions=state.evidenceDecisions||{},key=`${evidenceVersion}|${JSON.stringify(decisions)}|${state.assets.map(a=>a.id+'\u0001'+a.name).join('\u0002')}`;if(candidateCache.key!==key)candidateCache={key,list:buildCandidates(evidenceRows,{assets:state.assets,decisions})};return candidateCache.list;}
function pendingCount(){return candidates().filter(item=>item.pending&&!item.weak).length;}
function findCandidate(key){return key==='paste'?pasteCandidate:candidates().find(item=>item.key===key);}
function requestEvidence(then){afterEvidence=then||null;if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'evidenceList'});else{afterEvidence=null;then?.();}}
window.assetboardEvidenceList=(rows,error)=>{
 if(Array.isArray(rows)){evidenceRows=rows;evidenceVersion++;}else if(error)toast(error);
 renderAgenda();const next=afterEvidence;afterEvidence=null;
 if(next)next();else if($('#modal').open&&$('#modal').dataset.view==='inbox')inboxDialog(false);
};
function candidateChips(c){const match=c.match&&state.assets.find(a=>a.id===c.match);return [`<span class="chip">${esc(cats[c.type].name)}</span>`,c.cost&&`<span class="chip">${esc(c.cost)}</span>`,c.date&&`<span class="chip ${c.date.source}">${esc(c.date.value)} ${esc(dateKinds[c.date.kind].label)}${c.date.source==='inferred'?' · 推算':''}</span>`,match&&`<span class="chip match">可能对应 ${esc(displayName(match))}</span>`].filter(Boolean).join('');}
function decisionLabel(c){const decision=(state.evidenceDecisions||{})[c.ids[0]],asset=decision?.assetId&&state.assets.find(a=>a.id===decision.assetId);return decision?.status==='dismissed'?'已忽略':`${decision?.status==='linked'?'已补充到':'已新建'}${asset?` ${displayName(asset)}`:'资产'}`;}
function candidateRow(c){return `<article class="candidate ${c.pending?'':'resolved'}"><div class="candidate-main"><strong>${esc([c.merchant||c.latest.title||'未识别来源',c.name&&c.name!==c.merchant?c.name:''].filter(Boolean).join(' · '))}</strong><span class="candidate-meta">${esc(evidenceKinds[c.latest.kind]||'导入资料')}${c.count>1?` · ${c.count} 封`:''}${c.latest.day!=null?` · 最近 ${isoDay(c.latest.day)}`:''}</span><div class="chips">${candidateChips(c)}</div></div><div class="candidate-actions">${c.pending?`<button class="button" data-action="candidate-review" data-id="${esc(c.key)}">核对</button><button class="text-button" data-action="candidate-dismiss" data-id="${esc(c.key)}">忽略</button>`:`<span class="candidate-status">${esc(decisionLabel(c))}</span><button class="text-button" data-action="candidate-reopen" data-id="${esc(c.key)}">恢复待确认</button>`}</div></article>`;}
function inboxDialog(refresh=true){
 const list=candidates(),pending=list.filter(c=>c.pending),strong=pending.filter(c=>!c.weak),weak=pending.filter(c=>c.weak),resolved=list.filter(c=>!c.pending);
 const paste=`<form class="form inbox-paste" id="paste-form"><label>粘贴续费通知、账单或收据的文字<textarea id="paste-text" rows="3" placeholder="例如：Your plan renews on October 6, 2026 for $15.00/month"></textarea></label><button class="button primary" type="submit">识别</button><span class="form-note">只在${nativeStore?'此 Mac':'此浏览器'}按规则识别，不上传；确认前不会写入资产。</span></form>`;
 const imported=nativeStore||evidenceRows.length?`<div class="inbox-head"><strong>待确认 · ${strong.length}</strong>${nativeStore?'<span><button class="text-button" data-action="gmail-import">导入 Gmail</button><button class="text-button" data-action="ocr-import">识别截图/PDF</button></span>':''}</div>${strong.length?strong.slice(0,100).map(candidateRow).join(''):`<p class="form-note">${evidenceRows.length?'没有待确认的资料。':'还没有导入资料。可以导入 Gmail 账单通知，或识别截图/PDF。'}</p>`}${weak.length?`<details class="inbox-more"><summary>另有 ${weak.length} 组未识别出金额或日期</summary>${weak.slice(0,100).map(candidateRow).join('')}<button class="text-button" data-action="dismiss-weak">全部忽略</button></details>`:''}${resolved.length?`<details class="inbox-more"><summary>已处理 ${resolved.length} 组</summary>${resolved.slice(0,100).map(candidateRow).join('')}</details>`:''}`:'';
 modal('待确认资料',`<div class="inbox">${paste}${imported}</div>`,'inbox');
 if(refresh&&nativeStore)requestEvidence();
}
function candidateReview(c){
 const row=c.key==='paste'?pasteRow:evidenceRows.find(item=>item.id===c.latest.id),match=c.match&&state.assets.find(a=>a.id===c.match);
 const others=state.assets.filter(a=>a.id!==c.match).sort((left,right)=>left.name.localeCompare(right.name));
 const option=a=>`<option value="${esc(a.id)}">补充到：${esc(displayName(a))} · ${esc(cats[a.type].name)}</option>`;
 const facts=[['来源',`${evidenceKinds[c.latest.kind]||'导入资料'}${c.merchant?` · ${c.merchant}`:''}${c.count>1?` · ${c.count} 封`:''}`],['类别推测',cats[c.type].name],['名称',c.name||'待填写'],['金额',c.cost||'未识别'],['日期',c.date?`${c.date.value} ${dateKinds[c.date.kind].label}`:'未识别'],...(c.date?[['日期依据',c.date.basis]]:[]),...(c.domains.length?[['提到的域名',c.domains.slice(0,3).join('、')]]:[])];
 modal('核对识别结果',`<div class="form candidate-review">${c.weak?'<p class="form-note">没有识别出金额或日期。可以直接新建，再手动填写。</p>':''}<div class="facts">${facts.map(([k,v])=>`<div class="fact"><span>${k}</span><span>${esc(v)}</span></div>`).join('')}</div><label>记录到<select id="candidate-target">${match?option(match):''}<option value="">新建一项资产</option>${others.map(option).join('')}</select></label><div class="confirm-actions"><button class="button primary" data-action="candidate-apply" data-id="${esc(c.key)}">下一步：核对资料</button><button class="button" data-action="candidate-dismiss" data-id="${esc(c.key)}">${c.key==='paste'?'放弃':'忽略'}</button></div>${row?`<details><summary>原文 · ${esc(row.title)}</summary><pre class="imported-text">${esc(String(row.body).slice(0,4000))}</pre></details>`:''}<button class="text-button inbox-back" data-action="inbox">← 返回待确认</button></div>`,'review');
}
function candidateFill(c,existing){
 const fill={};if(!existing){fill.name=c.name;fill.provider=c.merchant;}
 if(c.cost)fill.cost=c.cost;if(c.date){fill.date=c.date.value;fill.dateKind=c.date.kind;}if(c.cycle)fill.cycle=c.cycle;
 const note=`依据：${evidenceKinds[c.latest.kind]||'导入资料'}《${c.latest.title}》${c.latest.day!=null&&c.latest.kind==='gmail'?` ${isoDay(c.latest.day)}`:''}${c.date?.source==='inferred'?`；日期${c.date.basis}`:''}`;
 fill.notes=existing?.notes?`${existing.notes}\n${note}`:note;return fill;
}
function resolveCandidate(key,status,assetId){const c=findCandidate(key);if(!c||key==='paste'||!c.pendingIds.length)return 0;state.evidenceDecisions ||= {};for(const id of c.pendingIds)state.evidenceDecisions[id]={status,...(assetId?{assetId}:{}),at:new Date().toISOString()};return c.pendingIds.length;}
document.addEventListener('submit',e=>{if(e.target.id!=='paste-form')return;e.preventDefault();const text=$('#paste-text').value.trim();if(!text){$('#paste-text').focus();return;}pasteRow={id:'paste-'+Date.now(),kind:'paste',source:'',title:text.split('\n')[0].slice(0,60),body:text,importedAt:new Date().toISOString()};pasteCandidate={...buildCandidates([pasteRow],{assets:state.assets})[0],key:'paste'};candidateReview(pasteCandidate);});
function settings(id){const b=state.blocks.find(b=>b.id===id);if(!b)return;modal(`${cats[id].name} · 区块设置`,`<div class="form"><label>区块宽度 · <span id="range-value">${Math.round(b.width)}%</span><input id="block-width" type="range" min="25" max="100" value="${b.width}" aria-label="区块宽度"></label><label>展示高度<select id="block-height"><option value="">随内容自适应</option><option value="240" ${b.height===240?'selected':''}>约一行卡片</option><option value="480" ${b.height===480?'selected':''}>约两行卡片</option></select></label><p class="form-note">这里是键盘与触屏的快捷设置。布局编辑时可直接拖动区块右下角，自由调整宽高。</p><button class="button primary" data-action="save-settings" data-id="${id}">应用设置</button></div><div class="settings-actions"><button class="button" data-action="move-up" data-id="${id}">向前移动</button><button class="button" data-action="move-down" data-id="${id}">向后移动</button><button class="button" data-action="remove-block" data-id="${id}">从大板移除</button></div><p class="form-note">移除区块不删除资产，重新添加该类别即可找回。</p>`);$('#block-width').oninput=e=>$('#range-value').textContent=e.target.value+'%';}
document.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(!button)return;const {action,id}=button.dataset;
 if(action==='detail'){if($('#modal').open)$('#modal').close();showDetail(id);}
 else if(action==='undo')undo();
 else if(action==='inbox')inboxDialog();
 else if(action==='agenda-all')agendaAll();
 else if(action==='close-modal')$('#modal').close();
 else if(action==='apply-collisions'){const chosen=[...document.querySelectorAll('input[name="collision"]:checked')].map(input=>pendingCollisions[Number(input.value)]).filter(Boolean);$('#modal').close();if(!chosen.length)return;checkpoint();const applied=chosen.filter(item=>applyCollision(state,item)).length;pendingCollisions=[];save();render();toast(`已用同步结果覆盖 ${applied} 条本地记录`,true);}
 else if(action==='candidate-review'){const c=findCandidate(id);if(c)candidateReview(c);}
 else if(action==='candidate-apply'){const c=findCandidate(id);if(!c)return;const target=$('#candidate-target').value,existing=target&&state.assets.find(a=>a.id===target);assetForm(existing?existing.type:c.type,existing?existing.id:null,candidateFill(c,existing),c.key);}
 else if(action==='candidate-dismiss'){if(id==='paste'){inboxDialog(false);return;}checkpoint();const count=resolveCandidate(id,'dismissed');if(!count){history.pop();return;}save();render();inboxDialog(false);toast('已忽略这组资料',true);}
 else if(action==='candidate-reopen'){const c=findCandidate(id);if(!c)return;checkpoint();for(const key of c.ids)delete state.evidenceDecisions?.[key];save();render();inboxDialog(false);toast('已恢复为待确认',true);}
 else if(action==='dismiss-weak'){const weak=candidates().filter(c=>c.pending&&c.weak);if(!weak.length)return;checkpoint();for(const c of weak)resolveCandidate(c.key,'dismissed');save();render();inboxDialog(false);toast(`已忽略 ${weak.length} 组资料`,true);}
 else if(action==='repo-swap'){checkpoint();state.featuredRepositoryIds=swapRepositoryDisplay(state.assets,state.featuredRepositoryIds,id);save();render();}
 else if(action==='manual-import')manualImport();
 else if(action==='github-import')githubDialog();
 else if(action==='cloudflare-import')cloudflareDialog();
 else if(action==='gmail-import')gmailDialog();
 else if(action==='ocr-import'){if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'ocrImport'});}
 else if(action==='setup-cloudflare'||action==='setup-gmail'){
  const url=action==='setup-cloudflare'?'https://dash.cloudflare.com/profile/api-tokens':'https://console.cloud.google.com/apis/credentials';
  if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'openExternal',url});
 }
 else if(action==='choose-asset-type')assetForm(id);
 else if(action==='external'){const a=state.assets.find(a=>a.id===id),url=safeManagementUrl(a?.url);if(!url||new URL(url).hostname==='example.com'){toast('请先在资产资料中填写真实管理链接');return;}if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'openExternal',url});else window.open(url,'_blank','noopener,noreferrer');}
 else if(action==='collapse'){if(query||focusCategory){toast('返回大板后可收起区块');return;}checkpoint();const b=state.blocks.find(b=>b.id===id);b.collapsed=!b.collapsed;save();render();document.querySelector(`[data-action="collapse"][data-id="${id}"]`)?.focus();}
 else if(action==='all'){focusCategory=id;closeDetail();render();window.scrollTo({top:0,behavior:'smooth'});}
 else if(action==='back'){focusCategory=null;render();}
 else if(action==='add-asset')assetForm(id);
 else if(action==='edit-asset')assetForm(state.assets.find(a=>a.id===id).type,id);
 else if(action==='settings')settings(id);
 else if(action==='choose-block'){checkpoint();state.blocks.push({id,width:50,collapsed:false,height:null});save();$('#modal').close();render();toast('区块已加入，已有资产会自动出现',true);}
 else if(action==='save-settings'){checkpoint();const b=state.blocks.find(b=>b.id===id);b.width=Number($('#block-width').value);b.height=Number($('#block-height').value)||null;save();$('#modal').close();render();toast('布局已更新',true);}
 else if(action==='toggle-hidden'){if(showHiddenBlocks.has(id))showHiddenBlocks.delete(id);else showHiddenBlocks.add(id);render();document.querySelector(`[data-action="toggle-hidden"][data-id="${id}"]`)?.focus();}
 else if(action==='hide-asset'){const a=state.assets.find(a=>a.id===id);if(!a||a.hiddenAt)return;checkpoint();a.hiddenAt=new Date().toISOString();save();if(activeAsset===id)closeDetail();render();toast('已隐藏 · 可在区块「已隐藏」中恢复',true);}
 else if(action==='restore-asset'){const a=state.assets.find(a=>a.id===id);if(!a)return;checkpoint();delete a.hiddenAt;save();if(activeAsset===id)showDetail(id);render();toast('已恢复显示',true);}
 else if(action==='delete-asset'){const a=state.assets.find(a=>a.id===id);if(!a)return;confirmDialog('删除这条记录？',`将删除「${a.name}」在 Assetboard 中的记录。\n不会取消订阅，也不会删除 Cloudflare / GitHub 等平台上的资源；之后同步也不会自动加回。`,'删除记录',true).then(ok=>{const a=state.assets.find(a=>a.id===id);if(!ok||!a)return;checkpoint();rememberDeleted(a);state.assets=state.assets.filter(x=>x.id!==id);if(Array.isArray(state.featuredRepositoryIds))state.featuredRepositoryIds=state.featuredRepositoryIds.filter(x=>x!==id);if(state.cardOrder){for(const key of Object.keys(state.cardOrder))state.cardOrder[key]=(state.cardOrder[key]||[]).filter(x=>x!==id);}if(activeAsset===id)closeDetail();save();render();toast('记录已删除 · 同步不会自动加回',true);});}
 else if(action==='remove-block'){checkpoint();state.blocks=state.blocks.filter(b=>b.id!==id);showHiddenBlocks.delete(id);if(focusCategory===id)focusCategory=null;save();$('#modal').close();render();toast('区块已移除，资产仍被保留',true);}
 else if(action==='move-up'||action==='move-down'){const index=state.blocks.findIndex(b=>b.id===id),target=index+(action==='move-up'?-1:1);if(index>=0&&target>=0&&target<state.blocks.length){checkpoint();[state.blocks[target],state.blocks[index]]=[state.blocks[index],state.blocks[target]];save();render();toast(action==='move-up'?'已向前移动':'已向后移动',true);}else toast(action==='move-up'?'已经是第一个区块':'已经是最后一个区块');$('#modal').close();}
});
document.addEventListener('submit',async e=>{if(e.target.id!=='asset-form')return;e.preventDefault();const form=e.target,data=new FormData(form),name=String(data.get('name')).trim(),url=String(data.get('url')).trim(),file=form.elements.icon.files[0];if(!name)return;if(url&&!safeManagementUrl(url)){form.elements.url.setCustomValidity('请输入不含账号密码的 http 或 https 链接');form.elements.url.reportValidity();return;}form.elements.url.setCustomValidity('');if(file&&(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>256*1024)){toast('图标需为 PNG、JPEG 或 WebP，且不超过 256 KB');return;}const submit=form.querySelector('[type="submit"]');submit.disabled=true;try{const iconData=file?await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);}):null;const id=form.dataset.id,chosen=String(data.get('type')||''),type=cats[chosen]?chosen:form.dataset.type,candidateKey=form.dataset.candidate,date=String(data.get('date')),dateKind=dateKinds[data.get('dateKind')]?String(data.get('dateKind')):'expire',cycle=billingCycles[data.get('cycle')]?String(data.get('cycle')):'',fields={name,provider:String(data.get('provider')).trim()||'平台待补充',account:String(data.get('account')).trim(),purpose:String(data.get('purpose')).trim(),reason:String(data.get('reason')||'').trim(),date,dateKind,cycle,cost:String(data.get('cost')).trim()||'未知',notes:String(data.get('notes')).trim(),url:url?safeManagementUrl(url):''},event=date?`${date} ${dateKinds[dateKind].future}`:'日期待补充';checkpoint();let assetId=id;if(id){const a=state.assets.find(a=>a.id===id);const synced=['cloudflare','github'].includes(a.source);Object.assign(a,fields);if(file)a.iconData=iconData;else if(data.has('removeIcon'))delete a.iconData;if(!synced){a.source='manual';a.type=type;a.event=event;}delete a.warn;ensureBlock(state,a.type);}else{assetId='asset-'+crypto.randomUUID();state.assets.push({id:assetId,type,...fields,iconData,source:'manual',event,art:'generic'});ensureBlock(state,type);}const resolved=candidateKey?resolveCandidate(candidateKey,id?'linked':'created',assetId):0;assetFormSnapshot=null;save();render();if(id&&activeAsset===id)showDetail(id);if(candidateKey&&nativeStore&&pendingCount()){inboxDialog(false);toast(resolved?'已记录，继续核对下一组':'已记录',true);}else{$('#modal').close();toast(id?'资料已更新':'资产已添加',true);}}catch{toast('读取图标失败，请重试');}finally{submit.disabled=false;}});
$('#edit').onclick=()=>{editing=!editing;if(editing){focusCategory=null;query='';$('#search').value='';closeDetail();}render();};
$('#add-block').onclick=addBlock;$('#close-modal').onclick=()=>requestCloseModal();$('#close-detail').onclick=closeDetail;$('#modal').addEventListener('cancel',e=>{if(isAssetFormDirty()){e.preventDefault();requestCloseModal();}else assetFormSnapshot=null;});
$('#search').oninput=e=>{query=e.target.value;focusCategory=null;render();};$('#clear-search').onclick=()=>{if(query){$('#search').value='';query='';render();}else addBlock();};
$('#undo').onclick=undo;
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();$('#search').focus();}if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='z'&&!$('#modal').open&&!e.target.closest?.('input,textarea,select,[contenteditable]')){e.preventDefault();undo();}if(e.key==='Escape'&&!$('#modal').open){if(!$('#detail').hidden)closeDetail();else if(focusCategory){focusCategory=null;render();}else if(editing){editing=false;render();}}});
let dragId=null,assetDragElement=null;
function commitAssetOrder(source,target,after=false){
 if(!source||!target||source===target||source.parentElement!==target.parentElement)return false;
 const block=source.closest('.block'),category=block?.dataset.block;
 if(!category||target.closest('.block')!==block)return false;
 const current=[...source.parentElement.children].filter(element=>element.dataset.asset).map(element=>element.dataset.asset);
 const next=moveAsset(current,source.dataset.asset,target.dataset.asset,after);
 if(next===current||next.every((id,index)=>id===current[index]))return false;
 checkpoint();state.cardOrder ||= {};
 const existing=state.cardOrder[category]||[];
 state.cardOrder[category]=[...next,...existing.filter(id=>!next.includes(id))];
 save();render();return true;
}
document.addEventListener('dragstart',e=>{
 if(!editing)return;
 const assetHandle=e.target.closest('.asset-drag-handle');
 if(assetHandle){assetDragElement=assetHandle.closest('[data-asset]');e.dataTransfer.setData('text/plain',assetDragElement.dataset.asset);e.dataTransfer.effectAllowed='move';assetDragElement.classList.add('asset-dragging');return;}
 if(!e.target.closest('.drag-handle'))return;
 dragId=e.target.closest('.block').dataset.block;e.dataTransfer.setData('text/plain',dragId);e.dataTransfer.effectAllowed='move';e.target.closest('.block').classList.add('dragging');
});
document.addEventListener('dragover',e=>{
 if(assetDragElement){const target=e.target.closest('[data-asset]');document.querySelectorAll('.asset-drop-target').forEach(element=>element.classList.remove('asset-drop-target'));if(target&&target!==assetDragElement&&target.parentElement===assetDragElement.parentElement){e.preventDefault();target.classList.add('asset-drop-target');}return;}
 const block=e.target.closest('.block');if(dragId&&block){e.preventDefault();document.querySelectorAll('.drag-target').forEach(b=>b.classList.remove('drag-target'));if(block.dataset.block!==dragId)block.classList.add('drag-target');}
});
document.addEventListener('drop',e=>{
 if(assetDragElement){const target=e.target.closest('[data-asset]');if(target){e.preventDefault();const rect=target.getBoundingClientRect();commitAssetOrder(assetDragElement,target,e.clientX>rect.left+rect.width/2);}assetDragElement=null;document.querySelectorAll('.asset-drop-target,.asset-dragging').forEach(element=>element.classList.remove('asset-drop-target','asset-dragging'));return;}
 const target=e.target.closest('.block');if(dragId&&target){e.preventDefault();const from=state.blocks.findIndex(b=>b.id===dragId),to=state.blocks.findIndex(b=>b.id===target.dataset.block);if(from!==to){checkpoint();const [item]=state.blocks.splice(from,1);state.blocks.splice(to,0,item);save();}dragId=null;render();}
});
document.addEventListener('dragend',()=>{dragId=null;assetDragElement=null;document.querySelectorAll('.dragging,.drag-target,.asset-dragging,.asset-drop-target').forEach(b=>b.classList.remove('dragging','drag-target','asset-dragging','asset-drop-target'));});
document.addEventListener('keydown',e=>{if(!editing||!e.target.matches('.asset-drag-handle')||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;const source=e.target.closest('[data-asset]'),siblings=[...source.parentElement.children].filter(element=>element.dataset.asset),step=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1,target=siblings[siblings.indexOf(source)+step];if(!target)return;e.preventDefault();if(commitAssetOrder(source,target,step>0))document.querySelector(`[data-asset="${CSS.escape(source.dataset.asset)}"] .asset-drag-handle`)?.focus();});
document.addEventListener('pointerdown',e=>{const handle=e.target.closest('.resize-handle');if(!handle||!editing)return;e.preventDefault();cancelAnimationFrame(layoutFrame);document.querySelectorAll('.block').forEach(el=>el.getAnimations().forEach(animation=>animation.cancel()));const board=$('#board'),boardStyle=getComputedStyle(board),gap=parseFloat(boardStyle.columnGap)||0,boardWidth=board.clientWidth-parseFloat(boardStyle.paddingLeft)-parseFloat(boardStyle.paddingRight);const block=handle.closest('.block'),b=state.blocks.find(b=>b.id===block.dataset.block),rect=block.getBoundingClientRect(),startX=e.clientX,startY=e.clientY,initialGrid=block.querySelector('.cards').clientHeight;checkpoint();handle.setPointerCapture(e.pointerId);block.classList.add('resizing');
 let resizeFrame=0,pending=null;
 const flush=()=>{resizeFrame=0;if(!pending)return;const {x,y}=pending;pending=null;b.width=Math.max(25,Math.min(100,(rect.width+x-startX+gap)/(boardWidth+gap)*100));block.style.setProperty('--width',b.width);if(Math.abs(y-startY)>8){b.height=Math.max(236,initialGrid+y-startY);block.classList.add('fixed');block.querySelector('.cards').style.height=b.height+'px';}updateOverflow();};
 const move=event=>{pending={x:event.clientX,y:event.clientY};if(!resizeFrame)resizeFrame=requestAnimationFrame(flush);};
 const end=()=>{cancelAnimationFrame(resizeFrame);flush();handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);block.classList.remove('resizing');save();render();};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
});
let viewportFrame=0;
window.addEventListener('resize',()=>{if(viewportFrame)return;viewportFrame=requestAnimationFrame(()=>{viewportFrame=0;updateOverflow();});});render();
if(nativeStore){document.documentElement.classList.add('native-app');requestEvidence();$('#save-status').textContent='保存在此 Mac';document.querySelectorAll('.form-note').forEach(el=>{el.textContent=el.textContent.replaceAll('当前浏览器','此 Mac').replaceAll('此浏览器','此 Mac');});if(!nativeStore.data||migratedLegacyData)save();}
else if(migratedLegacyData)save();
