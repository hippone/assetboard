const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
 domain:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5s1.2-6.1 3.8-8.5Z"/>',
 server:'<rect x="4" y="4" width="16" height="6.5" rx="2"/><rect x="4" y="13.5" width="16" height="6.5" rx="2"/><path d="M7.5 7.25h.01M7.5 16.75h.01M11 7.25h5.5M11 16.75h5.5"/>',
 subscription:'<path d="M19.5 9.5A8 8 0 0 0 5.2 7.8M4.5 14.5a8 8 0 0 0 14.3 1.7"/><path d="M5 4v4h4M19 20v-4h-4"/>',
 database:'<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
 license:'<circle cx="8.5" cy="12" r="4"/><path d="M12.5 12H20v3M16.5 12v2.5"/>',
 repository:'<path d="M6.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v12.5H7a2.5 2.5 0 0 0 0 5h12v-5"/><path d="M4.5 20V6a2.5 2.5 0 0 1 2-2.45M9 8h6"/>',
 deployment:'<path d="M7.5 18.5h-.5a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 9.5a4.5 4.5 0 0 1-.5 9h-1"/><path d="M12 20.5V12.5M9 15.5l3-3 3 3"/>',
 storage:'<rect x="3.5" y="4.5" width="17" height="5" rx="1.5"/><path d="M5 9.5v8.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V9.5M10 13h4"/>',
 bankcard:'<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M6.5 14.5h4"/>',
 phone:'<rect x="6.5" y="3" width="11" height="18" rx="2.5"/><path d="M10.5 17.5h3"/>',
 appleid:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="10" r="2.8"/><path d="M6.6 18.4c1.2-1.9 3.1-2.9 5.4-2.9s4.2 1 5.4 2.9"/>',
 google:'<path d="M19.5 12.2c0-.6-.05-1.2-.15-1.7H12v3.3h4.2a3.7 3.7 0 0 1-1.6 2.4"/><path d="M19.2 9A8 8 0 1 0 17.6 17.7"/>',
 ai:'<path d="M11 4c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5C8.4 9.9 10.4 7.9 11 4Z"/><path d="M18 15.5v4M16 17.5h4"/>'
};
const cats = {bankcard:{name:'银行卡',hint:'各国银行卡，只记尾号、卡组织与有效期'},phone:{name:'手机号',hint:'各国号码、运营商与保号日期'},server:{name:'服务器'},appleid:{name:'Apple ID',hint:'各区 Apple ID 与付款卡、验证号码'},google:{name:'Google 账号',hint:'各区 Google 账号与验证号码'},ai:{name:'AI 订阅'},domain:{name:'域名'},subscription:{name:'订阅与工具'},database:{name:'数据库'},license:{name:'软件授权'},repository:{name:'代码仓库'},deployment:{name:'部署服务'},storage:{name:'对象存储'}};
// Priority asset types: form labels, extra fields and date defaults. Other categories use the generic form.
const assetProfiles={
 bankcard:{name:'例如 汇丰 One 借记卡',provider:['发卡行','例如 汇丰香港、Wise'],account:['账户备注','用于区分同一银行的多张卡'],extra:['region','last4','network'],note:'只记录后 4 位。不要填写完整卡号、CVV、密码或验证码。',links:'关联用这张卡付款的 Apple ID、Google 账号或 AI 订阅。'},
 phone:{name:'例如 英国 giffgaff',provider:['运营商','例如 giffgaff、CMLink'],account:['实名或用途','例如 接收 Apple ID 验证码'],extra:['region','phone'],date:'下次保号日期',dateKind:'keep',cycle:'halfyearly',links:'关联用这个号码接收验证码的账号。'},
 appleid:{name:'例如 美区主号',fixedProvider:'Apple',account:['登录邮箱','Apple ID 邮箱'],extra:['region'],note:'不要在这里保存密码或验证码。',links:'关联付款的银行卡和接收验证码的手机号。'},
 google:{name:'例如 美区 Google 账号',fixedProvider:'Google',account:['登录邮箱','Gmail 地址'],extra:['region'],note:'不要在这里保存密码或验证码。',links:'关联接收验证码的手机号和付款的银行卡。'},
 ai:{name:'例如 ChatGPT Plus',provider:['服务','例如 ChatGPT、Claude、Midjourney'],account:['登录账号','用哪个账号订阅'],date:'下次扣款日期',dateKind:'renew',cycle:'monthly',links:'关联订阅用的账号和付款的银行卡。'}
};
const cardNetworks=['Visa','Mastercard','银联','American Express','JCB','Discover','其他'];
const linkOrder={bankcard:['appleid','google','ai','subscription'],phone:['appleid','google','bankcard'],appleid:['bankcard','phone','google','ai'],google:['phone','bankcard','appleid','ai'],ai:['appleid','google','bankcard']};
const seed={blocks:[],assets:[]};
const key='assetboard-prototype-v1';
const nativeStore=window.__ASSETBOARD_NATIVE__;
// Movement and size animations stay at or under 0.2s (DESIGN-PRINCIPLES.md); CSS transitions use the same value.
const MOTION_MS=200;
// Demo mode (`--demo` in the Mac app, `?demo` in the browser) shows the fictional board from demo-data.js and never saves.
const demoMode=!!(nativeStore?.demo||(!nativeStore&&new URLSearchParams(location.search).has('demo')))&&typeof window.assetboardDemoBoard==='function';
window.assetboardDemoBlocked=()=>{if($('#modal')?.open)$('#modal').close();toast('演示模式下不可用');};
window.assetboardConnectionState=connections=>{
 if(!nativeStore)return;
 Object.assign(nativeStore,connections);
 const cloudflareStatus=$('#cloudflare-status');
 if(cloudflareStatus)cloudflareStatus.textContent=nativeStore.cloudflareConnected?'已连接':nativeStore.keychainUnavailable?'钥匙串没有响应，可重新输入令牌':'未连接';
 const githubStatus=$('#github-status');
 if(githubStatus)githubStatus.textContent=nativeStore.githubConnected?'已连接':nativeStore.keychainUnavailable?'钥匙串没有响应，可用 gh 同步':'未连接';
};
let state=structuredClone(seed),query='',view='all',layoutMode='list',history=[],future=[],activeAsset=null,lastFocus=null,toastTimer,assetFormSnapshot=null;
let migratedLegacyData=false;
try{const saved=demoMode?window.assetboardDemoBoard():nativeStore?nativeStore.data:JSON.parse(localStorage.getItem(key));if(saved&&Array.isArray(saved.blocks)&&Array.isArray(saved.assets)&&saved.blocks.every(b=>cats[b.id])){const migration=removeUntouchedDemo(saved);state=migration.board;migratedLegacyData=!!(migration.removed||migration.removedBlocks);}}catch{} if(!Array.isArray(state.deletedExternalIds))state.deletedExternalIds=[];
let saveSequence=0;
window.assetboardSaved=(sequence,success)=>{if(sequence!==saveSequence)return;if(!success)toast('保存失败，请保留此窗口');};
function save(){if(demoMode)return;try{if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'save',sequence:++saveSequence,data:state});else localStorage.setItem(key,JSON.stringify(state));}catch{toast('保存失败，请保留此窗口');}}
function checkpoint(){history.push(JSON.stringify(state));if(history.length>25)history.shift();future=[];}
function toast(message,undoable=false,redoable=false){clearTimeout(toastTimer);const offer=(undoable&&history.length)||(redoable&&future.length);$('#toast').innerHTML=`<span>${esc(message)}</span>${undoable&&history.length?'<button class="toast-undo" data-action="undo">撤销</button>':redoable&&future.length?'<button class="toast-undo" data-action="redo">重做</button>':''}`;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),offer?6000:3000);}
function restoreSnapshot(json){state=JSON.parse(json);save();if(activeAsset&&!state.assets.some(a=>a.id===activeAsset))closeDetail();else if(activeAsset)showDetail(activeAsset,{focus:false});render();}
function undo(){if(!history.length){toast('没有可撤销的');return;}future.push(JSON.stringify(state));if(future.length>25)future.shift();restoreSnapshot(history.pop());toast('已撤销',false,true);}
function redo(){if(!future.length){toast('没有可重做的');return;}history.push(JSON.stringify(state));if(history.length>25)history.shift();restoreSnapshot(future.pop());toast('已重做',true);}
function confirmDialog(title,message,confirmLabel,danger=false){return new Promise(resolve=>{modal(title,`<p class="form-note confirm-message">${esc(message).replaceAll('\n','<br>')}</p><div class="confirm-actions"><button class="button ${danger?'danger':'primary'}" id="confirm-yes">${esc(confirmLabel)}</button><button class="button" id="confirm-no">取消</button></div>`);const dialog=$('#modal');let settled=false;const finish=value=>{if(settled)return;settled=true;dialog.removeEventListener('close',cancel);resolve(value);},cancel=()=>finish(false);dialog.addEventListener('close',cancel);$('#confirm-yes').onclick=()=>{finish(true);dialog.close();};$('#confirm-no').onclick=()=>dialog.close();$('#confirm-no').focus();});}

