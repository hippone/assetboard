const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
 domain:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
 server:'<rect x="4" y="3" width="16" height="7" rx="2"/><rect x="4" y="14" width="16" height="7" rx="2"/><path d="M7 6h1m-1 11h1m7-11h2m-2 11h2"/>',
 subscription:'<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M3 10h18m-14 5h5"/>',
 database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
 license:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>'
};
const cats = {domain:{name:'域名',hint:'网站的地址，也是创作的起点',symbol:'◎'},server:{name:'服务器',hint:'承载项目的每一台机器',symbol:'▤'},subscription:{name:'订阅与工具',hint:'每天陪你工作的好工具',symbol:'✳'},database:{name:'数据库',hint:'让每一份数据都有归处',symbol:'▱'},license:{name:'软件授权',hint:'买下的工具，不再遗忘',symbol:'◇'}};
const seed = {
 blocks:[{id:'domain',width:60,collapsed:false,height:null},{id:'server',width:40,collapsed:false,height:null},{id:'subscription',width:40,collapsed:false,height:null},{id:'database',width:60,collapsed:false,height:null}],
 assets:[
 {id:'a1',type:'domain',name:'halfnote.studio',provider:'Cloudflare',account:'个人账号',purpose:'写作工具',event:'12 天后到期',date:'2026-10-06',cost:'¥ 89 / 年',warn:true,art:'note',url:'https://example.com',notes:'主站域名，记录每一个从想法到作品的瞬间。'},
 {id:'a2',type:'domain',name:'littlethings.design',provider:'Porkbun',account:'个人账号',purpose:'设计作品集',event:'2027.03.18 到期',date:'2027-03-18',cost:'$ 12 / 年',art:'orbit',url:'https://example.com',notes:'个人作品与小实验的集合。'},
 {id:'a3',type:'domain',name:'weekend.build',provider:'Cloudflare',account:'个人账号',purpose:'周末实验',event:'2027.06.02 到期',date:'2027-06-02',cost:'$ 15 / 年',art:'build',url:'https://example.com'},
 {id:'a4',type:'server',name:'Tokyo · 01',provider:'Hetzner',account:'实验团队',purpose:'API 与后台服务',event:'¥ 68 / 月',date:'2026-10-15',cost:'¥ 68 / 月',art:'rack',url:'https://example.com',notes:'演示服务器，名称和区域仅用于原型。'},
 {id:'a5',type:'server',name:'Singapore · 02',provider:'DigitalOcean',account:'个人账号',purpose:'测试环境',event:'$ 6 / 月',date:'2026-10-20',cost:'$ 6 / 月',art:'rack2',url:'https://example.com'},
 {id:'a6',type:'subscription',name:'Figma',provider:'Professional',account:'设计账号',purpose:'设计与协作',event:'$ 15 / 月',date:'2026-10-12',cost:'$ 15 / 月',art:'figma',url:'https://example.com'},
 {id:'a7',type:'subscription',name:'Claude',provider:'Pro',account:'个人账号',purpose:'思考与创作',event:'3 天后续费',date:'2026-09-27',cost:'$ 20 / 月',warn:true,art:'claude',url:'https://example.com'},
 {id:'a8',type:'database',name:'halfnote-db',provider:'Supabase',account:'个人空间',purpose:'写作工具 · 正式环境',event:'免费计划',date:'',cost:'免费',art:'db',url:'https://example.com'},
 {id:'a9',type:'database',name:'playground',provider:'Neon',account:'实验团队',purpose:'周末实验 · 开发环境',event:'按用量计费',date:'',cost:'按用量',art:'db2',url:'https://example.com'}
 ]
};
const key='assetboard-prototype-v1';
const nativeStore=window.__ASSETBOARD_NATIVE__;
let state=structuredClone(seed),editing=false,query='',focusCategory=null,history=[],activeAsset=null,lastFocus=null,toastTimer;
try{const saved=nativeStore?nativeStore.data:JSON.parse(localStorage.getItem(key));if(saved&&Array.isArray(saved.blocks)&&Array.isArray(saved.assets)&&saved.blocks.every(b=>cats[b.id]))state=saved;}catch{}
let saveSequence=0;
window.assetboardSaved=(sequence,success)=>{if(sequence!==saveSequence)return;$('#save-status').textContent=success?'已保存在此 Mac':'尚未保存';if(!success)toast('本机文件保存失败，请保留窗口后重试');};
function save(){try{if(nativeStore){$('#save-status').textContent='正在保存到此 Mac…';window.webkit.messageHandlers.assetboard.postMessage({action:'save',sequence:++saveSequence,data:state});}else{localStorage.setItem(key,JSON.stringify(state));$('#save-status').textContent='已保存在此浏览器';}}catch{$('#save-status').textContent='尚未保存';toast('未能保存，请保留此窗口');}}
function checkpoint(){history.push(JSON.stringify(state));if(history.length>25)history.shift();}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
function icon(type){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${icons[type]}</svg>`;}
function art(asset){
 if(typeof asset.iconData==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(asset.iconData)&&asset.iconData.length<400000)return `<div class="art custom-art" aria-hidden="true"><img src="${asset.iconData}" alt="" draggable="false"></div>`;
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
function matches(a){return !query||[a.name,a.provider,a.purpose,a.account,cats[a.type]?.name].join(' ').toLowerCase().includes(query.toLowerCase());}
function safeManagementUrl(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&url.hostname&&!url.username&&!url.password?url.href:null;}catch{return null;}}
function card(a){const link=safeManagementUrl(a.url);return `<article class="asset-card" data-asset="${esc(a.id)}"><button class="card-open" data-action="detail" data-id="${esc(a.id)}" aria-label="查看 ${esc(a.name)} 详情">${art(a)}<div class="card-copy"><span class="card-name">${esc(a.name)}</span><span class="card-provider">${esc(a.provider)} · ${esc(a.account)}</span><span class="card-purpose">${esc(a.purpose||'用途待补充')}</span></div></button><div class="card-foot"><span class="card-event ${a.warn||a.syncMissing?'warn':''}"><i class="dot"></i>${esc(a.syncMissing?'本次未返回':a.event||'日期待补充')}</span>${link&&new URL(link).hostname!=='example.com'?`<button class="open-link" data-action="external" data-id="${esc(a.id)}" aria-label="打开 ${esc(a.name)} 管理链接">↗</button>`:''}</div></article>`;}
function renderBlock(b){
 const assets=state.assets.filter(a=>a.type===b.id&&matches(a));
 const collapsed=b.collapsed&&!query&&!focusCategory;
 const fixed=b.height&&!collapsed&&!focusCategory&&!query;
 const warning=assets.some(a=>a.warn);
 return `<section class="block ${b.id} ${collapsed?'collapsed':''} ${fixed?'fixed':''}" data-block="${b.id}" style="--width:${b.width};--compact-columns:${Math.min(2,Math.max(1,assets.length))}">
 <header class="block-head"><button class="drag-handle icon-button" draggable="true" aria-label="拖动${cats[b.id].name}区块">⠿</button>
 <button class="block-title" data-action="collapse" data-id="${b.id}" aria-expanded="${!collapsed}" aria-controls="cards-${b.id}" title="${collapsed?'展开资产卡片':'切换为图标与名称'}"><span>${cats[b.id].name}</span><span class="chevron">${collapsed?'⌄':'⌃'}</span></button>
 ${warning?'<span class="block-summary">即将到期</span>':''}
 <div class="block-actions"><button class="text-button" data-action="all" data-id="${b.id}" aria-label="查看全部${cats[b.id].name}" hidden>查看全部</button><button class="icon-button" data-action="add-asset" data-id="${b.id}" aria-label="添加${cats[b.id].name}资产">＋</button><button class="icon-button" data-action="settings" data-id="${b.id}" aria-label="${cats[b.id].name}区块设置">⋯</button></div></header>
 <div class="cards" id="cards-${b.id}" ${fixed?`style="height:${b.height}px"`:''}>${assets.map(card).join('')||'<div class="block-empty">添加你的第一项资产</div>'}</div>
 ${!collapsed?`<div class="resize-handle" role="separator" aria-label="调整${cats[b.id].name}区块大小"></div>`:''}</section>`;
}
let layoutFrame=0;
function render(){
 if(typeof applyBoardTheme==='function'&&!themePreview)applyBoardTheme(state.theme);
 cancelAnimationFrame(layoutFrame);
 const previous=new Map([...document.querySelectorAll('.block')].map(el=>[el.dataset.block,el.getBoundingClientRect()]));
 document.body.classList.toggle('editing',editing);$('#editbar').hidden=!editing;$('#edit').textContent=editing?'完成':'调整布局';$('#edit').setAttribute('aria-pressed',String(editing));$('#undo').disabled=!history.length;
 if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'toolbarState',editing,query});
 $('#board').classList.toggle('full-view',!!focusCategory);$('#focusbar').hidden=!focusCategory;$('#focusbar').innerHTML=focusCategory?`<button class="button" data-action="back">← 返回大板</button><strong>${esc(cats[focusCategory].name)} · 全部资产</strong>`:'';
 const blocks=query?Object.keys(cats).filter(id=>state.assets.some(a=>a.type===id&&matches(a))).map(id=>state.blocks.find(b=>b.id===id)||{id,width:50}):state.blocks.filter(b=>!focusCategory||b.id===focusCategory);
 $('#board').innerHTML=blocks.map(renderBlock).join('');
 $('#empty').hidden=blocks.length>0;layoutFrame=requestAnimationFrame(()=>{
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
function updateOverflow(){
 const grids=[...document.querySelectorAll('.block.fixed')].map(block=>{const grid=block.querySelector('.cards'),cards=[...grid.querySelectorAll('.asset-card')],style=getComputedStyle(grid),bottom=parseFloat(style.paddingBottom)||0;return {block,grid,cards,bottom,minHeight:(cards[0]?.offsetHeight||100)+(parseFloat(style.paddingTop)||0)+bottom};});
 for(const {grid,minHeight} of grids){const value=minHeight+'px';if(grid.style.minHeight!==value)grid.style.minHeight=value;}
 const visibility=grids.map(item=>{const limit=item.grid.offsetTop+item.grid.clientHeight-item.bottom+1;return {...item,hidden:item.cards.map(card=>card.offsetTop+card.offsetHeight>limit)};});
 for(const {block,cards,hidden} of visibility){cards.forEach((card,i)=>{const value=hidden[i]?'hidden':'';if(card.style.visibility!==value)card.style.visibility=value;if(card.inert!==hidden[i])card.inert=hidden[i];});const all=block.querySelector('[data-action="all"]');all.hidden=!hidden.some(Boolean);all.title='还有资产未显示，查看全部';}
}
function showDetail(id){const a=state.assets.find(a=>a.id===id);if(!a)return;lastFocus=document.activeElement;activeAsset=id;const link=safeManagementUrl(a.url),realLink=link&&new URL(link).hostname!=='example.com',lastSync=a.syncedAt&&!isNaN(Date.parse(a.syncedAt))?new Date(a.syncedAt).toLocaleString('zh-CN'):'';$('#detail-content').innerHTML=`${art(a)}<span class="eyebrow">${esc(cats[a.type].name)} / ASSET DETAILS</span><h2>${esc(a.name)}</h2><p class="detail-sub">${esc(a.provider)} · ${esc(a.account)}</p><span class="detail-badge">${esc(a.purpose||'用途待补充')}</span><div class="detail-actions">${realLink?`<button class="button primary" data-action="external" data-id="${esc(id)}">打开管理 ↗</button>`:''}<button class="button" data-action="edit-asset" data-id="${esc(id)}">编辑资料</button></div><div class="facts">${[['关联用途',a.purpose||'待补充'],['费用',a.cost||'未知'],['下一日期',a.date||'待补充'],['账号',a.account],['记录状态',a.syncMissing?'Cloudflare 本次未返回':a.source==='cloudflare'?`Cloudflare Zone · ${a.syncStatus||'状态未知'}`:a.source==='manual'?'手动录入':'演示资产'],...(lastSync?[['最近同步',lastSync]]:[])].map(([k,v])=>`<div class="fact"><span>${k}</span><span>${esc(v)}</span></div>`).join('')}</div><details><summary>备注与来源</summary><p>${esc(a.notes||'暂无补充备注。')}</p>${a.source==='cloudflare'?'<p>同步自 Cloudflare Zone 列表；不能据此判断注册到期或账单。编辑名称或账号后，下次同步会使用平台值。</p>':a.source==='manual'?'<p>此记录由你手动录入。</p>':'<p>此记录为原型演示数据，金额和日期不代表实际账户。</p>'}</details>`;$('#detail').hidden=false;$('#close-detail').focus();}
function closeDetail(){ $('#detail').hidden=true;activeAsset=null;if(lastFocus?.isConnected)lastFocus.focus();}
function modal(title,html){$('#modal-title').textContent=title;$('#modal-content').innerHTML=html;if(nativeStore)$('#modal-content').querySelectorAll('.form-note').forEach(el=>{el.textContent=el.textContent.replaceAll('当前浏览器','此 Mac').replaceAll('此浏览器','此 Mac');});if(!$('#modal').open)$('#modal').showModal();}
function addBlock(){modal('给大板添一个区块',Object.entries(cats).map(([id,c])=>`<button class="category-choice" data-action="choose-block" data-id="${id}" ${state.blocks.some(b=>b.id===id)?'disabled':''}><span>${c.symbol}</span><span>${c.name}<small>${c.hint}</small></span><span class="plus">${state.blocks.some(b=>b.id===id)?'✓':'＋'}</span></button>`).join('')+'<p class="form-note">区块按类别展示已有资产。添加后可以自由移动、调整大小。</p>');}
function assetForm(type,id){const a=id?state.assets.find(a=>a.id===id):null,link=safeManagementUrl(a?.url);modal(a?'编辑资产资料':`添加${cats[type].name}资产`,`<form id="asset-form" class="form" data-type="${type}" data-id="${id||''}"><label>资产名称<input name="name" required maxlength="100" value="${esc(a?.name||'')}" placeholder="例如 my-project.dev"></label><label>平台<input name="provider" maxlength="80" value="${esc(a?.provider||'')}" placeholder="例如 Cloudflare"></label><label>账号<input name="account" maxlength="100" value="${esc(a?.account||'')}" placeholder="用于区分同平台的账号"></label><label>用途<input name="purpose" maxlength="100" value="${esc(a?.purpose||'')}" placeholder="它用来做什么？"></label><label>管理链接<input name="url" type="url" maxlength="2000" value="${esc(link&&new URL(link).hostname!=='example.com'?link:'')}" placeholder="https://..." pattern="https?://.*"></label><label>自定义图标<input name="icon" type="file" accept="image/png,image/jpeg,image/webp"></label>${a?.iconData?'<label class="check-label"><input name="removeIcon" type="checkbox">移除当前自定义图标</label>':''}<span class="form-note">PNG、JPEG 或 WebP，最大 256 KB。图标随本机资产备份保存。</span><label>下一日期<input type="date" name="date" value="${esc(a?.date||'')}"></label><label>费用说明<input name="cost" maxlength="80" value="${esc(a?.cost==='未知'?'':a?.cost||'')}" placeholder="例如 ¥ 89 / 年"></label><label>备注<textarea name="notes" rows="3" maxlength="2000">${esc(a?.notes||'')}</textarea></label><button class="button primary" type="submit">${a?'保存修改':'添加资产'}</button><span class="form-note">资产资料仅保存在此浏览器；管理链接会在系统浏览器中打开。</span></form>`);}
function cloudflareDialog(){
 if(!nativeStore){toast('Cloudflare 同步仅在 macOS App 中可用');return;}
 const connected=nativeStore.cloudflareConnected;
 modal('Cloudflare · 只读同步',`<div class="form"><p class="form-note">使用 Cloudflare API Token，权限选择 Zone → Zone → Read，并限定需要同步的 Zone。这里只读取令牌授权范围内的 DNS Zone 名称、账号与状态；不会读取注册到期日或账单。令牌经读取权限验证后保存在 macOS 钥匙串，不写入资产文件。</p><label>${connected?'更换令牌（留空则使用已保存令牌）':'只读 API 令牌'}<input id="cloudflare-token" type="password" autocomplete="off" spellcheck="false" placeholder="${connected?'留空使用现有令牌':'粘贴令牌'}"></label><p id="cloudflare-status" class="form-note">${connected?'已连接 · 可重新同步或更换令牌':'尚未连接'}</p><button id="cloudflare-sync" class="button primary">${connected?'重新同步':'验证权限并同步'}</button>${connected?'<button id="cloudflare-disconnect" class="button">断开本机连接</button>':''}<p class="form-note">断开会删除本机钥匙串中的令牌；若需废止令牌，还需前往 Cloudflare 后台撤销。已同步资产保留在大板上。</p></div>`);
 $('#cloudflare-sync').onclick=()=>{const token=$('#cloudflare-token').value;$('#cloudflare-token').value='';$('#cloudflare-sync').disabled=true;$('#cloudflare-status').textContent='正在验证权限并读取全部分页…';window.webkit.messageHandlers.assetboard.postMessage({action:'cloudflareSync',token});};
 if(connected)$('#cloudflare-disconnect').onclick=()=>window.webkit.messageHandlers.assetboard.postMessage({action:'cloudflareDisconnect'});
}
window.assetboardCloudflareResult=result=>{
 if(!result.ok){const status=$('#cloudflare-status');if(status)status.textContent=result.error||'同步失败';const button=$('#cloudflare-sync');if(button)button.disabled=false;return;}
 if(result.disconnected){nativeStore.cloudflareConnected=false;cloudflareDialog();toast('已删除本机保存的 Cloudflare 令牌');return;}
 const zones=result.zones||[],seen=new Set(),syncedAt=new Date().toISOString();let added=0;
 checkpoint();
 for(const zone of zones){const id='cloudflare-zone-'+zone.id;seen.add(id);const existing=state.assets.find(a=>a.id===id);if(existing){existing.name=zone.name;existing.account=zone.account;existing.syncStatus=zone.status;existing.syncMissing=false;existing.syncedAt=syncedAt;}else{state.assets.push({id,type:'domain',name:zone.name,provider:'Cloudflare',account:zone.account,purpose:'DNS Zone',event:'注册到期日未知',date:'',cost:'未知',notes:'Cloudflare Zone 列表同步；不代表域名注册记录。',url:'https://dash.cloudflare.com/',art:'generic',source:'cloudflare',externalId:zone.id,syncStatus:zone.status,syncedAt});added++;}}
 for(const asset of state.assets)if(asset.source==='cloudflare'&&!seen.has(asset.id))asset.syncMissing=true;
 if(!state.blocks.some(b=>b.id==='domain'))state.blocks.push({id:'domain',width:50,collapsed:false,height:null});
 nativeStore.cloudflareConnected=true;save();render();$('#modal').close();toast(`Cloudflare 权限验证成功：读取 ${zones.length} 个 Zone，新增 ${added} 项`);
};
function settings(id){const b=state.blocks.find(b=>b.id===id);if(!b)return;modal(`${cats[id].name} · 区块设置`,`<div class="form"><label>区块宽度 · <span id="range-value">${Math.round(b.width)}%</span><input id="block-width" type="range" min="25" max="100" value="${b.width}" aria-label="区块宽度"></label><label>展示高度<select id="block-height"><option value="">随内容自适应</option><option value="240" ${b.height===240?'selected':''}>约一行卡片</option><option value="480" ${b.height===480?'selected':''}>约两行卡片</option></select></label><p class="form-note">这里是键盘与触屏的快捷设置。布局编辑时可直接拖动区块右下角，自由调整宽高。</p><button class="button primary" data-action="save-settings" data-id="${id}">应用设置</button></div><div class="settings-actions"><button class="button" data-action="move-up" data-id="${id}">向前移动</button><button class="button" data-action="remove-block" data-id="${id}">从大板移除</button></div><p class="form-note">移除区块不删除资产，重新添加该类别即可找回。</p>`);$('#block-width').oninput=e=>$('#range-value').textContent=e.target.value+'%';}
document.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(!button)return;const {action,id}=button.dataset;
 if(action==='detail')showDetail(id);
 else if(action==='external'){const a=state.assets.find(a=>a.id===id),url=safeManagementUrl(a?.url);if(!url||new URL(url).hostname==='example.com'){toast('请先在资产资料中填写真实管理链接');return;}if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'openExternal',url});else window.open(url,'_blank','noopener,noreferrer');}
 else if(action==='collapse'){if(query||focusCategory){toast('返回大板后可收起区块');return;}checkpoint();const b=state.blocks.find(b=>b.id===id);b.collapsed=!b.collapsed;save();render();document.querySelector(`[data-action="collapse"][data-id="${id}"]`)?.focus();}
 else if(action==='all'){focusCategory=id;closeDetail();render();window.scrollTo({top:0,behavior:'smooth'});}
 else if(action==='back'){focusCategory=null;render();}
 else if(action==='add-asset')assetForm(id);
 else if(action==='edit-asset')assetForm(state.assets.find(a=>a.id===id).type,id);
 else if(action==='settings')settings(id);
 else if(action==='choose-block'){checkpoint();state.blocks.push({id,width:50,collapsed:false,height:null});save();$('#modal').close();render();toast('区块已加入，已有资产会自动出现');}
 else if(action==='save-settings'){checkpoint();const b=state.blocks.find(b=>b.id===id);b.width=Number($('#block-width').value);b.height=Number($('#block-height').value)||null;save();$('#modal').close();render();toast('布局已更新');}
 else if(action==='remove-block'){checkpoint();state.blocks=state.blocks.filter(b=>b.id!==id);if(focusCategory===id)focusCategory=null;save();$('#modal').close();render();toast('区块已移除，资产仍被保留 · 可撤销');}
 else if(action==='move-up'){const index=state.blocks.findIndex(b=>b.id===id);if(index>0){checkpoint();[state.blocks[index-1],state.blocks[index]]=[state.blocks[index],state.blocks[index-1]];save();render();toast('已向前移动');}else toast('已经是第一个区块');$('#modal').close();}
});
document.addEventListener('submit',async e=>{if(e.target.id!=='asset-form')return;e.preventDefault();const form=e.target,data=new FormData(form),name=String(data.get('name')).trim(),url=String(data.get('url')).trim(),file=form.elements.icon.files[0];if(!name)return;if(url&&!safeManagementUrl(url)){form.elements.url.setCustomValidity('请输入不含账号密码的 http 或 https 链接');form.elements.url.reportValidity();return;}form.elements.url.setCustomValidity('');if(file&&(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>256*1024)){toast('图标需为 PNG、JPEG 或 WebP，且不超过 256 KB');return;}const submit=form.querySelector('[type="submit"]');submit.disabled=true;try{const iconData=file?await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);}):null;const id=form.dataset.id,type=form.dataset.type,fields={name,provider:String(data.get('provider')).trim()||'平台待补充',account:String(data.get('account')).trim(),purpose:String(data.get('purpose')).trim(),date:String(data.get('date')),cost:String(data.get('cost')).trim()||'未知',notes:String(data.get('notes')).trim(),url:url?safeManagementUrl(url):''};checkpoint();if(id){const a=state.assets.find(a=>a.id===id);Object.assign(a,fields);if(file)a.iconData=iconData;else if(data.has('removeIcon'))delete a.iconData;if(a.source!=='cloudflare')a.source='manual';a.event=fields.date?fields.date+' 到期':'日期待补充';a.warn=false;}else state.assets.push({id:'asset-'+crypto.randomUUID(),type,...fields,iconData,source:'manual',event:fields.date?fields.date+' 到期':'日期待补充',art:'generic'});save();$('#modal').close();render();if(id&&activeAsset===id)showDetail(id);toast(id?'资料已更新':'资产已添加');}catch{toast('读取图标失败，请重试');}finally{submit.disabled=false;}});
$('#edit').onclick=()=>{editing=!editing;if(editing){focusCategory=null;query='';$('#search').value='';closeDetail();}render();};
$('#add-block').onclick=addBlock;$('#close-modal').onclick=()=>$('#modal').close();$('#close-detail').onclick=closeDetail;
$('#search').oninput=e=>{query=e.target.value;focusCategory=null;render();};$('#clear-search').onclick=()=>{$('#search').value='';query='';render();};
$('#undo').onclick=()=>{if(!history.length)return;state=JSON.parse(history.pop());save();render();toast('已撤销上一次修改');};
document.addEventListener('click',e=>{if(e.target.id==='confirm-reset'){checkpoint();state=structuredClone(seed);query='';focusCategory=null;$('#search').value='';save();$('#modal').close();closeDetail();render();toast('已恢复初始演示');}});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();$('#search').focus();}if(e.key==='Escape'&&!$('#modal').open){if(!$('#detail').hidden)closeDetail();else if(focusCategory){focusCategory=null;render();}else if(editing){editing=false;render();}}});
let dragId=null;
document.addEventListener('dragstart',e=>{if(!editing||!e.target.closest('.drag-handle'))return;dragId=e.target.closest('.block').dataset.block;e.dataTransfer.setData('text/plain',dragId);e.dataTransfer.effectAllowed='move';e.target.closest('.block').classList.add('dragging');});
document.addEventListener('dragover',e=>{const block=e.target.closest('.block');if(dragId&&block){e.preventDefault();document.querySelectorAll('.drag-target').forEach(b=>b.classList.remove('drag-target'));if(block.dataset.block!==dragId)block.classList.add('drag-target');}});
document.addEventListener('drop',e=>{const target=e.target.closest('.block');if(dragId&&target){e.preventDefault();const from=state.blocks.findIndex(b=>b.id===dragId),to=state.blocks.findIndex(b=>b.id===target.dataset.block);if(from!==to){checkpoint();const [item]=state.blocks.splice(from,1);state.blocks.splice(to,0,item);save();}dragId=null;render();}});
document.addEventListener('dragend',()=>{dragId=null;document.querySelectorAll('.dragging,.drag-target').forEach(b=>b.classList.remove('dragging','drag-target'));});
document.addEventListener('pointerdown',e=>{const handle=e.target.closest('.resize-handle');if(!handle||!editing)return;e.preventDefault();cancelAnimationFrame(layoutFrame);document.querySelectorAll('.block').forEach(el=>el.getAnimations().forEach(animation=>animation.cancel()));const board=$('#board'),boardStyle=getComputedStyle(board),gap=parseFloat(boardStyle.columnGap)||0,boardWidth=board.clientWidth-parseFloat(boardStyle.paddingLeft)-parseFloat(boardStyle.paddingRight);const block=handle.closest('.block'),b=state.blocks.find(b=>b.id===block.dataset.block),rect=block.getBoundingClientRect(),startX=e.clientX,startY=e.clientY,initialGrid=block.querySelector('.cards').clientHeight;checkpoint();handle.setPointerCapture(e.pointerId);block.classList.add('resizing');
 let resizeFrame=0,pending=null;
 const flush=()=>{resizeFrame=0;if(!pending)return;const {x,y}=pending;pending=null;b.width=Math.max(25,Math.min(100,(rect.width+x-startX+gap)/(boardWidth+gap)*100));block.style.setProperty('--width',b.width);if(Math.abs(y-startY)>8){b.height=Math.max(236,initialGrid+y-startY);block.classList.add('fixed');block.querySelector('.cards').style.height=b.height+'px';}updateOverflow();};
 const move=event=>{pending={x:event.clientX,y:event.clientY};if(!resizeFrame)resizeFrame=requestAnimationFrame(flush);};
 const end=()=>{cancelAnimationFrame(resizeFrame);flush();handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);block.classList.remove('resizing');save();render();};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
});
let viewportFrame=0;
window.addEventListener('resize',()=>{if(viewportFrame)return;viewportFrame=requestAnimationFrame(()=>{viewportFrame=0;updateOverflow();});});render();
if(nativeStore){document.documentElement.classList.add('native-app');$('#save-status').textContent='保存在此 Mac';document.querySelectorAll('.form-note').forEach(el=>{el.textContent=el.textContent.replaceAll('当前浏览器','此 Mac').replaceAll('此浏览器','此 Mac');});if(!nativeStore.data)save();}