function isHidden(a){return !!(a&&a.hiddenAt);}
function rememberDeleted(a){const key=assetSyncKey(a);if(!key)return;if(!Array.isArray(state.deletedExternalIds))state.deletedExternalIds=[];if(!state.deletedExternalIds.includes(key))state.deletedExternalIds.push(key);if(a.id&&!state.deletedExternalIds.includes(a.id))state.deletedExternalIds.push(a.id);}
function icon(type){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[type]||icons.storage}</svg>`;}
// Small UI glyphs for buttons and chips; every icon-only button must carry title and aria-label.
const uiGlyphs={download:'<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',file:'<path d="M7 3.5h6.5L18 8v12.5H7z"/><path d="M13.5 3.5V8H18"/>',plus:'<path d="M12 5v14M5 12h14"/>',mail:'<path d="M4 6h16v12H4zM4 6l8 7 8-7"/>',image:'<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m5 17 4.5-4.5L13 16l2.5-2.5L19 17"/>',terminal:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m7.5 10 3 2.5-3 2.5M13 15h3.5"/>',refresh:'<path d="M19.5 9.5A8 8 0 0 0 5.2 7.8M4.5 14.5a8 8 0 0 0 14.3 1.7"/><path d="M5 4v4h4M19 20v-4h-4"/>',cloud:'<path d="M3.5 15.5h12a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.8A3.5 3.5 0 0 0 3.5 15.5Z"/>',github:'<path d="M9 19c-4 1.5-4-2-7-2m14 5v-3.9a3.4 3.4 0 0 0-1-2.6c3.2-.3 6.5-1.5 6.5-7A5.2 5.2 0 0 0 19 4.6 4.8 4.8 0 0 0 18.9 1S17.7.7 15 2.5a10.4 10.4 0 0 0-6 0C6.3.7 5.1 1 5.1 1A4.8 4.8 0 0 0 5 4.6 5.2 5.2 0 0 0 3.5 8.5c0 5.4 3.3 6.7 6.5 7a3.4 3.4 0 0 0-1 2.6V22"/>',back:'<path d="M10 6 4 12l6 6M4 12h16"/>',info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',warn:'<path d="M12 4 3 19.5h18z"/><path d="M12 10v4.5M12 17h.01"/>',check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18"/>',tray:'<path d="M4 13.5 6.5 5.5h11L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18Z"/><path d="M4 13.5h4.5a1 1 0 0 1 1 1 2.5 2.5 0 0 0 5 0 1 1 0 0 1 1-1H20"/>',palette:'<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.7 0-.9.7-1.6 1.7-1.6h2.2a3.3 3.3 0 0 0 3.3-3.3C20 6.9 16.5 3.5 12 3.5Z"/><circle cx="7.8" cy="11" r=".7"/><circle cx="10.5" cy="7.5" r=".7"/><circle cx="15" cy="8" r=".7"/>',clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',eyeoff:'<path d="M3.5 12s3.2-5.5 8.5-5.5S20.5 12 20.5 12s-3.2 5.5-8.5 5.5S3.5 12 3.5 12Z"/><circle cx="12" cy="12" r="2.5"/><path d="M4.5 4.5l15 15"/>',spark:'<path d="M11 4c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5C8.4 9.9 10.4 7.9 11 4Z"/>'};
// v15 shell glyphs: view switch, sidebar views, disclosure, more, external link.
Object.assign(uiGlyphs,{list:'<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',tiles:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',stack:'<path d="m12 4 8 4-8 4-8-4z"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4"/>',chevron:'<path d="m9.5 6 6 6-6 6"/>',more:'<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="2.6"/>',external:'<path d="M13.5 4.5h6v6M19.5 4.5 11 13M17.5 13.5v5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 6 6.5h5"/>'});
function ui(name){return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${uiGlyphs[name]||''}</svg>`;}
// One rounded tile per asset (DESIGN-PRINCIPLES §9): a real icon (custom iconData, then a fetched siteIcon) wins; the category line icon only fills in when there is none.
function customIconSrc(a){return typeof a?.iconData==='string'&&a.iconData.length<400000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(a.iconData)?a.iconData:'';}
function hasRealIcon(a){return !!(customIconSrc(a)||siteIconSrc(a));}
// The panorama draws a tile only for a real platform icon; its blocks already say the category.
function cardTile(a,size=''){return hasRealIcon(a)?tile(a,size):'';}
function tile(a,size=''){const custom=customIconSrc(a),src=custom||siteIconSrc(a),tone=src?markTone(src):'';return `<span class="tile${size?' '+size:''} ${custom?'custom-art':src?'custom-art site-art':'type-art'}${tone?' '+tone:''}" aria-hidden="true">${src?`<img src="${src}" alt="" draggable="false">`:icon(a.type)}</span>`;}
function searchText(a){return [a.name,a.provider,a.purpose,a.reason,a.account,cats[a.type]?.name,regionName(a.region),a.region,a.network,a.last4,a.phone,String(a.phone||'').replace(/\D/g,''),...assetIps(a).map(x=>x.ip)].filter(Boolean).join(' ').toLowerCase();}
function siteIconSrc(a){return typeof a?.siteIcon==='string'&&a.siteIcon.length<400000&&/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(a.siteIcon)?a.siteIcon:'';}
function assetMark(a){const src=customIconSrc(a)||siteIconSrc(a),tone=src?markTone(src):'';return src?`<img class="site-mark${tone?' '+tone:''}" src="${src}" alt="" draggable="false">`:icon(a.type);}
function matches(a){return !query||searchText(a).includes(query.toLowerCase());}
function safeManagementUrl(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&url.hostname&&!url.username&&!url.password?url.href:null;}catch{return null;}}
function displayName(a){return a.source==='github'&&a.name.includes('/')?a.name.slice(a.name.indexOf('/')+1):a.name;}
// Repositories: public is the default and says nothing, private is a lock beside the name; without a date the foot shows how recently it changed. Undated, unknown rows stay blank.
function isPrivateRepo(a){return a.type==='repository'&&(a.event==='私有仓库'||a.syncStatus==='私有仓库');}
function ageText(iso){const t=Date.parse(iso);if(!t)return '';const days=Math.floor((Date.now()-t)/86400000);return days<=0?'今天':days<31?`${days} 天前`:days<365?`${Math.floor(days/30)} 个月前`:`${Math.floor(days/365)} 年前`;}
function quietEvent(a){const e=a.event||'';if(a.type==='repository'&&(e==='公开仓库'||e==='私有仓库'||!e))return ageText(a.updatedAt);return e==='日期待补充'?'':e;}
function eventInfo(a){if(a.syncMissing)return {text:'本次未返回',cls:'warn'};const status=assetDateStatus(a);if(status.level==='none')return {text:assetProfiles[a.type]?'':quietEvent(a),cls:''};if(a.type==='bankcard'&&status.level==='upcoming')return {text:`有效期 ${expiryText(a.date)}`,cls:''};return {text:status.label,cls:status.level==='overdue'?'warn overdue':status.level==='soon'?'warn':''};}
function lockMark(a){return isPrivateRepo(a)?`<span class="lock-mark" role="img" aria-label="私有仓库" title="私有仓库">${ui('lock')}</span>`:'';}
// Manual "stopped" (v13b P5): a registered fact, never a probe. Default is in use; only the stopped ones carry a mark (hollow ring), the name goes muted.
const STOPPABLE=['server','domain','repository','database','license'];
const stopRing=a=>a.stopped?'<i class="stop-ring" role="img" aria-label="已停用" title="已停用"></i>':'';
function toggleStopped(id){
 const a=state.assets.find(x=>x.id===id);if(!a||!STOPPABLE.includes(a.type))return false;
 checkpoint();if(a.stopped)delete a.stopped;else a.stopped=true;save();render();if(activeAsset===id&&!$('#detail').hidden)showDetail(id);
 toast(a.stopped?'已标为停用':'已恢复启用',true);return true;
}
// Category quick actions (DESIGN-PRINCIPLES §5): at most QUICK_LIMIT icon buttons on a row, the full list in the inspector.
const quickIcons={open:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3.5H4A1.5 1.5 0 0 0 2.5 5v7A1.5 1.5 0 0 0 4 13.5h7a1.5 1.5 0 0 0 1.5-1.5V9M9.5 2.5h4v4M13.5 2.5 7.5 8.5"/></svg>',copy:'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"/></svg>',local:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z"/></svg>','copy-ssh':'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="2"/><path d="M4.5 6.5 6.5 8l-2 1.5M8 10h3"/></svg>'};
function assetQuick(a){const link=safeManagementUrl(a?.url);return quickActions(a,{link:link&&new URL(link).hostname!=='example.com'?link:'',native:!!nativeStore});}
function quickButtons(a){return assetQuick(a).slice(0,QUICK_LIMIT).map(q=>`<button class="quick-action" data-action="quick" data-id="${esc(a.id)}" data-quick="${q.id}" aria-label="${esc(q.label)} · ${esc(a.name)}" title="${esc(q.label)}">${quickIcons[q.id]||quickIcons[q.kind]}</button>`).join('');}
function quickRow(a){const list=assetQuick(a).filter(q=>q.kind!=='open');return list.length?`<div class="detail-actions quick-row">${list.map(q=>`<button class="button" data-action="quick" data-id="${esc(a.id)}" data-quick="${q.id}">${quickIcons[q.id]||quickIcons[q.kind]}${esc(q.label)}</button>`).join('')}</div>`:'';}
function copyText(text,done){
 if(nativeStore){window.webkit.messageHandlers.assetboard.postMessage({action:'copyText',text});toast(done);return;}
 const fallback=()=>{const back=document.activeElement,t=document.createElement('textarea');t.value=text;t.setAttribute('readonly','');t.style.cssText='position:fixed;opacity:0;pointer-events:none';document.body.append(t);t.select();let ok=false;try{ok=document.execCommand('copy');}catch{}t.remove();back?.focus?.();toast(ok?done:'无法访问剪贴板，请在详情里手动复制');};
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>toast(done),fallback);else fallback();
}
// kind picks the first action of that kind when no id is given (O opens, ⌘C copies); returns false when the asset has none.
function runQuick(id,quickId,kind){
 const a=state.assets.find(x=>x.id===id);if(!a)return false;
 const list=assetQuick(a),q=quickId?list.find(x=>x.id===quickId):list.find(x=>x.kind===kind)||(kind==='open'?list.find(x=>x.kind==='local'):null);
 if(!q)return false;
 if(q.kind==='open'){if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'openExternal',url:q.value});else window.open(q.value,'_blank','noopener,noreferrer');}
 else if(q.kind==='copy')copyText(q.value,`已复制${q.done}`);
 else if(q.kind==='local'&&nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'openLocalDirectory',path:q.value});
 return true;
}
window.assetboardLocalResult=ok=>toast(ok?'已打开':'找不到这个目录，请检查路径');
// While searching, a match that only lives in the purpose says so, otherwise the row would look unrelated to the query.
function searchHit(a){if(!query||!a.purpose)return '';const q=query.toLowerCase(),seen=[a.name,a.provider,a.account].filter(Boolean).join(' ').toLowerCase();return a.purpose.toLowerCase().includes(q)&&!seen.includes(q)?`<span class="card-hit">用途：${esc(a.purpose)}</span>`:'';}
// Server relations never print names on a row (v13): a mounted record gets a small server icon, a server its mount count, an account its server count.
// The dot is the colour of the servers' expiry (never reorders anything); the names live in title and aria-label.
function relMark(a){
 if(a.hiddenAt||!['server','subscription',...MOUNT_TYPES].includes(a.type))return '';
 const chain=serverChain(state.assets,a),seen=list=>list.filter(x=>!isHidden(x));
 let n=0,label='',tone='',withIcon=true,withCount=false;
 if(a.type==='server'){n=seen(chain.mounts).length;label=`挂载 ${n} 项`;withIcon=false;withCount=true;const level=assetDateStatus(a).level;tone=level==='overdue'?'red':level==='soon'?'amber':'';}
 else if(a.type==='subscription'){n=seen(chain.owned).length;label=`名下 ${n} 台服务器`;withCount=true;}
 else{const servers=seen(chain.servers);n=servers.length;label=`部署在 ${servers.map(x=>x.name+(linkMetaOf(a,x.id).standby?'（备用）':'')).join('、')}`;withCount=n>1;tone=serverTone(state.assets,a);}
 if(!n)return '';
 return `<span class="rel-mark${tone?' '+tone:''}" role="img" aria-label="${esc(label)}" title="${esc(label)}">${tone?'<i class="rel-dot" aria-hidden="true"></i>':''}${withIcon?icon('server'):''}${withCount?`<b>${n>99?'99+':n}</b>`:''}</span>`;
}
function identityText(a){return {bankcard:[a.network,a.last4&&`•••• ${a.last4}`],phone:[maskPhone(a.phone)],appleid:[maskEmail(a.account)],google:[maskEmail(a.account)],ai:[a.provider]}[a.type]?.filter(Boolean).join(' ')||a.provider||'';}
// v15 shell (2026-10-15, user-confirmed): a sidebar of views, every asset grouped by category as a list or a grid, a docked inspector.
// The overview never truncates; groups fold instead. View and layout are per-viewer conveniences kept in localStorage, not in the board.
const VIEW_KEY='assetboard-view-v1';
function readViewPrefs(){try{return JSON.parse(localStorage.getItem(VIEW_KEY)||'{}')||{};}catch{return {};}}
function writeViewPrefs(){try{localStorage.setItem(VIEW_KEY,JSON.stringify({view,layout:layoutMode}));}catch{}}
{const prefs=readViewPrefs();if(prefs.layout==='grid')layoutMode='grid';if(typeof prefs.view==='string')view=prefs.view;}
// Sidebar categories follow state.blocks; a category that holds assets is always listed, even without a block entry.
function categoryIds(){const ids=state.blocks.map(b=>b.id).filter(id=>cats[id]);for(const a of state.assets)if(cats[a.type]&&!ids.includes(a.type))ids.push(a.type);return ids;}
function currentView(){if(view==='all'||view==='upcoming')return view;if(view==='hidden')return state.assets.some(isHidden)?'hidden':'all';return cats[view]&&categoryIds().includes(view)?view:'all';}
function setView(next){if(!['all','upcoming','hidden'].includes(next)&&!cats[next])return;view=next;writeViewPrefs();if(query){query='';$('#search').value='';}render();scrollTo(0,0);}
function setLayout(next){if(!['list','grid'].includes(next)||next===layoutMode)return;layoutMode=next;writeViewPrefs();render();}
function liveAssets(){return state.assets.filter(a=>!isHidden(a));}
function dueLevels(list){let overdue=0,soon=0;for(const a of list){const level=assetDateStatus(a).level;if(level==='overdue')overdue++;else if(level==='soon')soon++;}return {overdue,soon};}
function dueWords({overdue,soon}){return [overdue&&`${overdue} 项已过期`,soon&&`${soon} 项 30 天内到期`].filter(Boolean).join('，');}
function navCount(n,level=''){return `<span class="nav-count${level?' '+level:''}"${n>DISPLAY_LIMITS.count?` title="${n}"`:''}>${formatCount(n)}</span>`;}
function navItem(id,label,glyph,count,attrs=''){const on=!query&&currentView()===id;return `<button class="nav-item${on?' active':''}" data-action="view" data-id="${id}"${on?' aria-current="page"':''} ${attrs}>${glyph}<span class="nav-label">${esc(label)}</span>${count}</button>`;}
function renderSidebar(){
 const live=liveAssets(),hidden=state.assets.length-live.length,due=dueLevels(live),dueCount=due.overdue+due.soon;
 const catItems=categoryIds().map(id=>{const own=live.filter(a=>a.type===id),l=dueLevels(own),words=dueWords(l);return navItem(id,cats[id].name,`<span class="nav-icon">${icon(id)}</span>`,`${l.overdue||l.soon?`<i class="nav-dot ${l.overdue?'overdue':'soon'}" aria-hidden="true"></i>`:''}${navCount(own.length)}`,`data-block="${id}" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" aria-label="${esc(cats[id].name)}，${own.length} 项${words?'，'+words:''}"`);}).join('');
 $('#sidebar').innerHTML=`<div class="nav-group">${navItem('upcoming','即将到来',ui('clock'),dueCount?navCount(dueCount,due.overdue?'overdue':'soon'):'',`aria-label="即将到来${dueCount?'，'+dueWords(due):''}"`)}${navItem('all','全部资产',ui('stack'),navCount(live.length))}</div>${catItems?`<div class="nav-group nav-cats" role="group" aria-labelledby="nav-cats-title"><h2 class="nav-title" id="nav-cats-title">类别</h2>${catItems}</div>`:''}${hidden?`<div class="nav-group">${navItem('hidden','已隐藏',ui('eyeoff'),navCount(hidden))}</div>`:''}`;
}
function renderHeader(v,shown){
 const title=query?'搜索':v==='all'?'全部资产':v==='upcoming'?'即将到来':v==='hidden'?'已隐藏':cats[v].name;
 $('#view-title').textContent=title;
 const scope=cats[v]&&!query?liveAssets().filter(a=>a.type===v):v==='all'&&!query?liveAssets():[],l=dueLevels(scope);
 $('#view-meta').innerHTML=state.assets.length?`<span${shown>DISPLAY_LIMITS.count?` title="${shown} 项"`:''}>${formatCount(shown)} 项</span>${l.overdue?`<span class="meta-flag overdue">${l.overdue} 已过期</span>`:''}${l.soon?`<span class="meta-flag soon">${l.soon} 即将到期</span>`:''}`:'';
 $('#view-menu').hidden=!(cats[v]&&!query);$('#view-menu').dataset.id=cats[v]?v:'';
 if(cats[v])$('#view-menu').setAttribute('aria-label',`${cats[v].name}类别设置`);
 const toggle=$('#layout-toggle');toggle.hidden=!state.assets.length||(v==='upcoming'&&!query);
 toggle.querySelectorAll('[data-action="layout"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===layoutMode)));
 document.title=`${title} · Assetboard`;
}
// One row or grid card per asset. The tile is the platform icon when there is one, the category line icon otherwise, so every row has the same anchor.
// A bare day count for compact lists (the panorama's next-dates list); the kind lives in the label beside it.
function agendaWhen(status){return status.days<0?`过期 ${-status.days} 天`:status.days===0?'今天':status.days===1?'明天':`${status.days} 天`;}
function costText(a){return a.cost&&a.cost!=='未知'?a.cost:'';}
function subLine(a){
 if(a.type==='server'){const ip=primaryIp(a);if(ip)return {html:`${ip.inner?'<em class="ip-inner" title="内网地址">内</em>':''}<span class="ip-text">${esc(ip.ip)}</span>${ip.more?`<em class="ip-more" aria-label="另有 IPv6">+${ip.more}</em>`:''}${a.provider?`<span class="sub-sep" aria-hidden="true">·</span><span class="ip-prov">${esc(a.provider)}</span>`:''}`,text:[assetIps(a).map(x=>x.ip).join('  '),a.provider].filter(Boolean).join(' · '),cls:'ip-sub'};}
 if(assetProfiles[a.type]){const flag=regionFlag(a.region),identity={bankcard:[a.network,a.last4&&`•••• ${a.last4}`].filter(Boolean).join(' '),phone:maskPhone(a.phone),appleid:maskEmail(a.account)||regionName(a.region),google:maskEmail(a.account)||regionName(a.region),ai:a.provider}[a.type]||'',text=[identity,{bankcard:a.provider,phone:a.provider}[a.type]].filter(Boolean).join(' · ');return {html:`${flag?`<span class="flag">${flag}</span>`:''}${esc(text)}`,text};}
 // Synced records name their account as a small tag, so two GitHub or Cloudflare accounts in one group stay apart.
 const provider=a.provider==='平台待补充'?'':a.provider,text=[provider,a.account].filter(Boolean).join(' · ');
 if(['cloudflare','github','ssh'].includes(a.source)&&a.account)return {html:`${provider?`${esc(provider)}<span class="sub-sep" aria-hidden="true">·</span>`:''}<span class="account-tag">${esc(a.account)}</span>`,text};
 return {html:esc(text),text};
}
function statusHtml(e){return `<span class="r-date${e.cls?' '+e.cls:''}">${e.cls?'<i class="dot" aria-hidden="true"></i>':''}${esc(e.text)}</span>`;}
function itemLabel(a,e,cost){return [displayName(a),isPrivateRepo(a)&&'私有仓库',a.stopped&&'已停用',isHidden(a)&&'已隐藏',e.text,cost].filter(Boolean).join('，');}
function itemActions(a){return isHidden(a)?`<button class="button r-restore" data-action="restore-asset" data-id="${esc(a.id)}">恢复</button><button class="button danger-quiet" data-action="delete-asset" data-id="${esc(a.id)}" title="只删除 Assetboard 里的记录">删除</button>`:quickButtons(a);}
function itemHtml(a,{withType=false,grid=false}={}){
 const e=eventInfo(a),cost=costText(a),sub=subLine(a),hint=[a.name,a.purpose&&a.purpose!==cats[a.type]?.name?a.purpose:'',a.reason&&`保留原因：${a.reason}`].filter(Boolean).join('\n');
 // In 即将到来 the category leads, then the keep reason when there is one (it is what helps decide), otherwise the source.
 const subHtml=withType?`${esc(cats[a.type].name)}${a.reason?`<span class="sub-sep" aria-hidden="true">·</span><span class="r-reason">${esc(a.reason)}</span>`:sub.text?`<span class="sub-sep" aria-hidden="true">·</span>${sub.html}`:''}`:sub.html;
 const name=`<span class="r-name"><span class="r-text">${esc(displayName(a))}</span>${lockMark(a)}${stopRing(a)}${relMark(a)}</span>`,subSpan=`<span class="r-sub${sub.cls&&!withType?' '+sub.cls:''}"${sub.text?` title="${esc(sub.text)}"`:''}>${subHtml}</span>`;
 const selected=activeAsset===a.id&&!$('#detail').hidden;
 return `<div class="${grid?'gcard':'row'}${a.stopped?' stopped':''}${isHidden(a)?' is-hidden':''}${selected?' selected':''}" data-asset="${esc(a.id)}"><button class="item-open" data-action="detail" data-id="${esc(a.id)}" aria-label="${esc(itemLabel(a,e,cost))}" title="${esc(hint)}">${tile(a,grid?'':'sm')}<span class="r-main">${name}${subSpan}${searchHit(a)}</span><span class="r-when">${statusHtml(e)}<span class="r-cost">${esc(cost)}</span></span></button><span class="r-actions">${itemActions(a)}</span></div>`;
}
function groupSummary(list){const l=dueLevels(list);return l.overdue||l.soon?`<span class="g-sum" role="img" aria-label="${dueWords(l)}" title="${dueWords(l)}">${l.overdue?`<span class="g-flag overdue"><i class="dot" aria-hidden="true"></i>${formatCount(l.overdue)}</span>`:''}${l.soon?`<span class="g-flag soon"><i class="dot" aria-hidden="true"></i>${formatCount(l.soon)}</span>`:''}</span>`:'';}
// A group is a category (or a date band, or the hidden pile). Only categories in the overview fold and reorder.
function groupHtml({id,title,glyph='',list,fold=false,folded=false,reorder=false,head=true,summary='',actions='',withType=false}){
 const grid=layoutMode==='grid'&&!withType,count=`<span class="g-count">${formatCount(list.length)}</span>`;
 const heading=!head?'':`<header class="group-head">${fold?`<button class="group-title" data-action="collapse" data-id="${id}" aria-expanded="${!folded}" aria-controls="group-${id}" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" title="${folded?'展开':'收起'}（按住 ⌥ 点按：全部）"><span class="g-chevron">${ui('chevron')}</span>${glyph}<span class="g-name">${esc(title)}</span>${count}</button>`:`<h2 class="group-title static">${glyph}<span class="g-name">${esc(title)}</span>${count}</h2>`}${summary}${actions?`<span class="g-actions">${actions}</span>`:''}</header>`;
 return `<section class="group${folded?' folded':''}${head?'':' solo'}" data-group="${id}" aria-label="${esc(title)}">${heading}${folded?'':`<div class="group-body ${grid?'grid':'list'}" id="group-${id}"${reorder?` data-reorder="${id}"`:''}>${list.map(a=>itemHtml(a,{withType,grid})).join('')}</div>`}</section>`;
}
function categoryActions(id){return `<button class="icon-button" data-action="add-asset" data-id="${id}" aria-label="添加${esc(cats[id].name)}" title="添加${esc(cats[id].name)}">${ui('plus')}</button><button class="icon-button" data-action="view" data-id="${id}" aria-label="只看${esc(cats[id].name)}" title="只看${esc(cats[id].name)}">${ui('chevron')}</button>`;}
function arranged(id,list){return arrangeAssets(list,state.cardOrder?.[id]);}
const UPCOMING_BANDS=[['overdue','已过期',s=>s.days<0],['week','7 天内',s=>s.days<=7],['month','30 天内',s=>s.days<=30],['later','更晚',()=>true]];
function viewEmpty(glyph,text,button=''){return `<div class="view-empty">${glyph}<p>${text}</p>${button}</div>`;}
// Returns the board HTML and how many assets it lists; an empty string means "nothing to show" (the search empty state takes over).
function boardHtml(v){
 const typeGlyph=id=>`<span class="g-icon">${icon(id)}</span>`;
 if(query){
  const hits=state.assets.filter(matches),live=hits.filter(a=>!isHidden(a)),hidden=hits.filter(isHidden);
  const html=categoryIds().map(id=>{const list=arranged(id,live.filter(a=>a.type===id));return list.length?groupHtml({id,title:cats[id].name,glyph:typeGlyph(id),list}):'';}).join('')+(hidden.length?groupHtml({id:'hidden',title:'已隐藏',glyph:`<span class="g-icon">${ui('eyeoff')}</span>`,list:hidden}):'');
  return {html,count:hits.length};
 }
 if(v==='upcoming'){
  const events=upcomingEvents(state.assets,new Date(),Infinity);
  if(!events.length)return {html:viewEmpty(ui('clock'),'还没有到期或扣款日期','<button class="button" data-action="inbox">粘贴续费通知</button>'),count:0};
  const left=[...events];
  const html=UPCOMING_BANDS.map(([id,title,fits])=>{const band=[];while(left.length&&fits(left[0].status))band.push(left.shift().asset);return band.length?groupHtml({id,title,list:band,withType:true}):'';}).join('');
  return {html,count:events.length};
 }
 if(v==='hidden'){
  const hidden=state.assets.filter(isHidden);
  return {html:categoryIds().map(id=>{const list=arranged(id,hidden.filter(a=>a.type===id));return list.length?groupHtml({id,title:cats[id].name,glyph:typeGlyph(id),list}):'';}).join(''),count:hidden.length};
 }
 const live=liveAssets();
 if(cats[v]){
  const list=arranged(v,live.filter(a=>a.type===v));
  return {html:list.length?groupHtml({id:v,title:cats[v].name,list,reorder:true,head:false}):viewEmpty(`<span class="g-icon">${icon(v)}</span>`,`还没有${esc(cats[v].name)}`,`<button class="button" data-action="add-asset" data-id="${v}">${ui('plus')}添加</button>`),count:list.length};
 }
 const html=categoryIds().map(id=>{const list=arranged(id,live.filter(a=>a.type===id));if(!list.length)return '';const folded=!!state.blocks.find(b=>b.id===id)?.folded;return groupHtml({id,title:cats[id].name,glyph:typeGlyph(id),list,fold:true,folded,reorder:true,summary:groupSummary(list),actions:categoryActions(id)});}).join('');
 return {html:html||viewEmpty(ui('stack'),'没有显示中的资产'),count:live.length};
}
let layoutFrame=0,renderedKey='',skipLayoutAnimation=false;
function render(){
 const animateLayout=!skipLayoutAnimation;skipLayoutAnimation=false;
 if(typeof applyBoardTheme==='function'&&!themePreview)applyBoardTheme(state.theme);
 cancelAnimationFrame(layoutFrame);closeMenu(false);
 const v=currentView(),key=`${query}|${v}|${layoutMode}`,same=key===renderedKey;renderedKey=key;
 // Rows slide to their new place inside the same group; groups slide as a whole (a fold above them, a moved category).
 const previousGroups=same?new Map([...document.querySelectorAll('#board .group')].map(el=>[el.dataset.group,el.getBoundingClientRect()])):new Map();
 const previousItems=same?new Map([...document.querySelectorAll('#board [data-asset]')].map(el=>{const group=el.closest('.group');return [el.dataset.asset,{rect:el.getBoundingClientRect(),group:group?.dataset.group,origin:previousGroups.get(group?.dataset.group)}];})):new Map();
 renderSidebar();
 const welcome=!query&&!state.assets.length,board=welcome?{html:'',count:0}:boardHtml(v);
 renderHeader(v,board.count);
 $('#board').hidden=welcome||!board.html;$('#welcome').hidden=!welcome;
 document.querySelectorAll('#welcome .native-only').forEach(el=>el.hidden=!nativeStore);
 $('#board').dataset.view=query?'search':cats[v]?'category':v;
 $('#board').innerHTML=board.html;
 $('#empty').hidden=welcome||!!board.html;
 $('#empty-title').textContent='没有结果';$('#empty-note').hidden=true;$('#clear-search').textContent='清除';
 syncToolbar();
 layoutFrame=requestAnimationFrame(()=>{
  layoutFrame=0;
  if(!animateLayout||reduceMotion())return;
  for(const el of document.querySelectorAll('#board .group')){const from=previousGroups.get(el.dataset.group);if(from)slideFrom(el,from,MOTION_MS);}
  for(const el of document.querySelectorAll('#board [data-asset]')){const was=previousItems.get(el.dataset.asset),group=el.closest('.group'),to=el.getBoundingClientRect(),origin=group?.getBoundingClientRect();if(!was||was.group!==group?.dataset.group||!was.origin||Math.abs(was.rect.width-to.width)>2||Math.abs(was.rect.height-to.height)>2)continue;const dx=(was.rect.left-was.origin.left)-(to.left-origin.left),dy=(was.rect.top-was.origin.top)-(to.top-origin.top);if(Math.abs(dx)>=1||Math.abs(dy)>=1)el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:MOTION_MS,easing:settleEase});}
 });
}
// Folding animates the changed groups' height in layout, so the groups below follow; the clicked header stays where it was.
function foldRender(ids,anchorId,before=new Map([...document.querySelectorAll('#board .group')].map(el=>[el.dataset.group,el.getBoundingClientRect()]))){
 const header=()=>document.querySelector(`#board .group[data-group="${CSS.escape(anchorId)}"]`),anchor=header()?.getBoundingClientRect().top;
 skipLayoutAnimation=true;render();
 if(reduceMotion())return;
 for(const id of ids){
  const el=document.querySelector(`#board .group[data-group="${CSS.escape(id)}"]`),from=before.get(id);if(!el||!from)continue;
  const to=el.getBoundingClientRect().height;if(Math.abs(to-from.height)<1)continue;
  el.animate([{height:from.height+'px',overflow:'hidden'},{height:to+'px',overflow:'hidden'}],{duration:MOTION_MS,easing:settleEase});
  el.querySelector('.group-body')?.animate([{opacity:0},{opacity:1}],{duration:160,delay:40,easing:'ease-out',fill:'backwards'});
 }
 if(anchor===undefined)return;
 const until=performance.now()+MOTION_MS+60,hold=()=>{const top=header()?.getBoundingClientRect().top;if(top===undefined)return;if(Math.abs(top-anchor)>.5)scrollBy(0,top-anchor);if(performance.now()<until)requestAnimationFrame(hold);};
 requestAnimationFrame(hold);
}
function setIconButton(el,glyph,label,badge=''){if(!el)return;el.innerHTML=ui(glyph)+(badge?`<i class="count-badge">${badge}</i>`:'');el.setAttribute('aria-label',label);el.title=label;}
function syncToolbar(){const pending=pendingCount();setIconButton($('#inbox-button'),'tray',pending?`待确认 ${formatCount(pending)}`:'待确认',pending?formatCount(pending):'');if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'toolbarState',query,pending});}
// The selected row follows the inspector without a re-render.
function markSelected(){document.querySelectorAll('#board .selected').forEach(n=>n.classList.remove('selected'));const open=!$('#detail').hidden;document.body.classList.toggle('inspecting',open);if(open&&activeAsset)document.querySelector(`#board [data-asset="${CSS.escape(activeAsset)}"]`)?.classList.add('selected');}
// One small menu for the inspector's ⋯ and a row's context menu. Items are ordinary data-action buttons, so they run through the one click handler.
let menuReturn=null;
function assetMenuItems(a,full=false){
 const id=a.id,items=[],link=safeManagementUrl(a.url),realLink=link&&new URL(link).hostname!=='example.com';
 if(full){if(realLink)items.push({action:'external',label:'打开管理页',key:'O'});items.push({action:'edit-asset',label:'编辑…',key:'E'});for(const q of assetQuick(a).filter(q=>q.kind!=='open'))items.push({action:'quick',label:q.label,quick:q.id});items.push('-');}
 if(!a.hiddenAt){items.push({action:'pin-front',label:'放到前面',key:'F'});if(manualOrder(a.type))items.push({action:'auto-order',label:'恢复自动排序'});items.push({action:'link-picker',label:'关联…',key:'L'});}
 if(nativeStore)items.push({action:'icon-dialog',label:'网站图标…'});
 if(STOPPABLE.includes(a.type)&&!a.hiddenAt)items.push({action:'toggle-stopped',label:a.stopped?'恢复启用':'标为停用',key:'S'});
 items.push({action:a.hiddenAt?'restore-asset':'hide-asset',label:a.hiddenAt?'恢复显示':'隐藏',key:'H'},'-',{action:'delete-asset',label:'删除…',danger:true});
 return items.map(x=>x==='-'?x:{...x,id});
}
function openMenu(items,{x,y,anchor}={}){
 const menu=$('#menu');menuReturn=document.activeElement;
 menu.innerHTML=items.map(x=>x==='-'?'<div class="menu-sep" role="separator"></div>':`<button class="menu-item${x.danger?' danger':''}" role="menuitem" tabindex="-1" data-action="${x.action}" data-id="${esc(x.id)}"${x.quick?` data-quick="${esc(x.quick)}"`:''}><span>${esc(x.label)}</span>${x.key?`<kbd>${x.key}</kbd>`:''}</button>`).join('');
 menu.hidden=false;anchor?.setAttribute('aria-expanded','true');menu.anchor=anchor||null;
 const r=anchor?.getBoundingClientRect(),w=menu.offsetWidth,h=menu.offsetHeight;let left=r?r.right-w:x,top=r?r.bottom+4:y;
 if(left+w>innerWidth-8)left=innerWidth-w-8;if(top+h>innerHeight-8)top=r?r.top-h-4:innerHeight-h-8;
 menu.style.left=Math.max(8,left)+'px';menu.style.top=Math.max(8,top)+'px';
 menu.querySelector('.menu-item')?.focus();
}
function closeMenu(restore=true){const menu=$('#menu');if(!menu||menu.hidden)return;menu.hidden=true;menu.innerHTML='';menu.anchor?.setAttribute('aria-expanded','false');menu.anchor=null;if(restore&&menuReturn?.isConnected)menuReturn.focus();menuReturn=null;}
document.addEventListener('pointerdown',e=>{if(!$('#menu').hidden&&!e.target.closest('#menu,[data-action="asset-menu"]'))closeMenu(false);},true);
document.addEventListener('keydown',e=>{
 const menu=$('#menu');if(menu.hidden)return;
 const items=[...menu.querySelectorAll('.menu-item')],at=items.indexOf(document.activeElement);
 if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeMenu();return;}
 if(e.key==='Tab'){closeMenu(false);return;}
 if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();const next=e.key==='Home'?0:e.key==='End'?items.length-1:(at+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();return;}
 if(e.key.length===1&&!e.metaKey&&!e.ctrlKey){e.preventDefault();e.stopImmediatePropagation();const hit=items.find(n=>n.querySelector('kbd')?.textContent.toLowerCase()===e.key.toLowerCase());if(hit)hit.click();}
},true);
document.addEventListener('contextmenu',e=>{
 const item=e.target.closest?.('#board [data-asset]'),a=item&&state.assets.find(x=>x.id===item.dataset.asset);if(!a||gesture)return;
 e.preventDefault();openMenu(assetMenuItems(a,true),{x:e.clientX,y:e.clientY});
});
addEventListener('scroll',()=>closeMenu(false),{passive:true});
function sourceLabel(a){if(a.syncMissing)return `${a.source==='github'?'GitHub':'Cloudflare'} 本次未返回`;if(a.source==='github')return `GitHub 仓库 · ${a.syncStatus||'状态未知'}`;if(a.source==='cloudflare')return `Cloudflare ${a.resourceKind||'Zone'} · ${a.syncStatus||'状态未知'}`;return a.source==='manual'?'手动录入':'演示资产';}
function dateText(a){const status=assetDateStatus(a);if(status.level==='none')return a.date||'待补充';return [status.label.startsWith(status.date)?status.label:`${status.date} · ${status.label}`,billingCycles[a.cycle]?`${billingCycles[a.cycle].label}重复`:''].filter(Boolean).join(' · ');}
// Manual display order from the inspector menu: bring one record to the front of its category, or go back to recency order.
function manualOrder(type){return !!state.cardOrder?.[type]?.length;}
function pinFront(id){const a=state.assets.find(x=>x.id===id);if(!a||a.hiddenAt)return;checkpoint();state.cardOrder||={};state.cardOrder[a.type]=bringToFront(state.cardOrder[a.type],id);save();render();if(activeAsset===id)showDetail(id);toast('已放到最前',true);}
function autoOrder(id){const a=state.assets.find(x=>x.id===id);if(!a||!manualOrder(a.type))return;checkpoint();if(state.cardOrder)delete state.cardOrder[a.type];save();render();if(activeAsset===id)showDetail(id);toast('已恢复自动排序',true);}
// The inspector: one primary action (打开 when there is a management link, otherwise 编辑), category quick actions, the rest behind ⋯.
// Opening by keyboard, or as an overlay on a narrow window, moves focus into it; a click on a wide window leaves focus on the row so ↑/↓ keep browsing.
function showDetail(id,{focus}={}){
 const a=state.assets.find(a=>a.id===id);if(!a)return;
 const wasOpen=!$('#detail').hidden,active=document.activeElement,inside=!!active?.closest?.('#detail');if(active&&!active.closest?.('#detail,#menu'))lastFocus=active;
 activeAsset=id;
 const link=safeManagementUrl(a.url),realLink=link&&new URL(link).hostname!=='example.com',lastSync=a.syncedAt&&!isNaN(Date.parse(a.syncedAt))?new Date(a.syncedAt).toLocaleString('zh-CN'):'';
 const sub=assetProfiles[a.type]?[regionFlag(a.region),identityText(a)].filter(Boolean).join(' '):[a.provider,a.account].filter(Boolean).join(' · ');
 const primary=a.hiddenAt?`<button class="button primary" data-action="restore-asset" data-id="${esc(id)}">恢复显示</button>`:realLink?`<button class="button primary" data-action="external" data-id="${esc(id)}" title="打开管理页">${ui('external')}打开</button>`:'';
 const actions=`<div class="detail-actions main-actions">${primary}<button class="button${primary?'':' primary'}" data-action="edit-asset" data-id="${esc(id)}">编辑</button><button class="button icon-only detail-more" data-action="asset-menu" data-id="${esc(id)}" aria-haspopup="menu" aria-expanded="false" aria-label="更多操作" title="更多操作">${ui('more')}</button></div>`;
 const source={cloudflare:'同步自 Cloudflare，名称和账号下次同步会按平台值更新。',github:'同步自 GitHub，名称和账号下次同步会按平台值更新。',ssh:'来自 ~/.ssh/config，名称和主机下次导入会按配置更新。',manual:'',demo:'演示数据，不代表实际账户。'}[a.source]??'演示数据，不代表实际账户。';
 const notes=a.notes||source?`<details><summary>${a.notes?'备注':'来源'}${a.notes&&source?' · 来源':''}</summary>${a.notes?`<p>${esc(a.notes)}</p>`:''}${source?`<p>${source}</p>`:''}</details>`:'';
 $('#detail-content').innerHTML=`<div class="detail-head">${tile(a,'lg')}<span class="eyebrow">${esc(cats[a.type].name)}${a.hiddenAt?' · 已隐藏':''}</span></div><h2>${esc(a.name)}</h2>${sub?`<p class="detail-sub">${esc(sub)}</p>`:''}${a.purpose?`<span class="detail-badge">${esc(a.purpose)}</span>`:''}${actions}${a.hiddenAt?'':quickRow(a)}<div class="facts">${detailFacts(a,lastSync)}</div>${linkSection(a)}${notes}`;
 $('#detail').hidden=false;markSelected();
 if(focus??(wasOpen?inside:!inspectorDocked()))$('#close-detail').focus();
}
// Masked values reveal on request; the full value never appears in the list.
function secret(full,masked){return full&&masked&&masked!==full?`<span class="secret" data-full="${esc(full)}" data-masked="${esc(masked)}">${esc(masked)}</span><button class="text-button reveal" data-action="reveal" aria-pressed="false">显示</button>`:esc(full||'');}
function detailFacts(a,lastSync){
 const row=([k,html])=>`<div class="fact"><span>${k}</span><span>${html}</span></div>`,text=value=>esc(value||'');
 if(!assetProfiles[a.type]){const list=assetIps(a),net=list.length?`<div class="fact"><span>网络</span><span class="ip-pills">${list.map(x=>`<button class="ip-pill" data-action="copy-ip" data-ip="${esc(x.ip)}" title="复制 IP" aria-label="复制 IP ${esc(x.ip)}">${x.inner?'<em>内</em>':''}${esc(x.ip)}</button>`).join('')}</span></div>`:'';return [['保留原因',a.reason],['费用',a.cost&&a.cost!=='未知'?a.cost:''],['下一日期',a.date?dateText(a):''],['账号',a.account],['状态',sourceLabel(a)],...(lastSync?[['同步于',lastSync]]:[])].filter(([,v])=>v).map(([k,v])=>row([k,esc(v)])).join('')+net;}
 const region=a.region?`${regionFlag(a.region)} ${regionName(a.region)}`:'',when=a.date?dateText(a):'';
 const rows={
  bankcard:[['地区',text(region)],['卡号',text(a.last4&&`•••• ${a.last4}`)],['卡组织',text(a.network)],['有效期',a.date?esc(`${expiryText(a.date)} · ${assetDateStatus(a).label}`):text('')],['发卡行',text(a.provider)],['账户备注',text(a.account)]],
  phone:[['地区',text(region)],['号码',secret(a.phone,maskPhone(a.phone))],['运营商',text(a.provider)],['保号',text(when)],['实名或用途',text(a.account)]],
  appleid:[['地区',text(region)],['登录邮箱',secret(a.account,maskEmail(a.account))]],
  google:[['地区',text(region)],['登录邮箱',secret(a.account,maskEmail(a.account))]],
  ai:[['服务',text(a.provider)],['费用',text(a.cost==='未知'?'':a.cost)],['下次扣款',text(when)],['登录账号',secret(a.account,maskEmail(a.account))]]
 }[a.type];
 return [...rows,...(a.reason?[['保留原因',esc(a.reason)]]:[]),['状态',esc(sourceLabel(a))]].filter(([,v])=>v).map(row).join('');
}
function linkSection(a){
 const links=linkedAssets(state.assets,a),groups=new Map(),first=a.type==='server'?['subscription','domain','repository','database','license']:['server','subscription'];
 for(const type of first)groups.set(type,[]);
 for(const x of links){if(!groups.has(x.type))groups.set(x.type,[]);groups.get(x.type).push(x);}
 const servers=links.filter(x=>x.type==='server'&&relationKind(a,x)==='mount').length;
 const row=x=>{
  const kind=relationKind(a,x),meta=kind==='mount'&&x.type==='server'?linkMetaOf(a,x.id):a.type==='server'&&kind==='mount'?linkMetaOf(x,a.id):null;
  const tags=kind==='mount'&&x.type==='server'?`${servers>1?`<button class="link-tag" data-action="link-standby" data-id="${esc(a.id)}" data-target="${esc(x.id)}" aria-pressed="${meta.standby}" title="备用服务器">备</button>`:''}${a.type==='domain'?`<button class="link-tag" data-action="link-proxy" data-id="${esc(a.id)}" data-target="${esc(x.id)}" aria-pressed="${meta.proxied}" title="经 Cloudflare 代理">代理</button>`:''}`
   :meta&&(meta.standby||meta.proxied)?`${meta.standby?'<span class="link-tag on" title="备用服务器">备</span>':''}${meta.proxied?'<span class="link-tag on" title="经 Cloudflare 代理">代理</span>':''}`:'';
  const sub=[titled?'':cats[x.type].name,x.type==='server'?primaryIp(x)?.ip:'',identityText(x),x.hiddenAt?'已隐藏':''].filter(Boolean).join(' · ');
  return `<div class="link-row${x.hiddenAt?' is-hidden':''}"><button class="link-open" data-action="detail" data-id="${esc(x.id)}">${assetMark(x)}<span><b>${esc([regionFlag(x.region),displayName(x)].filter(Boolean).join(' '))}</b><small>${esc(sub)}</small></span></button>${tags}<button class="icon-button" data-action="unlink" data-id="${esc(a.id)}" data-target="${esc(x.id)}" aria-label="取消关联 ${esc(x.name)}">×</button></div>`;
 };
 const filled=[...groups].filter(([,list])=>list.length),titled=filled.length>1;
 const body=filled.map(([type,list])=>`<div class="link-group" role="group" aria-label="${esc(cats[type].name)}，${list.length} 项">${titled?`<span class="link-group-title">${esc(cats[type].name)}<i>${list.length}</i></span>`:''}${list.slice(0,4).map(row).join('')}${list.length>4?`<details class="link-rest"><summary aria-label="另外 ${list.length-4} 项">+${list.length-4}</summary>${list.slice(4).map(row).join('')}</details>`:''}</div>`).join('');
 return `<section class="detail-links" aria-label="关联"><div class="detail-links-head"><strong>关联</strong><button class="text-button" data-action="link-picker" data-id="${esc(a.id)}" title="${esc(assetProfiles[a.type]?.links||'关联相关资产，例如域名所在的服务器')}">＋ 关联</button></div>${body}</section>`;
}
function linkPicker(id){
 const a=state.assets.find(x=>x.id===id);if(!a)return;
 const linked=new Set(linkedAssets(state.assets,a).map(x=>x.id)),order=a.type==='server'?['domain','repository','database','license','subscription']:[...MOUNT_TYPES,'subscription'].includes(a.type)?['server']:linkOrder[a.type]||[],rank=type=>{const index=order.indexOf(type);return index<0?order.length:index;};
 const options=state.assets.filter(x=>x.id!==id&&!linked.has(x.id)&&linkAllowed(a,x)).sort((left,right)=>rank(left.type)-rank(right.type)||left.name.localeCompare(right.name));
 modal(`关联到「${a.name}」`,`<input id="link-search" class="link-search" placeholder="搜索名称、尾号、号码或地区" aria-label="搜索要关联的资产"><div class="link-options">${options.map(x=>`<button class="link-option" data-action="link" data-id="${esc(id)}" data-target="${esc(x.id)}" data-search="${esc(searchText(x))}">${assetMark(x)}<span>${esc([regionFlag(x.region),displayName(x)].filter(Boolean).join(' '))}<small>${esc([cats[x.type].name,x.type==='server'?primaryIp(x)?.ip:'',identityText(x)].filter(Boolean).join(' · '))}</small></span></button>`).join('')||'<p class="form-note">没有可以关联的其他资产。</p>'}</div>`);
 $('#link-search').oninput=e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('.link-option').forEach(option=>option.hidden=!!q&&!option.dataset.search.includes(q));};$('#link-search').focus();
}
// The Mac app downloads the icon from the site itself when asked; the page previews it and saves it only after confirmation.
let iconRequest=0,iconPreview=null;
function iconDialog(id){
 const a=state.assets.find(x=>x.id===id);if(!a||!nativeStore)return;
 const current=siteIconSrc(a);iconPreview=null;
 modal(`「${a.name}」的网站图标`,`<form id="icon-form" class="form" data-id="${esc(id)}"><label>网站域名<input name="host" required maxlength="253" autocomplete="off" value="${esc(a.siteIconHost||iconHost(a))}" placeholder="例如 wise.com"></label><div class="icon-preview" id="icon-preview" aria-live="polite">${current?`<img src="${current}" alt="当前图标">`:''}<span id="icon-status" class="form-note">${current?`当前图标来自 ${esc(a.siteIconHost||'网站')}。`:'图标直接从这个网站下载，不经过其他服务，只保存在此 Mac。'}</span></div><div class="confirm-actions"><button class="button" type="submit">获取</button><button class="button primary" type="button" data-action="icon-apply" data-id="${esc(id)}" disabled>使用这个图标</button>${a.siteIcon?`<button class="button danger-quiet" type="button" data-action="icon-remove" data-id="${esc(id)}">移除</button>`:''}</div><button class="text-button icon-batch-link" type="button" data-action="icon-batch">为全部资产获取网站图标…</button></form>`);
 $('#icon-form [name="host"]').focus();
}
window.assetboardIconResult=result=>{
 if(iconBatch?.pending.has(result?.requestId)){iconBatchReply(result);return;}
 if(result?.requestId!==iconRequest||!$('#icon-form'))return;
 $('#icon-form [type="submit"]').disabled=false;
 const valid=result.ok&&siteIconSrc({siteIcon:result.dataUrl});
 if(!valid){$('#icon-status').textContent=result.error||'没有获取到可用的图标。';return;}
 iconPreview={host:String(result.host||''),dataUrl:result.dataUrl};
 $('#icon-preview').innerHTML=`<img src="${result.dataUrl}" alt="获取到的图标"><span id="icon-status" class="form-note">来自 ${esc(iconPreview.host)}。确认后替换卡片上的图标。</span>`;
 $('[data-action="icon-apply"]').disabled=false;$('[data-action="icon-apply"]').focus();
};
document.addEventListener('submit',e=>{if(e.target.id!=='icon-form')return;e.preventDefault();const host=e.target.elements.host.value.trim();if(!host||!nativeStore)return;iconPreview=null;$('[data-action="icon-apply"]').disabled=true;e.target.querySelector('[type="submit"]').disabled=true;$('#icon-status').textContent=`正在从 ${host} 获取…`;window.webkit.messageHandlers.assetboard.postMessage({action:'iconFetch',requestId:++iconRequest,host});});
// 「为全部资产获取网站图标」(DESIGN-PRINCIPLES §9 rule 16): native only, started by the person, never in demo mode.
// The confirm step lists only vendor homepages from iconVendors; three requests at a time; one request per vendor, shared by its assets;
// results are applied together after the run, behind one checkpoint, so a single undo removes them all. Failures keep the category icon.
const ICON_BATCH_LIMIT=3,ICON_BATCH_TIMEOUT=30000;let iconBatch=null,iconBatchOverwrite=false;
// Icons already on this Mac, by vendor host; skipped when the person asks to replace icons, since that means fetching fresh ones.
function iconCache(){const cache=new Map();if(iconBatchOverwrite)return cache;for(const a of state.assets){const src=siteIconSrc(a),v=src&&vendorForHost(a.siteIconHost);if(v&&!cache.has(v.host))cache.set(v.host,src);}return cache;}
function iconBatchDialog(){
 if(demoMode){window.assetboardDemoBlocked();return;}
 if(!nativeStore){toast('网站图标只能在 Mac App 里获取');return;}
 if(iconBatch)return;
 const plan=iconPlan(state.assets,{overwrite:iconBatchOverwrite}),cache=iconCache(),fetchHosts=plan.hosts.filter(h=>!cache.has(h.host)),reuse=plan.hosts.filter(h=>cache.has(h.host)),assetsCount=plan.hosts.reduce((n,h)=>n+h.ids.length,0),existing=iconPlan(state.assets,{overwrite:true}).hosts.reduce((n,h)=>n+h.ids.length,0)-iconPlan(state.assets).hosts.reduce((n,h)=>n+h.ids.length,0);
 const skips=[plan.skipped.unknown&&`${formatCount(plan.skipped.unknown)} 项没有识别出平台`,plan.skipped.existing&&`${formatCount(plan.skipped.existing)} 项已有网站图标`,plan.skipped.custom&&`${formatCount(plan.skipped.custom)} 项用的是自定义图标`,plan.skipped.hidden&&`${formatCount(plan.skipped.hidden)} 项已隐藏`].filter(Boolean),skipCount=(plan.skipped.unknown||0)+(plan.skipped.existing||0)+(plan.skipped.custom||0)+(plan.skipped.hidden||0);
 const list=fetchHosts.length?`<ul class="icon-batch-hosts">${fetchHosts.map(h=>`<li><span class="tile sm type-art" aria-hidden="true">${icon('domain')}</span><strong>${esc(h.host)}</strong><span class="chip">${formatCount(h.ids.length)} 项</span></li>`).join('')}</ul>`:'';
 modal('获取网站图标',`<div id="icon-batch" class="form">${plan.hosts.length?`<p class="icon-batch-lead"><strong>${formatCount(assetsCount)}</strong> 项资产</p>${list}${reuse.length?`<p class="form-note">${esc(reuse.map(h=>h.label).join('、'))} 的图标已在本机</p>`:''}`:'<p class="form-note">没有需要获取图标的资产</p>'}
 ${existing?`<label class="check-row"><input type="checkbox" id="icon-batch-overwrite" ${iconBatchOverwrite?'checked':''}> 替换已有图标（${formatCount(existing)} 项）</label>`:''}
 ${fetchHosts.length?`<p class="form-note icon-batch-net">${ui('lock')}只访问上面的平台官网，不带 Cookie，不发送资产信息</p>`:''}
 ${skips.length?`<details class="icon-skip"><summary>不处理 ${formatCount(skipCount)} 项</summary><ul>${skips.map(s=>`<li>${s}</li>`).join('')}</ul></details>`:''}
 <div class="confirm-actions"><button class="button primary" data-action="icon-batch-start" ${plan.hosts.length?'':'disabled'}>${fetchHosts.length?'开始':'应用'}</button><button class="button" data-action="icon-batch-cancel">取消</button></div></div>`);
 $('#icon-batch-overwrite')?.addEventListener('change',e=>{iconBatchOverwrite=e.target.checked;iconBatchDialog();});
 (plan.hosts.length?$('[data-action="icon-batch-start"]'):$('[data-action="icon-batch-cancel"]'))?.focus();
}
function iconBatchStart(){
 if(demoMode||!nativeStore||iconBatch)return;
 const plan=iconPlan(state.assets,{overwrite:iconBatchOverwrite}),cache=iconCache();
 iconBatch={plan,queue:plan.hosts.filter(h=>!cache.has(h.host)),pending:new Map(),done:[],failed:[],icons:new Map([...cache].filter(([host])=>plan.hosts.some(h=>h.host===host)))};
 iconBatch.total=iconBatch.queue.length;
 const dialog=$('#modal');dialog.addEventListener('close',iconBatchAbort,{once:true});
 $('#icon-batch').innerHTML=`<p class="form-note" id="icon-batch-status" aria-live="polite"></p><progress id="icon-batch-progress" max="${Math.max(1,iconBatch.total)}" value="0"></progress><div class="confirm-actions"><button class="button" data-action="icon-batch-cancel">停止</button></div>`;
 iconBatchPump();
}
function iconBatchPump(){
 const run=iconBatch;if(!run)return;
 while(run.pending.size<ICON_BATCH_LIMIT&&run.queue.length){
  const h=run.queue.shift(),requestId=++iconRequest;
  run.pending.set(requestId,{host:h,timer:setTimeout(()=>iconBatchReply({requestId,ok:false,error:'超时'}),ICON_BATCH_TIMEOUT)});
  window.webkit.messageHandlers.assetboard.postMessage({action:'iconFetch',requestId,host:h.host});
 }
 const finished=run.done.length+run.failed.length;
 if($('#icon-batch-status'))$('#icon-batch-status').textContent=run.total?`${formatCount(finished)} / ${formatCount(run.total)}`:'应用中…';
 if($('#icon-batch-progress'))$('#icon-batch-progress').value=finished;
 if(!run.pending.size&&!run.queue.length)iconBatchFinish();
}
function iconBatchReply(result){
 const run=iconBatch,entry=run?.pending.get(result?.requestId);if(!entry)return;
 clearTimeout(entry.timer);run.pending.delete(result.requestId);
 const src=result.ok&&siteIconSrc({siteIcon:result.dataUrl});
 if(src){run.icons.set(entry.host.host,src);run.done.push(entry.host);}
 else{const error=String(result.error||'');run.failed.push({...entry.host,reason:error==='超时'?'超时，没有回应':/无法连接/.test(error)?'连不上（站点拒绝自动访问或网络不通）':/没有在/.test(error)?'官网没有可下载的图标':error||'没有获取到可用的图标'});}
 iconBatchPump();
}
function iconBatchAbort(){const run=iconBatch;if(!run||run.finished)return;for(const {timer} of run.pending.values())clearTimeout(timer);iconBatch=null;toast('已停止，资产未改动');}
function iconBatchFinish(){
 const run=iconBatch;run.finished=true;iconBatch=null;
 let changed=0;const touched=[];
 for(const h of run.plan.hosts){const src=run.icons.get(h.host);if(!src)continue;for(const id of h.ids){const a=state.assets.find(x=>x.id===id);if(a&&!(a.siteIcon&&!iconBatchOverwrite)&&a.siteIcon!==src){touched.push([a,src,h.host]);}}}
 if(touched.length){checkpoint();for(const [a,src,host] of touched){a.siteIcon=src;a.siteIconHost=host;changed++;}save();}
 const failedAssets=run.failed.reduce((n,h)=>n+h.ids.length,0);
 if($('#icon-batch'))$('#icon-batch').innerHTML=`<div id="icon-batch-done"><p class="icon-batch-lead"><strong>${formatCount(changed)}</strong> 项已更新${run.total?`<span class="chip">${formatCount(run.done.length)}/${formatCount(run.total)} 个平台</span>`:''}</p>${run.failed.length?`<p class="form-note">${formatCount(run.failed.length)} 个平台没有拿到图标，${formatCount(failedAssets)} 项保留类别图标</p><ul class="icon-batch-hosts failed">${run.failed.map(h=>`<li><strong>${esc(h.host)}</strong><span>${esc(h.reason)}</span></li>`).join('')}</ul>`:''}<div class="confirm-actions"><button class="button primary" data-action="icon-batch-cancel">完成</button></div></div>`;
 $('#icon-batch-done [data-action="icon-batch-cancel"]')?.focus();
 render();if(activeAsset)showDetail(activeAsset);
 if(changed)toast(`${formatCount(changed)} 项已配上图标`,true);
}
// Real icons are drawn on the neutral tile; a dark mark on transparency gets a light backing in dark mode, a light mark a dark one in light mode.
const markTones=new Map();
function markTone(src){
 if(markTones.has(src))return markTones.get(src);
 markTones.set(src,'');const img=new Image();
 img.onload=()=>{try{const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,32,32);const d=g.getImageData(0,0,32,32).data;let opaque=0,lum=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>128){opaque++;lum+=(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2])/255;}
  const mean=opaque?lum/opaque:0,clear=opaque<1024*.9;markTones.set(src,clear&&opaque&&mean<.3?'mark-dark':clear&&opaque&&mean>.85?'mark-light':'');}catch{markTones.set(src,'');}
  refreshMarkTones();};
 img.src=src;return '';
}
function refreshMarkTones(){document.querySelectorAll('.tile.custom-art img,.site-mark').forEach(img=>{const tone=markTones.get(img.getAttribute('src'));if(tone===undefined)return;const host=img.classList.contains('site-mark')?img:img.parentElement;host.classList.toggle('mark-dark',tone==='mark-dark');host.classList.toggle('mark-light',tone==='mark-light');});}
function closeDetail(){$('#detail').hidden=true;activeAsset=null;markSelected();if(lastFocus?.isConnected)lastFocus.focus();}
function modal(title,html,view=''){$('#modal-title').textContent=title;$('#modal-content').innerHTML=html;$('#modal').dataset.view=view;if(!html.includes('id="asset-form"')&&!html.includes("id='asset-form'")&&!html.includes('id="dirty-save"'))assetFormSnapshot=null;if(nativeStore)$('#modal-content').querySelectorAll('.form-note').forEach(el=>{if(el.textContent.includes('浏览器'))el.textContent=el.textContent.replaceAll('当前浏览器','此 Mac').replaceAll('此浏览器','此 Mac');});if(!$('#modal').open)$('#modal').showModal();}
// The + adds an asset: straight into the category on screen, otherwise through the category chooser.
function addAsset(){const v=currentView();if(cats[v]&&!query)assetForm(v);else manualImport();}
let importPlan=null,importKind=null;
function importHub(){
 const deleted=(state.deletedExternalIds||[]).length;
 const native=!!nativeStore;
 const cli=window.__localCli||{};
 const ghAccounts=cli.ghAccounts||[];
 const tags=ghAccounts.map(n=>`<span class="account-tag">${esc(n)}</span>`).join('');
 const cliTitle='本机已登录：只调用 gh 等命令读公开元数据，不读它们自存的凭据；SSH 只读 Host、HostName、User、Port';
 const ghButton=cli.gh?`<button class="button primary" data-action="github-local-sync" title="用本机 gh 同步仓库${ghAccounts.length?'：'+esc(ghAccounts.join('、')):''}">${ui('github')}gh${tags}</button>`:`<button class="button" data-action="github-import" title="gh 不可用，改用 GitHub 令牌">${ui('github')}令牌</button>`;
 const sshButton=cli.sshConfig?`<button class="button primary" data-action="ssh-import" title="从 ~/.ssh/config 读取服务器">${ui('terminal')}~/.ssh/config</button>`:'';
 const cliRow=native?`<div class="import-cli" title="${esc(cliTitle)}">${ghButton}${sshButton}<button class="icon-button" data-action="local-cli-refresh" title="重新检测" aria-label="重新检测本机 gh 和 SSH 配置">${ui('refresh')}</button></div>`:'';
 const chip=name=>`<span class="fmt">${name}</span>`;
 const source=(action,glyph,label,title)=>`<button class="button source" data-action="${action}" title="${esc(title||label)}">${ui(glyph)}${label}</button>`;
 modal('导入',`<div class="form import-hub">
  <div class="import-drop" id="import-drop" tabindex="0" role="button" aria-label="拖入或点击选择文件，也可 ⌘V 粘贴" title="无冲突直接写入，⌘Z 整批撤销；表格最多 ${IMPORT_ROW_LIMIT} 行，同名跳过，疑似密钥列丢弃"><span class="drop-mark" aria-hidden="true">${ui('download')}</span><strong>拖入或粘贴</strong><span class="fmts">${chip('CSV')}${chip('JSON')}${chip('EML')}${native?chip('图片')+chip('PDF'):''}</span><input id="import-file" type="file" accept=".csv,.tsv,.json,.eml,text/csv,application/json,message/rfc822${native?',image/png,image/jpeg,image/webp,application/pdf':''}" hidden multiple></div>
  ${cliRow}
  <div class="import-actions">
   ${source('import-pick-file','file','文件','选择文件')}
   ${source('manual-import','plus','手动')}
   ${source('inbox','mail','通知','粘贴续费通知')}
   ${native?source('cloudflare-import','cloud','Cloudflare')+source('gmail-import','mail','Gmail')+source('ocr-import','image','截图','选择截图或 PDF'):''}
   ${demoMode?`<button class="button primary" data-action="import-demo-sample">试用示例</button>`:''}
  </div>
  ${deleted?`<details class="import-deleted"><summary>已删除的同步项 · ${formatCount(deleted)}</summary><p class="form-note">再次导入会跳过，预览里勾选可恢复。</p><ul class="import-deleted-list">${(state.deletedExternalIds||[]).slice(0,40).map(key=>`<li><code>${esc(key)}</code></li>`).join('')}${(state.deletedExternalIds||[]).length>40?`<li>…共 ${state.deletedExternalIds.length} 项</li>`:''}</ul></details>`:''}
 </div>`,'import');
 $('#import-drop')?.addEventListener('click',()=>$('#import-file')?.click());
 $('#import-drop')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#import-file')?.click();}});
 $('#import-file')?.addEventListener('change',e=>{const files=[...e.target.files||[]];e.target.value='';if(files.length)handleImportFiles(files);});
 if(native&&!demoMode)requestLocalCliDetect();
}
function importPreviewHtml(plan,meta={}){
 const group=(tone,title,rows,render,hint='')=>rows.length?`<section class="import-group ${tone}"><h3><i class="dot" aria-hidden="true"></i>${title}<b class="count">${rows.length}</b>${hint?`<span class="hint">${hint}</span>`:''}</h3><div class="import-rows">${rows.map(render).join('')}</div></section>`:'';
 const name=row=>esc(row.item?.name||row.name||'未命名');
 const type=row=>`<span class="chip">${esc(cats[row.item?.type||row.type]?.name||row.item?.type||'')}</span>`;
 const notes=[
  meta.note&&`<span class="chip">${ui('file')}${esc(meta.note)}</span>`,
  meta.preset&&`<span class="chip">${esc(meta.preset.label)}</span>`,
  meta.truncated&&`<span class="chip warn" title="表格一次最多读 ${IMPORT_ROW_LIMIT} 行">${ui('warn')}前 ${IMPORT_ROW_LIMIT} / ${meta.totalRows} 行</span>`,
  meta.droppedSecrets?.length&&`<span class="chip warn" title="疑似密钥的列不会导入">${ui('lock')}已丢弃密钥列：${esc(meta.droppedSecrets.join('、'))}</span>`
 ].filter(Boolean).join('');
 return `<div class="form import-preview" id="import-preview">
  ${notes?`<div class="chips import-notes">${notes}</div>`:''}
  ${group('add','新增',plan.added||[],row=>`<div class="import-row"><strong>${name(row)}</strong>${type(row)}</div>`)}
  ${group('update','更新',plan.updated||[],row=>`<div class="import-row"><strong>${name(row)}</strong>${type(row)}</div>`)}
  ${group('hold','同名',[...(plan.collisions||[]),...(plan.skippedSame||[])],(row,i)=>`<label class="check-label import-row"><input type="checkbox" name="import-same" value="${esc(row.assetId)}"><strong>${name(row)}</strong>${type(row)}</label>`,'默认跳过，勾选则覆盖')}
  ${group('hold','已删除',plan.skippedDeleted||[],row=>`<label class="check-label import-row"><input type="checkbox" name="import-restore" value="${esc(row.key)}"><strong>${name(row)}</strong>${type(row)}</label>`,'默认跳过，勾选则恢复')}
  ${group('quiet','已隐藏',plan.hidden||[],row=>`<div class="import-row"><strong>${name(row)}</strong>${type(row)}</div>`,'更新后仍隐藏')}
  ${group('bad','没读懂',meta.unreadable||[],row=>`<div class="import-row"><strong>${esc(row.reason||'无法识别')}</strong>${row.line?`<span class="chip">第 ${row.line} 行</span>`:''}</div>`)}
  <div class="confirm-actions"><button class="button primary" data-action="import-apply">导入</button><button class="button" data-action="import-hub" title="返回导入" aria-label="返回导入">${ui('back')}</button></div>
 </div>`;
}
function commitImportPlan(plan,meta={},opts={}){
 const restoreKeys=opts.restoreKeys||[];
 const applySame=opts.applySame||[];
 const applyCollisions=opts.applyCollisions||[];
 const beforeCount=state.assets.length;
 checkpoint();
 if(importKind==='json')state=applyBoardBackup(state,plan,{restoreKeys});
 else state=applyImport(state,plan,{restoreKeys,applySame,applyCollisions});
 if(!Array.isArray(state.deletedExternalIds))state.deletedExternalIds=[];
 save();render();
 const added=state.assets.length-beforeCount;
 const updated=(plan.updated||[]).length+(plan.hidden||[]).length+applySame.length+applyCollisions.length;
 const skipped=(plan.skippedSame||[]).length;const parts=[added?`新增 ${added}`:'',updated?`更新 ${updated}`:'',restoreKeys.length?`恢复 ${restoreKeys.length}`:'',skipped?`跳过 ${skipped}`:''].filter(Boolean);
 $('#modal').close();
 toast(parts.length?parts.join(' · '):'没有写入新内容',true);
 importPlan=null;importKind=null;
}
function runImportPlan(plan,meta={}){
 importPlan=plan;
 const skipped=plan.skippedSame?.length||0;const needsPreview=!!(plan.conflicts||(meta.unreadable||[]).length||meta.truncated||plan.mode==='replace');
 
 if(!needsPreview){
  const empty=!(plan.added||[]).length&&!(plan.updated||[]).length&&!(plan.hidden||[]).length;
  if(empty){toast(skipped?`同名全部跳过（${skipped}）`:meta.unreadable?.length?'没有可导入的行':'没有可导入的内容');return;}
  commitImportPlan(plan,meta);
  return;
 }
 modal('导入预览',importPreviewHtml(plan,meta),'import-preview');
}
function importCsvText(text,{filename=''}={}){
 const parsed=parseDelimitedText(text);
 if(!parsed.ok){toast(parsed.error||'无法解析表格');return;}
 const {items,unreadable,preset,droppedSecrets,truncated,totalRows}=rowsToImportItems(parsed,{types:Object.keys(cats)});
 const plan=planImport(state,items,{sameName:'skip'});
 if(unreadable.length)plan.conflicts=true;
 runImportPlan(plan,{unreadable,preset,droppedSecrets,truncated,totalRows,note:filename});
}
function importJsonText(text,{filename='',mode}={}){
 const backup=parseBoardBackup(text);
 if(!backup.ok){toast(backup.error||'无法读取备份');return;}
 const chosen=mode||'merge';
 const plan=planBoardBackup(state,backup,{mode:chosen});
 if(!plan.ok){toast(plan.error||'无法合并备份');return;}
 if(chosen==='merge'&&!plan.conflicts&&!(plan.added||[]).length&&!(plan.updated||[]).length&&!(plan.hidden||[]).length){
  // Offer replace when merge would change nothing meaningful but user dropped a backup — still show preview with mode choice.
 }
 importKind='json';
 const modeNote=chosen==='replace'?'整体替换':'合并';
 const extra=chosen==='merge'?`<label class="check-label"><input type="checkbox" id="import-replace">替换整个资产板（可撤销）</label>`:'';
 runImportPlan(plan,{note:`${filename?filename+' · ':''}${modeNote}`,unreadable:[]});
 // If preview opened, inject replace checkbox
 if($('#import-preview')&&chosen==='merge'){
  const actions=$('#import-preview .confirm-actions');
  if(actions&&!$('#import-replace'))actions.insertAdjacentHTML('beforebegin',extra);
 }
}
function importEmlText(raw,{filename=''}={}){
 const parsed=parseEml(raw);
 if(!parsed.ok){toast(parsed.error||'无法解析邮件');return;}
 pasteRow={id:'eml-'+Date.now(),kind:'paste',source:parsed.from||'',title:(parsed.subject||filename||'邮件').slice(0,80),body:`From: ${parsed.from}\nSubject: ${parsed.subject}\nDate: ${parsed.date}\n\n${parsed.body}`,importedAt:new Date().toISOString()};
 pasteRecorded=new Set();candidateReview(buildPasteCandidate());
 
}
function requestLocalCliDetect(){
 if(!nativeStore||demoMode){window.__localCli={gh:false,ghAccounts:[],sshConfig:false};return;}
 window.webkit.messageHandlers.assetboard.postMessage({action:'localCliDetect'});
}
window.assetboardLocalCliDetect=info=>{window.__localCli=info||{};if($('#modal')?.open&&$('#modal').dataset.view==='import')importHub();};
window.assetboardSshResult=result=>{
 if(!result.ok){
  const steps=(result.nextSteps||[]).map(s=>esc(s)).join('；');
  toast(result.error+(steps?' · '+steps:''));
  return;
 }
 const hosts=parseSshConfig(result.text||'');
 if(!hosts.length){toast('~/.ssh/config 里没有 Host');return;}
 // Convert to planImport-compatible items via mergeSshConfig under checkpoint path similar to platform sync
 checkpoint();
 const merge=mergeSshConfig(state,hosts);
 state=merge.board;save();render();
 $('#modal')?.close();
 toast(`SSH：读 ${merge.read}，新增 ${merge.added}`,true);
 syncFollowUp('SSH',merge,[]);
};

function routeImportText(text,{filename='',mime=''}={}){
 const classified=classifyImportPayload({text,filename,mime});
 if(classified.kind==='csv'){importKind='csv';importCsvText(classified.text||text,{filename});return;}
 if(classified.kind==='json'){importKind='json';importJsonText(classified.text||text,{filename});return;}
 if(classified.kind==='eml'){importEmlText(classified.text||text,{filename});return;}
 if(classified.kind==='paste'){
  pasteRow={id:'paste-'+Date.now(),kind:'paste',source:'',title:String(text).split('\n')[0].slice(0,60),body:String(text),importedAt:new Date().toISOString()};
  pasteRecorded=new Set();candidateReview(buildPasteCandidate());return;
 }
 if(classified.kind==='empty'){toast('没有可导入的内容');return;}
 toast('无法识别这份内容');
}
async function handleImportFiles(files){
 const list=[...files].slice(0,20);
 const images=[],docs=[];
 for(const file of list){
  const classified=classifyImportPayload({filename:file.name,mime:file.type});
  if(classified.kind==='image'||classified.kind==='pdf')images.push(file);
  else docs.push(file);
 }
 if(images.length){
  if(!nativeStore){toast('截图和 PDF 只在 Mac App 里可用');}
  else if(demoMode){toast('演示模式不读本机文件，可试用示例');}
  else{
   for(const file of images.slice(0,5)){
    const buffer=await file.arrayBuffer();
    const bytes=new Uint8Array(buffer);
    let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
    window.webkit.messageHandlers.assetboard.postMessage({action:'ocrImportData',name:file.name,base64:btoa(binary)});
   }
  }
 }
 // One CSV/JSON at a time; multiple .eml ok (each opens review sequentially — last wins UI, all become paste candidates one by one)
 const tables=docs.filter(f=>!/\.eml$/i.test(f.name)&&f.type!=='message/rfc822');
 const mails=docs.filter(f=>/\.eml$/i.test(f.name)||f.type==='message/rfc822');
 for(const file of mails.slice(0,10)){
  const text=await file.text();
  routeImportText(text,{filename:file.name,mime:file.type||'message/rfc822'});
 }
 if(tables[0]){
  const text=await tables[0].text();
  routeImportText(text,{filename:tables[0].name,mime:tables[0].type});
 }
}
function typingTarget(el){return !!el&&(el.closest?.('input,textarea,select,[contenteditable="true"]')||['INPUT','TEXTAREA','SELECT'].includes(el.tagName));}
function installImportDropPaste(){
 let dragDepth=0;
 const board=document.documentElement;
 board.addEventListener('dragenter',e=>{if(!e.dataTransfer?.types?.includes('Files'))return;e.preventDefault();dragDepth++;document.body.classList.add('import-drag');});
 board.addEventListener('dragover',e=>{if(!e.dataTransfer?.types?.includes('Files'))return;e.preventDefault();e.dataTransfer.dropEffect='copy';});
 board.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)document.body.classList.remove('import-drag');});
 board.addEventListener('drop',e=>{
  dragDepth=0;document.body.classList.remove('import-drag');
  if(typingTarget(e.target))return;
  const files=[...e.dataTransfer?.files||[]];
  if(files.length){e.preventDefault();handleImportFiles(files);return;}
  const text=e.dataTransfer?.getData('text/plain');
  if(text&&text.trim()){e.preventDefault();routeImportText(text);}
 });
 document.addEventListener('paste',e=>{
  if(typingTarget(e.target)||$('#modal')?.open)return;
  const items=[...e.clipboardData?.items||[]];
  const fileItems=items.filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter(Boolean);
  if(fileItems.length){e.preventDefault();handleImportFiles(fileItems);return;}
  const text=e.clipboardData?.getData('text/plain');
  if(text&&text.trim()){e.preventDefault();routeImportText(text);}
 });
}
function manualImport(){modal('选择资产类别',Object.entries(cats).map(([id,c])=>`<button class="category-choice" data-action="choose-asset-type" data-id="${id}"><span class="tile type-art" aria-hidden="true">${icon(id)}</span><span>${c.name}${c.hint?`<small>${c.hint}</small>`:''}</span><span class="plus">＋</span></button>`).join(''));}

function snapshotAssetForm(form){if(!form)return null;const data=new FormData(form);const values={};for(const [k,v] of data.entries()){if(k==='icon')continue;values[k]=String(v);}return {id:form.dataset.id||'',type:form.dataset.type||'',values,hadFile:false};}
function isAssetFormDirty(){const form=$('#asset-form');if(!form||!assetFormSnapshot)return false;if(form.elements.icon?.files?.length)return true;const data=new FormData(form);for(const key of Object.keys(assetFormSnapshot.values)){if(String(data.get(key)??'')!==assetFormSnapshot.values[key])return true;}for(const [k] of data.entries()){if(k==='icon'||k==='removeIcon')continue;if(!(k in assetFormSnapshot.values)&&String(data.get(k)??''))return true;}if(form.elements.removeIcon?.checked)return true;return false;}
function requestCloseModal(){if(isAssetFormDirty()){const resumeTitle=$('#modal-title').textContent,resumeView=$('#modal').dataset.view,live=[...$('#modal-content').childNodes],baseline=assetFormSnapshot;modal('未保存的修改',`<p class="form-note">表单有未保存的内容。可以保存、放弃修改，或继续编辑。</p><div class="dirty-actions"><button class="button primary" id="dirty-save">保存</button><button class="button" id="dirty-discard">放弃</button><button class="button" id="dirty-keep">继续编辑</button></div>`);const resume=()=>{$('#modal-title').textContent=resumeTitle;$('#modal').dataset.view=resumeView;$('#modal-content').replaceChildren(...live);assetFormSnapshot=baseline;};$('#dirty-save').onclick=()=>{resume();$('#asset-form').requestSubmit();};$('#dirty-discard').onclick=()=>{assetFormSnapshot=null;$('#modal').close();};$('#dirty-keep').onclick=resume;return;}assetFormSnapshot=null;$('#modal').close();}
function assetForm(type,id,fill={},candidateKey='',candidateItem=null){const a=id?state.assets.find(a=>a.id===id):null,v={...(a||{}),...fill},link=safeManagementUrl(v.url),synced=['cloudflare','github'].includes(a?.source),kind=dateKinds[v.dateKind]?v.dateKind:'expire';modal(a?'编辑资产资料':`添加${cats[type].name}资产`,`<form id="asset-form" class="form" data-type="${type}" data-id="${id||''}" data-candidate="${esc(candidateKey)}" data-item="${candidateItem??''}"><label>资产名称<input name="name" required maxlength="100" value="${esc(v.name||'')}" placeholder="${assetProfiles[type]?.name||'例如 my-project.dev'}"></label>${synced?'':`<label>类别<select name="type">${Object.entries(cats).map(([key,c])=>`<option value="${key}" ${key===type?'selected':''}>${c.name}</option>`).join('')}</select></label>`}<div id="profile-fields" class="profile-fields">${profileFields(type,v)}</div><label>用途<input name="purpose" maxlength="100" value="${esc(v.purpose||'')}" placeholder="它用来做什么？"></label><label>保留原因<input name="reason" maxlength="120" value="${esc(v.reason||'')}" placeholder="为什么还留着"></label><label>费用说明<input name="cost" maxlength="80" value="${esc(v.cost==='未知'?'':v.cost||'')}" placeholder="例如 ¥ 89 / 年"></label><label>管理链接<input name="url" type="url" maxlength="2000" value="${esc(link&&new URL(link).hostname!=='example.com'?link:'')}" placeholder="https://..." pattern="https?://.*"></label><label title="PNG、JPEG 或 WebP，最大 256 KB">自定义图标<input name="icon" type="file" accept="image/png,image/jpeg,image/webp"></label>${a?.iconData?'<label class="check-label"><input name="removeIcon" type="checkbox">移除当前自定义图标</label>':''}<label>备注<textarea name="notes" rows="3" maxlength="2000">${esc(v.notes||'')}</textarea></label><button class="button primary" type="submit">${a?'保存修改':'添加资产'}</button><span class="form-note">仅存于${nativeStore?'此 Mac':'此浏览器'}</span></form>`);const form=$('#asset-form');assetFormSnapshot=snapshotAssetForm(form);
 form.elements.type?.addEventListener('change',e=>{const values=Object.fromEntries(new FormData(form));if('expiry' in values)values.date=cardExpiry(values.expiry)||'';form.dataset.type=e.target.value;$('#profile-fields').innerHTML=profileFields(e.target.value,values);form.elements.name.placeholder=assetProfiles[e.target.value]?.name||'例如 my-project.dev';});
 form.addEventListener('input',e=>{if(e.target.name!=='phone')return;const region=form.elements.region,code=regionFromPhone(e.target.value);if(region&&code&&!region.value)region.value=code;});
}
// Fields that depend on the category; rebuilt in place when the category select changes.
function profileFields(type,v){
 const p=assetProfiles[type]||{},extra=p.extra||[],kind=dateKinds[v.dateKind]?v.dateKind:p.dateKind||'expire',cycle=v.cycle??p.cycle??'';
 const provider=p.fixedProvider?'':`<label>${p.provider?.[0]||'平台'}<input name="provider" maxlength="80" value="${esc(v.provider==='平台待补充'?'':v.provider||'')}" placeholder="${p.provider?.[1]||'例如 Cloudflare'}"></label>`;
 const account=`<label>${p.account?.[0]||'账号'}<input name="account" maxlength="100" autocomplete="off" value="${esc(v.account||'')}" placeholder="${p.account?.[1]||'用于区分同平台的账号'}"></label>`;
 const region=extra.includes('region')?`<label>国家 / 地区<select name="region"><option value="">未设置</option>${regionList.map(([code,name])=>`<option value="${code}" ${code===v.region?'selected':''}>${regionFlag(code)} ${name}</option>`).join('')}</select></label>`:'';
 const phone=extra.includes('phone')?`<label>完整号码<input name="phone" type="tel" inputmode="tel" maxlength="30" autocomplete="off" value="${esc(v.phone||'')}" placeholder="+44 7700 900123"></label><span class="form-note">卡片只显示区号和后 4 位</span>`:'';
 const card=extra.includes('last4')?`<div class="field-row"><label>卡号后 4 位<input name="last4" inputmode="numeric" pattern="\\d{4}" maxlength="4" autocomplete="off" value="${esc(v.last4||'')}" placeholder="1234"></label><label>卡组织<select name="network"><option value="">未设置</option>${cardNetworks.map(network=>`<option ${network===v.network?'selected':''}>${network}</option>`).join('')}</select></label><label>有效期<input name="expiry" maxlength="7" autocomplete="off" placeholder="MM/YY" pattern="\\s*(0?[1-9]|1[0-2])\\s*/\\s*(\\d{2}|\\d{4})\\s*" value="${esc(expiryText(v.date))}"></label></div>`:'';
 const dates=type==='bankcard'?'':`<div class="field-row"><label>${p.date||'下一日期'}<input type="date" name="date" value="${esc(v.date||'')}"></label><label>日期类型<select name="dateKind">${Object.entries(dateKinds).map(([key,k])=>`<option value="${key}" ${key===kind?'selected':''}>${k.label}</option>`).join('')}</select></label><label title="日期过去后自动顺延到下一次">重复<select name="cycle"><option value="">不重复</option>${Object.entries(billingCycles).map(([key,c])=>`<option value="${key}" ${key===cycle?'selected':''}>${c.label}</option>`).join('')}</select></label></div>`;
 const actions=(ACTION_FIELDS[type]||[]).filter(([key])=>key!=='localPath'||nativeStore).map(([key,label,hint])=>`<label>${label}<input name="${key}" maxlength="${key==='localPath'?1000:253}" autocomplete="off" spellcheck="false" ${key==='sshPort'?'inputmode="numeric"':''} value="${esc(Array.isArray(v[key])?v[key].join(', '):v[key]||'')}" placeholder="${hint}"></label>`).join('');
 return provider+account+region+phone+card+dates+(actions?`<div class="field-row action-fields">${actions}</div>`:'')+(p.note?`<span class="form-note form-warning">${p.note}</span>`:'');
}
function cloudflareDialog(){
 if(!nativeStore){toast('Cloudflare 仅 Mac App 可用');return;}
 const connected=nativeStore.cloudflareConnected;
 const tokenUrl=cloudflareTokenTemplateUrl({name:'Assetboard'});
 const status=connected?'已连接':nativeStore.cloudflareChecking?'检查钥匙串…':nativeStore.keychainUnavailable?'钥匙串没有响应，可重新输入令牌':'未连接';
 modal('Cloudflare',`<div class="form"><div class="platform-bar"><span id="cloudflare-status" class="chip ${connected?'ok':''}">${status}</span><button class="button" data-action="setup-cloudflare" data-url="${esc(tokenUrl)}" title="打开预填只读权限的建令牌页：Zone、Account Settings、Pages、Workers Scripts、R2 Read；含 Registrar 读权限时还会读域名到期日">建令牌 ↗</button></div><label>${connected?'更换令牌':'令牌'}<input id="cloudflare-token" type="password" autocomplete="off" spellcheck="false" placeholder="${connected?'留空使用已保存的令牌':'粘贴只读令牌'}"></label><div class="confirm-actions"><button id="cloudflare-sync" class="button primary">${connected?'重新同步':'验证并同步'}</button>${connected?'<button id="cloudflare-disconnect" class="button" title="删除本机保存的令牌；Cloudflare 后台的令牌需自行撤销，已同步资产保留">断开</button>':''}</div><p class="form-note platform-note">${ui('lock')}只读；令牌存入 macOS 钥匙串</p></div>`);
 $('#cloudflare-sync').onclick=()=>{const token=$('#cloudflare-token').value;$('#cloudflare-token').value='';$('#cloudflare-sync').disabled=true;$('#cloudflare-status').textContent='验证中…';window.webkit.messageHandlers.assetboard.postMessage({action:'cloudflareSync',token});};
 if(connected)$('#cloudflare-disconnect').onclick=()=>window.webkit.messageHandlers.assetboard.postMessage({action:'cloudflareDisconnect'});
}
window.assetboardCloudflareResult=result=>{
 if(!result.ok){const status=$('#cloudflare-status');if(status)status.textContent=result.error||'同步失败';status.classList.add('bad');const button=$('#cloudflare-sync');if(button)button.disabled=false;return;}
 if(result.disconnected){nativeStore.cloudflareConnected=false;cloudflareDialog();toast('已删除令牌');return;}
 checkpoint();const merge=mergeCloudflare(state,result);state=merge.board;
 nativeStore.cloudflareConnected=true;save();render();$('#modal').close();toast(`Cloudflare：读 ${merge.read}，新增 ${merge.added}`,true);
 syncFollowUp('Cloudflare',merge,result.warnings||[]);
};
function githubDialog(){
 if(!nativeStore){toast('GitHub 仅 Mac App 可用');return;}
 const connected=nativeStore.githubConnected;
 const cli=window.__localCli||{};
 const accounts=cli.ghAccounts||[];
 const tags=accounts.map(n=>`<span class="account-tag">${esc(n)}</span>`).join('');
 const status=connected?'已连接':cli.gh===false?'未检测到 gh':'未连接';
 modal('GitHub',`<div class="form"><div class="platform-bar"><span id="github-status" class="chip ${connected?'ok':''}">${status}</span><button class="button" data-action="setup-github-token" title="打开 GitHub 细粒度令牌页：Metadata → Read">建令牌 ↗</button></div><button id="github-local-sync" class="button primary" data-action="github-local-sync" title="只调用 gh 命令，不读它的凭据文件；多个账号的仓库显示在同一区块">${ui('github')}用本机 gh${tags}</button><label>${connected?'更换令牌':'或填写令牌'}<input id="github-token" type="password" autocomplete="off" spellcheck="false" placeholder="${connected?'留空使用已保存的令牌':'粘贴只读令牌'}"></label><div class="confirm-actions"><button id="github-sync" class="button">${connected?'用已保存的令牌同步':'验证并同步'}</button>${connected?'<button id="github-disconnect" class="button" title="删除 Assetboard 保存的令牌，已同步资产保留">断开</button>':''}</div><p class="form-note platform-note">${ui('lock')}只读；令牌存入 macOS 钥匙串</p></div>`);
 if(!cli.gh&&cli.gh!==false)requestLocalCliDetect();
 $('#github-sync').onclick=()=>{const token=$('#github-token').value;$('#github-token').value='';$('#github-sync').disabled=true;$('#github-status').textContent='验证中…';window.webkit.messageHandlers.assetboard.postMessage({action:'githubSync',token});};
 if(connected)$('#github-disconnect').onclick=()=>window.webkit.messageHandlers.assetboard.postMessage({action:'githubDisconnect'});
}
function gmailDialog(){
 if(!nativeStore){toast('Gmail 仅 Mac App 可用');return;}
 modal('Gmail',`<div class="form"><div class="platform-bar"><span id="gmail-status" class="chip ${nativeStore.gmailConfigured?'ok':''}">${nativeStore.gmailConfigured?'已配置':'未配置'}</span><button class="button" data-action="setup-gmail" title="在 Google Cloud 启用 Gmail API，创建「桌面应用」OAuth 客户端并下载 JSON">获取 OAuth 客户端 ↗</button></div><div class="confirm-actions"><button id="gmail-sync" class="button primary">${nativeStore.gmailConfigured?'重新导入':'选择 JSON 并授权'}</button>${nativeStore.gmailConfigured?'<button id="gmail-reconfigure" class="button">更换 JSON</button>':''}</div><p class="form-note platform-note" title="关键词：invoice、receipt、billing、renewal、subscription、payment、账单、续费、订阅、服务通知；最近 14 个月，最多 2000 封，超出本次不写入">${ui('lock')}只读邮箱；只搜账单和续费类邮件，结果存在此 Mac，不发送或修改邮件</p></div>`);
 $('#gmail-sync').onclick=()=>{$('#gmail-sync').disabled=true;$('#gmail-status').textContent='读取中…';window.webkit.messageHandlers.assetboard.postMessage({action:'gmailSync'});};
 if(nativeStore.gmailConfigured)$('#gmail-reconfigure').onclick=()=>{window.webkit.messageHandlers.assetboard.postMessage({action:'gmailSync',configure:true});};
}
window.assetboardGmailResult=result=>{
 if(!result.ok){const status=$('#gmail-status');if(status)status.textContent=result.error||'导入失败';status.classList.add('bad');const button=$('#gmail-sync');if(button)button.disabled=false;return;}
 nativeStore.gmailConfigured=true;$('#modal').close();toast(`Gmail：${result.count} 封`);requestEvidence(()=>inboxDialog(false));
};
window.assetboardGitHubResult=result=>{
 if(!result.ok){
  const status=$('#github-status');
  const steps=(result.nextSteps||[]).join(' · ');
  if(status){status.textContent=(result.error||'同步失败')+(steps?' · '+steps:'');status.classList.add('bad');}
  for(const id of ['#github-sync','#github-local-sync']){const button=$(id);if(button)button.disabled=false;}
  if(result.tokenUrl){
   const form=$('#modal-content .form');
   if(form&&!$('#github-fallback-link'))form.insertAdjacentHTML('beforeend',`<button class="button" id="github-fallback-link" data-action="setup-github-token">建令牌 ↗</button>`);
  }
  return;
 }
 if(result.disconnected){nativeStore.githubConnected=false;githubDialog();toast('已删除令牌');return;}
 checkpoint();const merge=mergeGitHub(state,result);state=merge.board;
 nativeStore.githubConnected=!!result.connected||nativeStore.githubConnected;save();render();$('#modal').close();
 const who=(result.accounts||[]).length?` ${result.accounts.join('、')}`:'';
 toast(`GitHub${who}：读 ${merge.read}，新增 ${merge.added}`,true);
 syncFollowUp('GitHub',merge,result.warnings||[]);
};
let pendingCollisions=[];
function syncFollowUp(source,merge,warnings){
 pendingCollisions=merge.collisions;if(!pendingCollisions.length&&!warnings.length)return;
 const warningHtml=warnings.length?`<p class="form-note">已读 ${merge.read} 项；以下未读取，已有记录不受影响：</p>${warnings.map(message=>`<p class="form-note">${esc(message)}</p>`).join('')}`:'';
 const collisionHtml=pendingCollisions.length?`<p class="form-note">与本地记录同名，无法确认是同一项。勾选的会被同步结果覆盖，不影响线上资源。</p><div class="collision-list">${pendingCollisions.map((item,index)=>`<label class="check-label"><input type="checkbox" name="collision" value="${index}">${esc(item.name)}</label>`).join('')}</div><div class="confirm-actions"><button class="button primary" data-action="apply-collisions">覆盖所选</button><button class="button" data-action="close-modal">保留本地记录</button></div>`:'';
 modal(pendingCollisions.length?`${source} · 同名记录`:`${source} · 部分未读取`,warningHtml+collisionHtml);
}
window.assetboardOCRResult=result=>{
 if(!result.ok){toast(result.error||'本地识别失败');return;}
 requestEvidence(()=>{const candidate=candidates().find(item=>item.ids.includes(result.id));if(!candidate){inboxDialog(false);return;}candidateReview(candidate);if(aiReady()&&nativeStore.ai.autoImages!==false&&!candidate.ai)aiRecognizeCandidate(candidate.key);});
};
// Imported evidence stays in SQLite; decisions about it live in the board so undo keeps both in step.
let evidenceRows=[],evidenceVersion=0,candidateCache={key:null,list:[]},afterEvidence=null,pasteCandidate=null,pasteRow=null,pasteRecorded=new Set();
const evidenceKinds={gmail:'Gmail',ocr:'截图/PDF',paste:'粘贴的文字'};
function candidateOptions(){return {assets:state.assets,decisions:state.evidenceDecisions||{},types:Object.keys(cats)};}
function candidates(){const decisions=state.evidenceDecisions||{},key=`${evidenceVersion}|${JSON.stringify(decisions)}|${state.assets.map(a=>a.id+'\u0001'+a.name).join('\u0002')}`;if(candidateCache.key!==key)candidateCache={key,list:buildCandidates(evidenceRows,candidateOptions())};return candidateCache.list;}
function pendingCount(){return candidates().filter(item=>item.pending&&!item.weak).length;}
function findCandidate(key){return key==='paste'?pasteCandidate:candidates().find(item=>item.key===key);}
function buildPasteCandidate(){pasteCandidate={...buildCandidates([pasteRow],{...candidateOptions(),decisions:{}})[0],key:'paste'};return pasteCandidate;}
function requestEvidence(then){afterEvidence=then||null;if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'evidenceList'});else{afterEvidence=null;then?.();}}
window.assetboardEvidenceList=(rows,error)=>{
 if(Array.isArray(rows)){evidenceRows=rows;evidenceVersion++;}else if(error)toast(error);
 syncToolbar();renderSidebar();const next=afterEvidence;afterEvidence=null;
 if(next)next();else if($('#modal').open&&$('#modal').dataset.view==='inbox')inboxDialog(false);
};
// A person's own model endpoint. Swift keeps the key and sends the request; the page only receives reply text.
const aiRequests=new Map(),aiBusy=new Set(),aiErrors=new Map();let aiSequence=0,aiBatchState=null;
const aiProviders={anthropic:{label:'Anthropic Claude',baseURL:'https://api.anthropic.com',model:'claude-opus-5-5'},openai:{label:'OpenAI 兼容接口（OpenAI、通义千问、Kimi、本机 Ollama 等）',baseURL:'',model:''}};
function aiLocal(host){return ['localhost','127.0.0.1','::1','[::1]'].includes(String(host||'').toLowerCase());}
function aiReady(){const ai=nativeStore?.ai;return !!(ai?.model&&(nativeStore.aiKeySaved||aiLocal(ai.host)));}
function aiRequest(params){return new Promise(resolve=>{const requestId=++aiSequence;aiRequests.set(requestId,resolve);window.webkit.messageHandlers.assetboard.postMessage({action:'aiRecognize',requestId,...params});});}
function aiDialog(){
 if(!nativeStore){toast('AI 识别仅 Mac App 可用');return;}
 const ai=nativeStore.ai||{},provider=ai.provider||'anthropic',preset=aiProviders[provider];
 modal('AI 识别',`<form class="form" id="ai-form"><p class="form-note platform-note">${ui('lock')}只在你点「用 AI 识别」时，把那份资料从此 Mac 直接发到下面的接口</p><label>服务类型<select name="provider">${Object.entries(aiProviders).map(([key,p])=>`<option value="${key}" ${key===provider?'selected':''}>${p.label}</option>`).join('')}</select></label><label>接口地址<input name="baseURL" required maxlength="300" value="${esc(ai.baseURL||preset.baseURL)}" placeholder="https://api.openai.com/v1"></label><label>模型<input name="model" required maxlength="120" value="${esc(ai.model||preset.model)}" placeholder="支持图片的模型名"></label><label>${nativeStore.aiKeySaved?'更换 API key':'API key'}<input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${nativeStore.aiKeySaved?'留空使用已保存的':'粘贴 API key'}"></label><label class="check-label"><input type="checkbox" name="autoImages" ${ai.autoImages===false?'':'checked'}>截图导入后自动用 AI 识别</label><p id="ai-status" class="form-note">${ai.model?`${esc(ai.model)} · ${esc(ai.host)}${nativeStore.aiKeySaved||aiLocal(ai.host)?'':' · 钥匙串里没有 API key'}`:'未配置'}</p><button class="button primary" type="submit">验证并保存</button>${ai.model?'<button class="button" type="button" data-action="ai-disconnect" title="删除 AI 设置和钥匙串里的 API key">删除设置</button>':''}<p class="form-note platform-note" title="保存前会发一条很短的测试请求；接口地址填本机服务（如 http://127.0.0.1:11434/v1）时可不填 key，资料不离开此 Mac">${ui('lock')}API key 存入 macOS 钥匙串，网页读不到</p></form>`,'ai');
 const form=$('#ai-form');let previous=provider;
 form.elements.provider.onchange=()=>{const from=aiProviders[previous],to=aiProviders[form.elements.provider.value];for(const name of ['baseURL','model'])if(!form.elements[name].value||form.elements[name].value===from[name])form.elements[name].value=to[name];previous=form.elements.provider.value;};
}
document.addEventListener('submit',e=>{if(e.target.id!=='ai-form')return;e.preventDefault();const form=e.target;form.querySelector('[type="submit"]').disabled=true;$('#ai-status').textContent='测试中…';window.webkit.messageHandlers.assetboard.postMessage({action:'aiSave',provider:form.elements.provider.value,baseURL:form.elements.baseURL.value,model:form.elements.model.value,apiKey:form.elements.apiKey.value,autoImages:form.elements.autoImages.checked});form.elements.apiKey.value='';});
window.assetboardAIResult=result=>{
 if(result.kind==='settings'){
  if(!result.ok){const status=$('#ai-status');if(status)status.textContent=result.error||'验证失败';const button=$('#ai-form [type="submit"]');if(button)button.disabled=false;return;}
  const closeSettings=()=>{if($('#modal').open&&$('#modal').dataset.view==='ai')$('#modal').close();};
  if(result.disconnected){nativeStore.ai=null;nativeStore.aiKeySaved=false;closeSettings();toast('已删除 AI 设置和 API key');return;}
  nativeStore.ai=result.ai;nativeStore.aiKeySaved=!!result.aiKeySaved;closeSettings();toast(`AI 已就绪 · ${result.ai.model}`);return;
 }
 if(result.ok&&result.evidenceId){const row=evidenceRows.find(item=>item.id===result.evidenceId);if(row){row.payload=JSON.stringify({...evidencePayload(row),ai:result.ai});evidenceVersion++;}}
 const resolve=aiRequests.get(result.requestId);aiRequests.delete(result.requestId);resolve?.(result);
};
async function aiRecognizeCandidate(key){
 const c=findCandidate(key);if(!c||aiBusy.has(key)||!aiReady())return;
 aiBusy.add(key);aiErrors.delete(key);refreshReview(key);
 const result=await aiRequest(key==='paste'?{text:pasteRow.body}:{evidenceId:c.latest.id});
 aiBusy.delete(key);
 if(!result.ok)aiErrors.set(key,result.error||'AI 识别失败');else if(key==='paste'){pasteRow.payload={ai:result.ai};pasteRecorded=new Set();buildPasteCandidate();}
 syncToolbar();refreshReview(key,0);
}
function aiProgressText(){return `${aiBatchState.done}/${aiBatchState.total}${aiBatchState.stop?' · 停止中':''}`;}
async function aiBatch(){
 if(!aiReady()||aiBatchState)return;
 const targets=candidates().filter(c=>c.pending&&!c.ai).slice(0,100);
 if(!targets.length){toast('都已识别过');return;}
 const ok=await confirmDialog(`AI 识别 ${targets.length} 组？`,`${targets.length} 组资料的邮件内容或截图会发送到 ${nativeStore.ai.host}，按你的账号计费。可随时停止。`,`识别 ${targets.length} 组`);
 if(!ok){inboxDialog(false);return;}
 aiBatchState={done:0,total:targets.length,stop:false};inboxDialog(false);
 let failure='';
 for(const c of targets){if(aiBatchState.stop)break;const result=await aiRequest({evidenceId:c.latest.id});if(!result.ok){failure=result.error||'AI 识别失败';break;}aiBatchState.done++;const progress=$('#ai-progress');if(progress)progress.textContent=aiProgressText();}
 const done=aiBatchState.done;aiBatchState=null;syncToolbar();
 if($('#modal').open&&$('#modal').dataset.view==='inbox')inboxDialog(false);
 toast(failure?`识别 ${done} 组后停止：${failure}`:`已识别 ${done} 组，请逐组核对`);
}
function recordedItems(c){return c.key==='paste'?[...pasteRecorded]:(state.evidenceDecisions||{})[c.ai?.rowId]?.recorded||[];}
function candidateView(c,index){const items=c.ai?.items||[];return index>0&&items[index]?applyAiItem(c.base,items[index],{assets:state.assets,fallback:false}):c;}
function aiSection(c,index){
 if(!nativeStore)return '';
 if(!aiReady())return '<p class="form-note ai-note"><button type="button" class="text-button inline-button" data-action="ai-settings" title="识别不准时，用你自己的 API key 配置 AI 识别">配置 AI 识别</button></p>';
 const items=c.ai?.items||[],recorded=recordedItems(c),busy=aiBusy.has(c.key),error=aiErrors.get(c.key);
 const sending=c.key==='paste'?'粘贴文字':c.latest.kind==='ocr'?'截图':'邮件内容';
 const status=c.ai?c.ai.unreadable?'AI 回复无法解析，显示本机识别结果':items.length?(items.length>1?`AI 找到 ${items.length} 项，选一项记录`:''):'AI 没有找到资产信息':'';
 const list=items.length>1?`<div class="ai-items">${items.map((item,i)=>{const view=candidateView(c,i);return `<label class="check-label ai-item"><input type="radio" name="ai-item" value="${i}" data-action="ai-item" data-id="${esc(c.key)}" ${i===index?'checked':''}><span>${esc(view.name||view.merchant)}${view.cost?` · ${esc(view.cost)}`:''}${view.date?` · ${esc(view.date.value)}`:''}${recorded.includes(i)?' · 已记录':''}</span></label>`;}).join('')}</div>`:'';
 return `<div class="ai-panel">${status?`<p class="form-note">${esc(status)}</p>`:''}${list}<button type="button" class="button" data-action="ai-recognize" data-id="${esc(c.key)}" ${busy?'disabled':''}>${busy?'识别中…':c.ai?'重新识别':'用 AI 识别'}</button><p class="form-note ai-send" title="${c.latest.kind==='ocr'&&c.key!=='paste'?'原文件不在时，发送识别出的文字':c.key==='paste'?'粘贴的文字':'发件人、标题和正文'}">${ui('lock')}发送${sending}到 ${esc(nativeStore.ai.host)}</p>${error?`<p class="form-note ai-error">${esc(error)}</p>`:''}</div>`;
}
function candidateChips(c){const match=c.match&&state.assets.find(a=>a.id===c.match);return [c.ai&&!c.ai.unreadable&&'<span class="chip ai">AI</span>',`<span class="chip">${esc(cats[c.type].name)}</span>`,c.cost&&`<span class="chip">${esc(c.cost)}</span>`,c.date&&`<span class="chip ${c.date.source}">${esc(c.date.value)} ${esc(dateKinds[c.date.kind].label)}${c.date.source==='inferred'?' · 推算':''}</span>`,match&&`<span class="chip match" title="可能对应已有资产">≈ ${esc(displayName(match))}</span>`,c.ai?.items.length>1&&`<span class="chip">${c.ai.items.length} 项</span>`].filter(Boolean).join('');}
function decisionLabel(c){const decision=(state.evidenceDecisions||{})[c.ids[0]],asset=decision?.assetId&&state.assets.find(a=>a.id===decision.assetId);return decision?.status==='dismissed'?'已忽略':`${decision?.status==='linked'?'已补充到':'已新建'}${asset?` ${displayName(asset)}`:'资产'}`;}
function candidateRow(c){return `<article class="candidate ${c.pending?'':'resolved'}"><div class="candidate-main"><strong>${esc([c.merchant||c.latest.title||'未识别来源',c.name&&c.name!==c.merchant?c.name:''].filter(Boolean).join(' · '))}</strong><span class="candidate-meta">${esc(evidenceKinds[c.latest.kind]||'导入资料')}${c.count>1?` · ${c.count} 封`:''}${c.latest.day!=null?` · 最近 ${isoDay(c.latest.day)}`:''}</span><div class="chips">${candidateChips(c)}</div></div><div class="candidate-actions">${c.pending?`<button class="button" data-action="candidate-review" data-id="${esc(c.key)}">核对</button><button class="text-button" data-action="candidate-dismiss" data-id="${esc(c.key)}">忽略</button>`:`<span class="candidate-status">${esc(decisionLabel(c))}</span><button class="text-button" data-action="candidate-review" data-id="${esc(c.key)}">查看</button><button class="text-button" data-action="candidate-reopen" data-id="${esc(c.key)}">恢复待确认</button>`}</div></article>`;}
function inboxDialog(refresh=true){
 const list=candidates(),pending=list.filter(c=>c.pending),strong=pending.filter(c=>!c.weak),weak=pending.filter(c=>c.weak),resolved=list.filter(c=>!c.pending);
 const paste=`<form class="form inbox-paste" id="paste-form"><textarea id="paste-text" rows="3" aria-label="粘贴续费通知、账单或收据的文字" placeholder="粘贴通知或账单文字" title="在${nativeStore?'此 Mac':'此浏览器'}按规则识别，不上传；确认前不写入资产"></textarea><div class="paste-bar"><span class="chip" title="在${nativeStore?'此 Mac':'此浏览器'}按规则识别，不上传；确认前不写入资产">${ui('lock')}本地识别</span><button class="button primary" type="submit">识别</button></div></form>`;
 const aiControls=!nativeStore?'':aiBatchState?`<span id="ai-progress" class="candidate-meta">${aiProgressText()}</span><button class="text-button" data-action="ai-stop">停止</button>`:aiReady()?`${pending.some(c=>!c.ai)?'<button class="text-button" data-action="ai-batch" title="用 AI 识别全部待确认资料">全部 AI 识别</button>':''}<button class="icon-button" data-action="ai-settings" title="AI 设置" aria-label="AI 设置">${ui('gear')}</button>`:'<button class="text-button" data-action="ai-settings" title="配置 AI 识别">配置 AI</button>';
 const imported=nativeStore||evidenceRows.length?`<div class="inbox-head"><strong><b class="count">${strong.length}</b>组待核对</strong><span>${aiControls}${nativeStore?`<button class="icon-button" data-action="import-hub" title="导入" aria-label="打开导入">${ui('download')}</button>`:''}</span></div>${strong.length?strong.slice(0,100).map(candidateRow).join(''):`<p class="form-note">${evidenceRows.length?'没有待确认':'还没有资料'}</p>`}${weak.length?`<details class="inbox-more"><summary title="没识别出金额或日期">未识别 ${weak.length} 组</summary>${weak.slice(0,100).map(candidateRow).join('')}<button class="text-button" data-action="dismiss-weak">全部忽略</button></details>`:''}${resolved.length?`<details class="inbox-more"><summary>已处理 ${resolved.length} 组</summary>${resolved.slice(0,100).map(candidateRow).join('')}</details>`:''}`:'';
 modal('待确认',`<div class="inbox">${paste}${imported}</div>`,'inbox');
 if(refresh&&nativeStore)requestEvidence();
}
function refreshReview(key,index){const dialog=$('#modal');if(!dialog.open||dialog.dataset.view!=='review'||dialog.dataset.key!==key)return;const c=findCandidate(key);if(c)candidateReview(c,index??(Number(dialog.dataset.index)||0));}
function candidateReview(c,index=0){
 const items=c.ai?.items||[];if(!items[index])index=0;
 const view=candidateView(c,index),row=c.key==='paste'?pasteRow:evidenceRows.find(item=>item.id===(c.ai?.rowId||c.latest.id)),match=view.match&&state.assets.find(a=>a.id===view.match);
 const others=state.assets.filter(a=>a.id!==view.match).sort((left,right)=>left.name.localeCompare(right.name));
 const option=a=>`<option value="${esc(a.id)}">补充到：${esc(displayName(a))} · ${esc(cats[a.type].name)}</option>`;
 const row2=([k,v])=>`<div class="fact"><span>${k}</span><span>${esc(v)}</span></div>`;
 const facts=[['名称',view.name||'待填写'],['类别',cats[view.type].name],...(view.account?[['账号',view.account]]:[]),['金额',view.cost||'未识别'],['日期',view.date?`${view.date.value} ${dateKinds[view.date.kind].label}`:'未识别']];
 const basis=[['来源',`${evidenceKinds[c.latest.kind]||'导入资料'}${view.merchant?` · ${view.merchant}`:''}${c.count>1?` · ${c.count} 封`:''}`],...(view.date?[['日期依据',view.date.basis]]:[]),...(view.quote?[['原文依据',view.quote]]:[]),...(!c.ai&&view.domains.length?[['域名',view.domains.slice(0,3).join('、')]]:[])];
 modal('核对识别结果',`<div class="form candidate-review"><div class="facts">${facts.map(row2).join('')}</div><details class="review-basis"><summary>依据</summary><div class="basis-list">${basis.map(row2).join('')}</div></details>${aiSection(c,index)}<label>记录到<select id="candidate-target" aria-label="记录到">${match?option(match):''}<option value="">新建一项资产</option>${others.map(option).join('')}</select></label><div class="confirm-actions"><button class="button primary" data-action="candidate-apply" data-id="${esc(c.key)}" data-index="${index}">继续</button><button class="button" data-action="candidate-dismiss" data-id="${esc(c.key)}">${c.key==='paste'?'放弃':'忽略'}</button></div>${row?`<details><summary>原文 · ${esc(row.title)}</summary><pre class="imported-text">${esc(String(row.body).slice(0,4000))}</pre></details>`:''}<button class="icon-button inbox-back" data-action="inbox" title="返回待确认" aria-label="返回待确认">${ui('back')}</button></div>`,'review');
 $('#modal').dataset.key=c.key;$('#modal').dataset.index=String(index);
}
function candidateFill(c,existing,index=0){
 const view=candidateView(c,index),fill={};if(!existing){fill.name=view.name;fill.provider=view.merchant;if(view.account)fill.account=view.account;}
 if(view.cost)fill.cost=view.cost;if(view.date){fill.date=view.date.value;fill.dateKind=view.date.kind;}if(view.cycle)fill.cycle=view.cycle;
 const dateNote=view.date?.source==='inferred'?`；日期${view.date.basis}`:view.date?.source==='ai'&&view.date.basis!=='AI 从原文识别'?`；${view.date.basis}`:'';
 const aiNote=c.ai&&!c.ai.unreadable&&c.ai.items.length?`；AI 识别（${c.ai.model}）${view.quote?`：“${view.quote}”`:''}`:'';
 const note=`依据：${evidenceKinds[c.latest.kind]||'导入资料'}《${c.latest.title}》${c.latest.day!=null&&c.latest.kind==='gmail'?` ${isoDay(c.latest.day)}`:''}${dateNote}${aiNote}`;
 fill.notes=existing?.notes?`${existing.notes}\n${note}`:note;return fill;
}
function resolveCandidate(key,status,assetId,index=null){
 const c=findCandidate(key);if(!c)return 0;
 if(key==='paste'){if(index!==null)pasteRecorded.add(index);return 0;}
 state.evidenceDecisions ||= {};const at=new Date().toISOString();
 for(const id of c.pendingIds)state.evidenceDecisions[id]={status,...(assetId?{assetId}:{}),at};
 const decision=index!==null&&c.ai?.items.length>1&&state.evidenceDecisions[c.ai.rowId];if(decision)decision.recorded=[...new Set([...(decision.recorded||[]),index])];
 return c.pendingIds.length;
}
document.addEventListener('submit',e=>{if(e.target.id!=='paste-form')return;e.preventDefault();const text=$('#paste-text').value.trim();if(!text){$('#paste-text').focus();return;}pasteRow={id:'paste-'+Date.now(),kind:'paste',source:'',title:text.split('\n')[0].slice(0,60),body:text,importedAt:new Date().toISOString()};pasteRecorded=new Set();candidateReview(buildPasteCandidate());});
function settings(id){if(!cats[id])return;const count=state.assets.filter(a=>a.type===id).length;modal(`${cats[id].name} · 类别`,`<div class="settings-actions"><button class="button" data-action="move-up" data-id="${id}">向上移动</button><button class="button" data-action="move-down" data-id="${id}">向下移动</button>${count?'':`<button class="button" data-action="remove-block" data-id="${id}">从侧边栏移除</button>`}</div><p class="form-note">也可以在侧边栏拖动类别，或选中后按 ⌥ + ↑ ↓。</p>`);}
document.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(!button)return;const {action,id}=button.dataset;
 if(button.closest('#menu'))closeMenu();
 if(action==='detail'){if($('#modal').open)$('#modal').close();showDetail(id,{focus:e.detail===0||!inspectorDocked()});}
 else if(action==='view')setView(id);
 else if(action==='layout')setLayout(id);
 else if(action==='asset-menu'){if(!$('#menu').hidden&&$('#menu').anchor===button){closeMenu();return;}const a=state.assets.find(x=>x.id===id);if(a)openMenu(assetMenuItems(a),{anchor:button});}
 else if(action==='category-menu'){if(cats[button.dataset.id])settings(button.dataset.id);}
 else if(action==='undo')undo();
 else if(action==='redo')redo();
 else if(action==='quick'){if(!runQuick(id,button.dataset.quick))toast('这个操作已不可用');}
 else if(action==='copy-ip'){copyText(button.dataset.ip,'已复制 IP');}
 else if(action==='keys-help')toggleKeysHelp();
 else if(action==='reveal'){const value=button.previousElementSibling,shown=button.getAttribute('aria-pressed')==='true';value.textContent=shown?value.dataset.masked:value.dataset.full;button.setAttribute('aria-pressed',String(!shown));button.textContent=shown?'显示':'隐藏';}
 else if(action==='link-picker')linkPicker(id);
 else if(action==='icon-dialog')iconDialog(id);
 else if(action==='icon-batch')iconBatchDialog();
 else if(action==='icon-batch-start')iconBatchStart();
 else if(action==='icon-batch-cancel')$('#modal').close();
 else if(action==='icon-apply'){const a=state.assets.find(x=>x.id===id);if(!a||!iconPreview)return;checkpoint();a.siteIcon=iconPreview.dataUrl;a.siteIconHost=iconPreview.host;save();$('#modal').close();render();if(activeAsset===id)showDetail(id);toast('已使用图标',true);}
 else if(action==='icon-remove'){const a=state.assets.find(x=>x.id===id);if(!a?.siteIcon)return;checkpoint();delete a.siteIcon;delete a.siteIconHost;save();$('#modal').close();render();if(activeAsset===id)showDetail(id);toast('已移除图标',true);}
 else if(action==='link'){$('#modal').close();checkpoint();const result=linkRelation(state.assets,id,button.dataset.target);if(!result.ok){history.pop();return;}save();render();showDetail(id);toast(result.replaced.length?'已换成新账号':'已关联',true);}
 else if(action==='link-standby'||action==='link-proxy'){const meta=linkMetaOf(state.assets.find(x=>x.id===id),button.dataset.target);checkpoint();if(!setLinkMeta(state.assets,id,button.dataset.target,action==='link-standby'?{standby:!meta.standby}:{proxied:!meta.proxied})){history.pop();return;}save();render();showDetail(id);}
 else if(action==='unlink'){checkpoint();if(!unlinkAssets(state.assets,id,button.dataset.target)){history.pop();return;}save();render();showDetail(id);toast('已取消关联',true);}
 else if(action==='inbox')inboxDialog();
 else if(action==='agenda-all')setView('upcoming');
 else if(action==='close-modal')$('#modal').close();
 else if(action==='apply-collisions'){const chosen=[...document.querySelectorAll('input[name="collision"]:checked')].map(input=>pendingCollisions[Number(input.value)]).filter(Boolean);$('#modal').close();if(!chosen.length)return;checkpoint();const applied=chosen.filter(item=>applyCollision(state,item)).length;pendingCollisions=[];save();render();toast(`已覆盖 ${applied} 条`,true);}
 else if(action==='candidate-review'){const c=findCandidate(id);if(c)candidateReview(c);}
 else if(action==='candidate-apply'){const c=findCandidate(id);if(!c)return;const index=Number(button.dataset.index)||0,target=$('#candidate-target').value,existing=target&&state.assets.find(a=>a.id===target);assetForm(existing?existing.type:candidateView(c,index).type,existing?existing.id:null,candidateFill(c,existing,index),c.key,index);}
 else if(action==='ai-settings')aiDialog();
 else if(action==='ai-disconnect')window.webkit.messageHandlers.assetboard.postMessage({action:'aiDisconnect'});
 else if(action==='ai-recognize')aiRecognizeCandidate(id);
 else if(action==='ai-batch')aiBatch();
 else if(action==='ai-stop'){if(aiBatchState){aiBatchState.stop=true;const progress=$('#ai-progress');if(progress)progress.textContent=aiProgressText();}}
 else if(action==='ai-item'){const c=findCandidate(id);if(c)candidateReview(c,Number(button.value)||0);}
 else if(action==='candidate-dismiss'){if(id==='paste'){inboxDialog(false);return;}checkpoint();const count=resolveCandidate(id,'dismissed');if(!count){history.pop();return;}save();render();inboxDialog(false);toast('已忽略',true);}
 else if(action==='candidate-reopen'){const c=findCandidate(id);if(!c)return;checkpoint();for(const key of c.ids)delete state.evidenceDecisions?.[key];save();render();inboxDialog(false);toast('已恢复待确认',true);}
 else if(action==='dismiss-weak'){const weak=candidates().filter(c=>c.pending&&c.weak);if(!weak.length)return;checkpoint();for(const c of weak)resolveCandidate(c.key,'dismissed');save();render();inboxDialog(false);toast(`已忽略 ${weak.length} 组`,true);}
 else if(action==='pin-front')pinFront(id);
 else if(action==='auto-order')autoOrder(id);
 else if(action==='import-hub')importHub();
 else if(action==='import-pick-file')$('#import-file')?.click();
 else if(action==='import-demo-sample'){if(!demoMode)return;importKind='csv';importCsvText(demoImportSampleCsv(),{filename:'demo-sample.csv'});}
 else if(action==='import-apply'){
  if(!importPlan)return;
  if(importKind==='json'&&$('#import-replace')?.checked){
   const backup={ok:true,board:importPlan.board};importPlan=planBoardBackup(state,backup,{mode:'replace'});
  }
  const restoreKeys=[...document.querySelectorAll('input[name="import-restore"]:checked')].map(input=>input.value);
  const applySame=[...document.querySelectorAll('input[name="import-same"]:checked')].map(input=>input.value);
  commitImportPlan(importPlan,{},{restoreKeys,applySame,applyCollisions:applySame});
 }
 else if(action==='manual-import')manualImport();
 else if(action==='github-import')githubDialog();
 else if(action==='cloudflare-import')cloudflareDialog();
 else if(action==='gmail-import')gmailDialog();
 else if(action==='ocr-import'){if(demoMode){window.assetboardDemoBlocked();return;}if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'ocrImport'});}
 else if(action==='setup-github-token'){const url=githubTokenTemplateUrl();if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'openExternal',url});}
 else if(action==='setup-cloudflare'||action==='setup-gmail'){
  const url=action==='setup-cloudflare'?(button.dataset.url||cloudflareTokenTemplateUrl()):'https://console.cloud.google.com/apis/credentials';
  if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'openExternal',url});
 }
 else if(action==='local-cli-refresh')requestLocalCliDetect();
 else if(action==='ssh-import'){
  if(demoMode){window.assetboardDemoBlocked();return;}
  if(!nativeStore){toast('SSH 导入仅 Mac App 可用');return;}
  window.webkit.messageHandlers.assetboard.postMessage({action:'sshConfigImport'});
 }
 else if(action==='github-local-sync'){
  if(demoMode){window.assetboardDemoBlocked();return;}
  if(!nativeStore)return;
  const btn=button;btn.disabled=true;
  const status=$('#github-status');if(status)status.textContent='正在用本机 gh 读取各账号仓库…';
  window.webkit.messageHandlers.assetboard.postMessage({action:'githubSyncLocal'});
 }
 else if(action==='choose-asset-type')assetForm(id);
 else if(action==='external'){const a=state.assets.find(a=>a.id===id),url=safeManagementUrl(a?.url);if(!url||new URL(url).hostname==='example.com'){toast('先在资料里填管理链接');return;}if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'openExternal',url});else window.open(url,'_blank','noopener,noreferrer');}
 else if(action==='collapse'){if(query||currentView()!=='all'||!cats[id])return;checkpoint();ensureBlock(state,id);const b=state.blocks.find(x=>x.id===id),fold=!b.folded,targets=e.altKey?categoryIds():[id];for(const type of targets){ensureBlock(state,type);state.blocks.find(x=>x.id===type).folded=fold;}save();foldRender(targets,id);document.querySelector(`#board [data-action="collapse"][data-id="${id}"]`)?.focus();if(e.altKey)toast(fold?'已收起全部类别':'已展开全部类别',true);}
 else if(action==='all')setView(id);
 else if(action==='back')setView('all');
 else if(action==='add-asset')assetForm(id);
 else if(action==='edit-asset')assetForm(state.assets.find(a=>a.id===id).type,id);
 else if(action==='settings')settings(id);
 else if(action==='toggle-hidden')setView('hidden');
 else if(action==='toggle-stopped')toggleStopped(id);
 else if(action==='hide-asset'){const a=state.assets.find(a=>a.id===id);if(!a||a.hiddenAt)return;checkpoint();a.hiddenAt=new Date().toISOString();save();if(activeAsset===id)closeDetail();render();toast('已隐藏',true);}
 else if(action==='restore-asset'){const a=state.assets.find(a=>a.id===id),fromBoard=!!button.closest('#board');if(!a)return;checkpoint();delete a.hiddenAt;save();if(activeAsset===id)showDetail(id);render();if(fromBoard)(document.querySelector(`#board [data-asset="${CSS.escape(id)}"] .item-open`)||document.querySelector('#board [data-action="restore-asset"]')||$('#sidebar .nav-item.active'))?.focus();toast('已恢复显示',true);}
 else if(action==='delete-asset'){const a=state.assets.find(a=>a.id===id);if(!a)return;confirmDialog(`删除「${a.name}」？`,`只删除 Assetboard 里的记录，不取消订阅，也不动线上资源。之后同步不会加回。${a.type==='server'&&serverChainCount(state.assets,a)?`\n同时解除 ${serverChainCount(state.assets,a)} 项关联，域名和仓库本身不受影响。`:''}`,'删除',true).then(ok=>{const a=state.assets.find(a=>a.id===id);if(!ok||!a)return;checkpoint();rememberDeleted(a);state.assets=state.assets.filter(x=>x.id!==id);removeLinksTo(state.assets,id);if(Array.isArray(state.featuredRepositoryIds))state.featuredRepositoryIds=state.featuredRepositoryIds.filter(x=>x!==id);if(state.cardOrder){for(const key of Object.keys(state.cardOrder))state.cardOrder[key]=(state.cardOrder[key]||[]).filter(x=>x!==id);}if(activeAsset===id)closeDetail();save();render();toast('已删除',true);});}
 else if(action==='remove-block'){if(state.assets.some(a=>a.type===id))return;checkpoint();state.blocks=state.blocks.filter(b=>b.id!==id);save();$('#modal').close();render();toast('已从侧边栏移除',true);}
 else if(action==='move-up'||action==='move-down'){moveBlock(id,action==='move-up'?-1:1);$('#modal').close();}
});
document.addEventListener('submit',async e=>{if(e.target.id!=='asset-form')return;e.preventDefault();const form=e.target,data=new FormData(form),name=String(data.get('name')).trim(),url=String(data.get('url')).trim(),file=form.elements.icon.files[0];if(!name)return;const leaked=['name','provider','account','purpose','reason','cost','notes'].find(key=>looksLikeCardNumber(data.get(key)));if(leaked){const input=form.elements[leaked];input.setCustomValidity('这里像是完整卡号。Assetboard 只保存卡号后 4 位，请删掉后再保存。');input.reportValidity();input.addEventListener('input',()=>input.setCustomValidity(''),{once:true});return;}if(url&&!safeManagementUrl(url)){form.elements.url.setCustomValidity('请输入不含账号密码的 http 或 https 链接');form.elements.url.reportValidity();return;}form.elements.url.setCustomValidity('');const actionHints={host:'请填写主机名或 IP，例如 203.0.113.10',ips:'最多 4 个有效 IP，用逗号或空格分隔',sshUser:'SSH 用户只能包含字母、数字和 _ . -',sshPort:'端口是 1 到 65535 之间的数字',localPath:'请填写以 / 或 ~/ 开头的本机目录'};for(const key of Object.keys(actionHints)){const input=form.elements[key];if(!input)continue;input.setCustomValidity(validActionField(key,input.value)?'':actionHints[key]);if(!input.checkValidity()){input.reportValidity();input.addEventListener('input',()=>input.setCustomValidity(''),{once:true});return;}}if(file&&(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>256*1024)){toast('图标需为 PNG、JPEG 或 WebP，且不超过 256 KB');return;}const submit=form.querySelector('[type="submit"]');submit.disabled=true;try{const iconData=file?await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);}):null;const id=form.dataset.id,chosen=String(data.get('type')||''),type=cats[chosen]?chosen:form.dataset.type,candidateKey=form.dataset.candidate,candidateItem=form.dataset.item===''||form.dataset.item===undefined?null:Number(form.dataset.item),profile=assetProfiles[type]||{},date=data.has('expiry')?cardExpiry(data.get('expiry'))||'':String(data.get('date')??''),dateKind=data.has('expiry')?'expire':dateKinds[data.get('dateKind')]?String(data.get('dateKind')):'expire',cycle=billingCycles[data.get('cycle')]?String(data.get('cycle')):'',extras=Object.fromEntries((profile.extra||[]).map(key=>[key,String(data.get(key)??'').trim()])),fields={name,provider:profile.fixedProvider||String(data.get('provider')??'').trim()||(assetProfiles[type]?'':'平台待补充'),account:String(data.get('account')).trim(),purpose:String(data.get('purpose')).trim(),reason:String(data.get('reason')||'').trim(),date,dateKind,cycle,cost:String(data.get('cost')).trim()||'未知',notes:String(data.get('notes')).trim(),url:url?safeManagementUrl(url):''},event=date?`${date} ${dateKinds[dateKind].future}`:'日期待补充';if(extras.region&&!regionName(extras.region))extras.region='';if(extras.last4&&!/^\d{4}$/.test(extras.last4))extras.last4='';if(extras.network&&!cardNetworks.includes(extras.network))extras.network='';if(extras.phone)extras.phone=extras.phone.slice(0,30);Object.assign(fields,extras);for(const [key] of ACTION_FIELDS[type]||[])if(data.has(key))fields[key]=key==='ips'?parseIps(data.get(key)).ips.map(x=>x.ip):String(data.get(key)).trim();checkpoint();let assetId=id;if(id){const a=state.assets.find(a=>a.id===id);const synced=['cloudflare','github'].includes(a.source);Object.assign(a,fields);for(const key of ['region','last4','network','phone'])if(!(key in extras))delete a[key];if(file)a.iconData=iconData;else if(data.has('removeIcon'))delete a.iconData;if(!synced){a.source='manual';a.type=type;a.event=event;a.updatedAt=new Date().toISOString();}delete a.warn;ensureBlock(state,a.type);}else{assetId='asset-'+crypto.randomUUID();state.assets.push({id:assetId,type,...fields,iconData,source:'manual',event,art:'generic',createdAt:new Date().toISOString()});if(state.cardOrder?.[type]?.length)state.cardOrder[type].unshift(assetId);ensureBlock(state,type);}const resolved=candidateKey?resolveCandidate(candidateKey,id?'linked':'created',assetId,candidateItem):0;assetFormSnapshot=null;save();render();if(id&&activeAsset===id)showDetail(id);const source=candidateKey&&findCandidate(candidateKey),items=source?.ai?.items||[],recorded=items.length>1?recordedItems(source):[],next=items.length>1?items.findIndex((_,index)=>!recorded.includes(index)):-1;if(next>=0){candidateReview(source,next);toast(`已记录，这份资料里还有 ${items.length-recorded.length} 项`,true);}else if(candidateKey&&nativeStore&&pendingCount()){inboxDialog(false);toast(resolved?'已记录，继续核对下一组':'已记录',true);}else{$('#modal').close();toast(id?'资料已更新':'资产已添加',true);}}catch{toast('读取图标失败，请重试');}finally{submit.disabled=false;}});
setIconButton($('#add-block'),'plus','添加资产');document.querySelectorAll('#layout-toggle [data-action="layout"]').forEach(b=>b.innerHTML=ui(b.dataset.id==='grid'?'tiles':'list'));$('#view-menu').innerHTML=ui('more');setIconButton($('#import-button'),'download','导入');$('#add-block').onclick=addAsset;$('#close-modal').onclick=()=>requestCloseModal();$('#close-detail').onclick=closeDetail;$('#modal').addEventListener('cancel',e=>{if(isAssetFormDirty()){e.preventDefault();requestCloseModal();}else assetFormSnapshot=null;});
$('#search').oninput=e=>{query=e.target.value;render();};$('#clear-search').onclick=()=>{if(query){$('#search').value='';query='';render();}else addAsset();};
// Keyboard map (DESIGN-PRINCIPLES §4 rule 4). Letter keys never act while typing, with a dialog open, or with ⌘/⌃/⌥ held.
let helpReturn=null;
function typing(e){return e.isComposing||!!e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');}
function focusSearchBox(){if(nativeStore){window.webkit.messageHandlers.assetboard.postMessage({action:'focusSearch'});return;}const input=$('#search');input.focus();input.select();}
function navTargets(){return [...document.querySelectorAll('#board .group-title:not(.static),#board .item-open')].filter(n=>n.getClientRects().length);}
function focusCard(n){n.focus({preventScroll:true});n.scrollIntoView({block:'nearest',inline:'nearest'});}
function focusAsset(id){const n=id&&document.querySelector(`#board [data-asset="${CSS.escape(id)}"] .item-open`);if(n&&n.getClientRects().length){focusCard(n);return true;}return false;}
function inspectorDocked(){return matchMedia('(min-width: 1180px)').matches;}
// Lists walk in reading order with ↑/↓. The grid moves spatially: ←/→ within a group, ↑/↓ to the nearest item above or below, preferring the same column.
function moveFocus(from,key){
 const list=navTargets(),sign=key==='ArrowRight'||key==='ArrowDown'?1:-1,horizontal=key==='ArrowLeft'||key==='ArrowRight',grid=!!from.closest('.group-body.grid')||from.classList.contains('group-title')&&!!from.closest('.group')?.querySelector('.group-body.grid');
 let next=null;
 if(!grid){if(horizontal)return;next=list[list.indexOf(from)+sign];}
 else if(horizontal&&!from.classList.contains('group-title')){const body=from.closest('.group-body'),peers=list.filter(n=>n.closest('.group-body')===body);next=peers[peers.indexOf(from)+sign];}
 else if(!horizontal){
  const r=from.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let score=Infinity;
  for(const n of list){if(n===from)continue;const b=n.getBoundingClientRect(),main=(b.top+b.height/2-cy)*sign;if(main<=4)continue;const lined=b.right>r.left+2&&b.left<r.right-2,value=(lined?0:100000)+main+Math.abs(b.left+b.width/2-cx)*(lined?.25:2);if(value<score){score=value;next=n;}}
 }
 if(!next)return;
 focusCard(next);
 // With the inspector open beside the list, the selection carries it along (like Mail's reading pane).
 const id=next.closest('[data-asset]')?.dataset.asset;if(id&&!$('#detail').hidden&&inspectorDocked())showDetail(id,{focus:false});
}
function navMove(from,key){const items=[...document.querySelectorAll('#sidebar .nav-item')],at=items.indexOf(from);if(key==='ArrowDown'||key==='ArrowUp'){items[at+(key==='ArrowDown'?1:-1)]?.focus();return;}if(key==='ArrowRight'){const first=navTargets()[0];if(first)focusCard(first);}}
function keyAsset(e){const item=e.target.closest?.('#board [data-asset]');if(item)return item.dataset.asset;return e.target.closest?.('#detail')&&activeAsset?activeAsset:null;}
function fire(action,id){const b=document.createElement('button');b.hidden=true;b.dataset.action=action;b.dataset.id=id;document.body.append(b);b.click();b.remove();}
function keysHelpHtml(){
 const row=(keys,label)=>`<li><span>${label}</span><span class="keys">${keys.map(k=>`<kbd>${k}</kbd>`).join('')}</span></li>`;
 const groups=[['浏览',[[['⌘K','/'],'搜索'],[['↑','↓'],'移动'],[['↩'],'详情'],[['←'],'侧边栏'],[['P'],'全景'],[['esc'],'返回']]],['整理',[[['I'],'导入'],[['N'],'新建'],[['E'],'编辑'],[['H'],'隐藏'],[['F'],'置前'],[['⌥','↑ ↓'],'调整顺序'],[['L'],'关联'],[['S'],'停用']]],['快捷',[[['O'],'打开'],[['⌘C'],'复制']]],['编辑',[[['⌘Z'],'撤销'],[['⇧⌘Z'],'重做'],[['⌘↩'],'保存'],[['tab'],'换字段']]]];
 return `<div class="keys-card" role="document" tabindex="-1"><div class="keys-head"><h2 id="keys-help-title" title="在输入框里打字时，字母键不生效">快捷键</h2><button class="close" data-action="keys-help" aria-label="关闭快捷键说明">×</button></div><div class="keys-grid">${groups.map(([title,rows])=>`<section><h3>${title}</h3><ul>${rows.map(([k,l])=>row(k,l)).join('')}</ul></section>`).join('')}</div></div>`;
}
function toggleKeysHelp(show){
 const layer=$('#keys-help'),open=show??layer.hidden;if(open===!layer.hidden)return;
 if(open){helpReturn=document.activeElement;layer.innerHTML=keysHelpHtml();layer.hidden=false;layer.querySelector('.keys-card').focus();}
 else{layer.hidden=true;if(helpReturn?.isConnected)helpReturn.focus();helpReturn=null;}
}
$('#keys-help').addEventListener('click',e=>{if(e.target===e.currentTarget)toggleKeysHelp(false);});
document.addEventListener('keydown',e=>{
 const mod=e.metaKey||e.ctrlKey,key=e.key.length===1?e.key.toLowerCase():e.key,modalOpen=$('#modal').open,helpOpen=!$('#keys-help').hidden;
 if(mod&&!e.altKey&&!e.shiftKey&&key==='k'){e.preventDefault();if(helpOpen)toggleKeysHelp(false);focusSearchBox();return;}
 if(mod&&!e.altKey&&key==='z'&&!modalOpen&&!typing(e)){e.preventDefault();if(e.shiftKey)redo();else undo();return;}
 if(mod&&!e.altKey&&!e.shiftKey&&key==='Enter'&&modalOpen){const form=e.target.closest?.('form');if(form){e.preventDefault();form.requestSubmit();}return;}
 if(key==='Escape'){
  if(helpOpen){e.preventDefault();toggleKeysHelp(false);return;}
  if(modalOpen||gesture?.active)return;
  if(e.target.id==='search'){if(e.target.value){e.target.value='';e.target.dispatchEvent(new Event('input',{bubbles:true}));}else e.target.blur();return;}
  if(!$('#detail').hidden)closeDetail();
  return;
 }
 if(e.target.id==='search'&&key==='ArrowDown'&&!mod&&!e.altKey){const first=navTargets().find(n=>n.classList.contains('item-open'));if(first){e.preventDefault();focusCard(first);}return;}
 if(modalOpen||typing(e))return;
 if(mod&&!e.altKey&&!e.shiftKey&&key==='c'&&!String(getSelection?.()||'')){const id=keyAsset(e);if(id){e.preventDefault();if(!runQuick(id,null,'copy'))toast('没有可复制的内容');}return;}
 if(mod||e.altKey)return;
 if(e.key==='?'){e.preventDefault();toggleKeysHelp();return;}
 if(helpOpen)return;
 if(key==='/'){e.preventDefault();focusSearchBox();return;}
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)){
  const nav=e.target.closest?.('#sidebar .nav-item');if(nav){e.preventDefault();navMove(nav,key);return;}
  const from=e.target.closest?.('#board .group-title,#board .item-open');if(!from)return;
  e.preventDefault();
  if(key==='ArrowLeft'&&!from.closest('.group-body.grid')){($('#sidebar .nav-item.active')||$('#sidebar .nav-item'))?.focus();return;}
  moveFocus(from,key);return;
 }
 if(e.shiftKey&&key!=='n')return;
 if(key==='i'){e.preventDefault();importHub();return;}
 if(key==='n'){e.preventDefault();const group=e.target.closest?.('#board .group')?.dataset.group,type=cats[group]?group:(e.target.closest?.('#detail')&&state.assets.find(a=>a.id===activeAsset)?.type)||(cats[currentView()]?currentView():null);if(cats[type])assetForm(type);else manualImport();return;}
 const id=keyAsset(e),a=id&&state.assets.find(x=>x.id===id);if(!a)return;
 if(key==='e'){e.preventDefault();assetForm(a.type,id);}
 else if(key==='s'){e.preventDefault();if(a.hiddenAt)return;if(toggleStopped(id)&&!e.target.closest('#detail'))focusAsset(id);else if(!STOPPABLE.includes(a.type))toast('这类不用标停用');}
 else if(key==='l'){e.preventDefault();if(a.hiddenAt){toast('先恢复显示，再关联');return;}linkPicker(id);}
 else if(key==='o'){e.preventDefault();if(!runQuick(id,null,'open'))toast('没有可打开的链接或目录');}
 else if(key==='f'){e.preventDefault();if(a.hiddenAt){toast('先恢复显示，再放到前面');return;}pinFront(id);if(!e.target.closest('#detail'))focusAsset(id);}
 else if(key==='h'){
  e.preventDefault();const inDetail=!!e.target.closest('#detail'),peers=navTargets().filter(n=>n.classList.contains('item-open')),own=peers.findIndex(n=>n.closest('[data-asset]')?.dataset.asset===id),near=[peers[own+1],peers[own-1]].map(n=>n?.closest('[data-asset]')?.dataset.asset).filter(Boolean),restoring=!!a.hiddenAt;
  fire(restoring?'restore-asset':'hide-asset',id);
  if(inDetail&&restoring)return;
  if(!focusAsset(id))near.some(focusAsset);
 }
});
// Direct manipulation, no layout mode: a row moves within its group, onto a sidebar category to change its category, and sidebar categories reorder.
// Mouse starts after 5px, touch after a long press; Esc cancels; ⌥ + arrows is the keyboard path.
let gesture=null,suppressClick=false,floatTip=null;
const settleEase='cubic-bezier(.22,1,.36,1)';
function reduceMotion(){return matchMedia('(prefers-reduced-motion: reduce)').matches;}
function docRect(el){const r=el.getBoundingClientRect();return {left:r.left+scrollX,top:r.top+scrollY,right:r.right+scrollX,bottom:r.bottom+scrollY,width:r.width,height:r.height};}
function inside(r,x,y){return !!r&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}
function slideFrom(el,from,duration=MOTION_MS){if(!from)return;const to=el.getBoundingClientRect(),dx=from.left-to.left,dy=from.top-to.top;if(Math.abs(dx)>=1||Math.abs(dy)>=1)el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration,easing:settleEase});}
function showTip(text,x=0,y=0,tone='',clear=null){if(!floatTip){floatTip=document.createElement('div');floatTip.setAttribute('aria-hidden','true');document.body.append(floatTip);}floatTip.hidden=!text;if(!text)return;floatTip.className=`float-tip ${tone}`;floatTip.textContent=text;const w=floatTip.offsetWidth,h=floatTip.offsetHeight;let left=x+14,top=y+20;if(clear){left=x-w/2;top=clear.bottom+8;if(top+h>innerHeight-8)top=clear.top-h-8;}floatTip.style.left=Math.max(8,Math.min(innerWidth-w-8,left))+'px';floatTip.style.top=Math.max(8,Math.min(innerHeight-h-8,top))+'px';}
// Only the touched prefix becomes manual order (touchedPrefix); untouched rows keep following recency.
function saveCardOrder(category,next){const existing=state.cardOrder?.[category]||[];checkpoint();state.cardOrder ||= {};state.cardOrder[category]=[...next,...existing.filter(id=>!next.includes(id))];save();}
function commitAssetOrder(source,target,after=false){
 if(!source||!target||source===target||source.parentElement!==target.parentElement)return false;
 const category=source.parentElement.dataset.reorder;if(!cats[category])return false;
 const current=[...source.parentElement.children].filter(n=>n.dataset.asset).map(n=>n.dataset.asset),next=moveAsset(current,source.dataset.asset,target.dataset.asset,after);
 if(next.every((id,i)=>id===current[i]))return false;
 saveCardOrder(category,touchedPrefix(current,next));render();return true;
}
function moveBlock(id,step){const order=categoryIds(),index=order.indexOf(id),target=index+step;if(index<0||target<0||target>=order.length){toast(step<0?'已经是第一个类别':'已经是最后一个类别');return false;}checkpoint();for(const type of order)ensureBlock(state,type);[order[target],order[index]]=[order[index],order[target]];state.blocks=order.map(type=>state.blocks.find(b=>b.id===type));save();render();toast(step<0?'已向上移动':'已向下移动',true);return true;}
function dragSource(target){
 if(query)return null;
 const item=target.closest('#board [data-reorder] > [data-asset]');
 if(item)return {kind:'card',el:item,container:item.parentElement,block:item.closest('.group')};
 const nav=target.closest('#sidebar .nav-item[data-block]');
 return nav?{kind:'block',el:nav,container:nav.parentElement}:null;
}
function releaseGesture(){const g=gesture;if(!g)return;clearTimeout(g.timer);cancelAnimationFrame(g.frame);removeEventListener('pointermove',dragMove);removeEventListener('pointerup',dragEnd);removeEventListener('pointercancel',dragEnd);gesture=null;}
function slotOrder(g){const key=g.kind==='block'?'block':'asset';return [...g.container.children].filter(n=>n===g.slot||n!==g.el&&n.dataset[key]).map(n=>(n===g.slot?g.el:n).dataset[key]);}
function measureItems(g){const key=g.kind==='block'?'block':'asset';g.items=[...g.container.children].filter(n=>n!==g.el&&n!==g.slot&&n.dataset[key]).map(n=>({el:n,r:docRect(n)}));g.slotRect=docRect(g.slot);g.box=docRect(g.container);}
function beginDrag(g){
 const el=g.el;if(!el.isConnected){releaseGesture();return;}
 clearTimeout(g.timer);g.active=true;cancelAnimationFrame(layoutFrame);closeMenu(false);
 document.querySelectorAll('#board .group,#board [data-asset],#sidebar .nav-item').forEach(n=>n.getAnimations().forEach(a=>a.cancel()));
 const r=el.getBoundingClientRect();g.rect=r;g.dx=g.x0-r.left;g.dy=g.y0-r.top;
 g.slot=document.createElement('div');g.slot.className=`drop-slot ${g.kind}-slot`;g.slot.style.width=r.width+'px';g.slot.style.height=r.height+'px';el.before(g.slot);
 el.classList.add('is-dragging');document.body.classList.add('drag-active');
 Object.assign(el.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',margin:'0',transformOrigin:`${g.dx}px ${g.dy}px`});
 const placed=el.getBoundingClientRect();if(Math.abs(placed.left-r.left)>.5||Math.abs(placed.top-r.top)>.5){el.style.left=2*r.left-placed.left+'px';el.style.top=2*r.top-placed.top+'px';}
 // A row can also land on another category in the sidebar; those targets are fixed, so they are measured live.
 if(g.kind==='card'){g.asset=state.assets.find(a=>a.id===el.dataset.asset);g.homeRect=docRect(g.container);g.others=[...document.querySelectorAll('#sidebar .nav-item[data-block]')].filter(n=>n.dataset.block!==g.asset?.type);}
 g.initial=slotOrder(g);measureItems(g);
 const bar=document.querySelector('#topbar');g.top=bar&&getComputedStyle(bar).display!=='none'?Math.max(0,bar.getBoundingClientRect().bottom):0;
 try{document.body.setPointerCapture(g.id);}catch{}
 getSelection()?.removeAllRanges();
 if(reduceMotion())el.classList.add('lifted');else requestAnimationFrame(()=>el.classList.add('lifted'));
 followPointer(g);g.frame=requestAnimationFrame(()=>autoScroll(g));
}
function followPointer(g){g.el.style.translate=`${g.x-g.dx-g.rect.left}px ${g.y-g.dy-g.rect.top}px`;}
function setCrossTarget(g,target){
 if(g.cross===target)return;
 g.cross?.classList.remove('drop-into','drop-refused');g.cross=target;g.crossAllowed=!!target&&!['cloudflare','github'].includes(g.asset?.source);
 target?.classList.add(g.crossAllowed?'drop-into':'drop-refused');g.el.classList.toggle('refused',!!target&&!g.crossAllowed);
}
function moveSlot(g,mode,ref){
 const items=g.items.map(it=>it.el),near=(n,dir)=>{let s=n[dir];while(s&&!items.includes(s))s=s[dir];return s;};
 if(mode==='home'?g.slot.nextElementSibling===g.el:mode==='before'?near(g.slot,'nextElementSibling')===ref:near(g.slot,'previousElementSibling')===ref)return;
 const motion=!reduceMotion(),all=[...g.container.children].filter(n=>n!==g.el&&n!==g.slot),from=motion?new Map(all.map(n=>[n,n.getBoundingClientRect()])):null;
 if(motion)all.forEach(n=>n.getAnimations().forEach(a=>a.cancel()));
 if(mode==='home')g.el.before(g.slot);else if(mode==='before')ref.before(g.slot);else ref.after(g.slot);
 g.lockUntil=performance.now()+60;
 measureItems(g);
 if(motion)for(const n of all)slideFrom(n,from.get(n));
}
function placeSlot(g){
 if(performance.now()<(g.lockUntil||0))return;
 const x=g.x+scrollX,y=g.y+scrollY;
 if(g.kind==='card'){const over=g.others.find(n=>inside(n.getBoundingClientRect(),g.x,g.y))||null;setCrossTarget(g,over);if(over||!inside(g.homeRect,x,y)){moveSlot(g,'home');return;}}
 else if(x<g.box.left-48||x>g.box.right+48||y<g.box.top-48||y>g.box.bottom+48){moveSlot(g,'home');return;}
 if(inside(g.slotRect,x,y))return;
 let best=null,distance=Infinity;
 for(const it of g.items){const dx=Math.max(it.r.left-x,0,x-it.r.right),dy=Math.max(it.r.top-y,0,y-it.r.bottom),d=dx*dx+dy*dy;if(d<distance){distance=d;best=it;}}
 if(!best)return;
 const vertical=best.r.width>g.box.width*.7,before=vertical?y<best.r.top+best.r.height/2:x<best.r.left+best.r.width/2;
 moveSlot(g,before?'before':'after',best.el);
}
function dragTip(g){showTip(g.cross?g.crossAllowed?`移到「${cats[g.cross.dataset.block].name}」`:'同步来的资产不能改类别':'',g.x,g.y,g.crossAllowed?'':'refused',g.el.getBoundingClientRect());}
function autoScroll(g){
 if(gesture!==g||!g.active)return;
 const zone=60,v=g.y<g.top+zone?-(g.top+zone-g.y)/zone:g.y>innerHeight-zone?(g.y-innerHeight+zone)/zone:0;
 if(v&&g.kind==='card'){const before=scrollY;scrollBy(0,Math.sign(v)*Math.min(1,v*v)*20);if(scrollY!==before)placeSlot(g);}
 g.frame=requestAnimationFrame(()=>autoScroll(g));
}
function dragMove(e){
 const g=gesture;if(!g||e.pointerId!==g.id)return;g.x=e.clientX;g.y=e.clientY;
 if(!g.active){const moved=Math.hypot(g.x-g.x0,g.y-g.y0);if(g.touch){if(moved>8)releaseGesture();}else if(moved>5)beginDrag(g);return;}
 if(!g.el.isConnected){abortDrag(g);return;}
 followPointer(g);placeSlot(g);dragTip(g);
}
function dragEnd(e){const g=gesture;if(!g||e.pointerId!==g.id)return;if(!g.active){releaseGesture();return;}suppressClick=true;setTimeout(()=>suppressClick=false,0);const cancelled=e.type==='pointercancel';if(!cancelled&&g.el.isConnected){g.x=e.clientX;g.y=e.clientY;g.lockUntil=0;placeSlot(g);}dropDrag(g,cancelled);}
function cleanupDrag(g){
 showTip('');document.body.classList.remove('drag-active');g.cross?.classList.remove('drop-into','drop-refused');
 g.el.classList.remove('is-dragging','lifted','settling','refused');for(const p of ['position','left','top','width','height','margin','translate','transformOrigin'])g.el.style[p]='';
 if(g.slot.isConnected)g.slot.replaceWith(g.el);
 if(gesture===g)gesture=null;
}
function abortDrag(g){releaseGesture();cleanupDrag(g);g.slot.remove();render();}
function dropDrag(g,cancelled=false){
 cancelAnimationFrame(g.frame);removeEventListener('pointermove',dragMove);removeEventListener('pointerup',dragEnd);removeEventListener('pointercancel',dragEnd);
 g.active=false;showTip('');
 const cross=!cancelled&&g.cross&&g.crossAllowed?g.cross.dataset.block:null;
 if(cross){finishCross(g,cross);return;}
 if(cancelled||g.cross)moveSlot(g,'home');
 g.cross?.classList.remove('drop-into','drop-refused');
 const next=slotOrder(g),changed=next.some((id,i)=>id!==g.initial[i]);
 const done=()=>{
  if(gesture!==g)return;cleanupDrag(g);
  if(changed&&g.kind==='block'){checkpoint();for(const type of next)ensureBlock(state,type);state.blocks=[...next.map(type=>state.blocks.find(b=>b.id===type)),...state.blocks.filter(b=>!next.includes(b.id))];save();}
  else if(changed&&g.kind==='card')saveCardOrder(g.container.dataset.reorder,touchedPrefix(g.initial,next));
  render();if(changed)toast(g.kind==='block'?'类别顺序已调整':'顺序已调整',true);
 };
 if(reduceMotion()){done();return;}
 const to=g.slot.getBoundingClientRect();g.el.classList.add('settling');g.el.classList.remove('lifted','refused');g.el.style.translate=`${to.left-g.rect.left}px ${to.top-g.rect.top}px`;setTimeout(done,MOTION_MS);
}
function finishCross(g,type){
 const a=g.asset;
 cleanupDrag(g);
 if(!a||!cats[type]){render();return;}
 checkpoint();a.type=type;ensureBlock(state,type);
 if(state.cardOrder){for(const key of Object.keys(state.cardOrder))state.cardOrder[key]=(state.cardOrder[key]||[]).filter(id=>id!==a.id);if(state.cardOrder[type]?.length)state.cardOrder[type].push(a.id);}
 save();render();
 const target=document.querySelector(`#sidebar .nav-item[data-block="${CSS.escape(type)}"]`);
 if(target&&!reduceMotion()){target.classList.add('drop-flash');setTimeout(()=>target.classList.remove('drop-flash'),600);}
 toast(`已移到「${cats[type].name}」`,true);
}
document.addEventListener('pointerdown',e=>{
 if(gesture||!e.isPrimary||e.button!==0||e.target.closest('input,select,textarea,.r-actions'))return;
 const source=dragSource(e.target);if(!source)return;
 const g=gesture={...source,id:e.pointerId,touch:e.pointerType!=='mouse',x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,active:false};
 if(g.touch)g.timer=setTimeout(()=>{if(gesture===g)beginDrag(g);},300);
 addEventListener('pointermove',dragMove);addEventListener('pointerup',dragEnd);addEventListener('pointercancel',dragEnd);
});
addEventListener('click',e=>{if(!suppressClick)return;suppressClick=false;e.preventDefault();e.stopPropagation();},true);
addEventListener('keydown',e=>{if(e.key!=='Escape'||!gesture?.active)return;e.preventDefault();e.stopImmediatePropagation();suppressClick=true;addEventListener('pointerup',()=>setTimeout(()=>suppressClick=false,0),{once:true,capture:true});dropDrag(gesture,true);},true);
for(const el of [$('#board'),$('#sidebar')]){el.addEventListener('touchmove',e=>{if(gesture?.active)e.preventDefault();},{passive:false});el.addEventListener('dragstart',e=>e.preventDefault());}
document.addEventListener('contextmenu',e=>{if(gesture?.touch)e.preventDefault();});
// ⌥ + arrows: a row moves one place within its group (grids also take ←/→); a sidebar category moves up or down.
document.addEventListener('keydown',e=>{
 if(!e.altKey||e.metaKey||e.ctrlKey||query||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
 const step=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1,opener=e.target.closest?.('#board [data-reorder] .item-open');
 if(opener){
  e.preventDefault();if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&!opener.closest('.group-body.grid'))return;
  const source=opener.closest('[data-asset]'),id=source.dataset.asset,siblings=[...source.parentElement.children].filter(n=>n.dataset.asset);
  if(commitAssetOrder(source,siblings[siblings.indexOf(source)+step],step>0)){focusAsset(id);toast(step<0?'已向前移动':'已向后移动',true);}return;
 }
 const nav=e.target.closest?.('#sidebar .nav-item[data-block]')||(e.key==='ArrowUp'||e.key==='ArrowDown')&&e.target.closest?.('#board .group-title[data-action="collapse"]');
 if(nav&&(e.key==='ArrowUp'||e.key==='ArrowDown')){e.preventDefault();const id=nav.dataset.block||nav.dataset.id,fromBoard=!!nav.closest('#board');if(moveBlock(id,step))document.querySelector(fromBoard?`#board .group-title[data-id="${CSS.escape(id)}"]`:`#sidebar .nav-item[data-block="${CSS.escape(id)}"]`)?.focus();}
});
window.addEventListener('resize',()=>{if(gesture?.active)dropDrag(gesture,true);});
// Row columns follow the width of the main area (the sidebar and a docked inspector take their share), set as a class so the DOM is not rebuilt.
new ResizeObserver(([entry])=>{const w=entry.contentRect.width,size=w<600?'s':w<860?'m':'l';if($('#board').dataset.size!==size)$('#board').dataset.size=size;}).observe($('#main'));
render();
installImportDropPaste();
if(nativeStore){document.documentElement.classList.add('native-app');if(!demoMode)requestEvidence();document.querySelectorAll('.form-note').forEach(el=>{el.textContent=el.textContent.replaceAll('当前浏览器','此 Mac').replaceAll('此浏览器','此 Mac');});if(!nativeStore.data||migratedLegacyData)save();}
else if(migratedLegacyData)save();
if(demoMode){document.documentElement.classList.add('demo-mode');const badge=document.createElement('span');badge.className='demo-badge';badge.setAttribute('role','note');badge.setAttribute('aria-label','演示模式：全部为虚构数据，不会保存');badge.title='演示模式：全部为虚构数据，不会保存';badge.textContent='演示';document.querySelector('#topbar .view-head').append(badge);}

document.body.classList.add('first-paint');setTimeout(()=>document.body.classList.remove('first-paint'),600);
