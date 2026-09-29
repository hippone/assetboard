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
 storage:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M8 15h.01"/>',
 bankcard:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><rect x="6" y="9" width="4" height="3" rx=".8"/><path d="M6 15.5h5m3 0h4"/>',
 phone:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
 appleid:'<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.8-1.6 1.9-2.3 3-2.3s2.2.7 3 2.3M14 10h4m-4 3h3"/>',
 google:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.5c1.3-2 3.2-3 5.5-3s4.2 1 5.5 3"/>',
 ai:'<path d="M11 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7Z"/><path d="M19 15v4m-2-2h4"/>'
};
const cats = {bankcard:{name:'银行卡',hint:'各国银行卡，只记尾号、卡组织与有效期',symbol:'▭'},phone:{name:'手机号',hint:'各国号码、运营商与保号日期',symbol:'☏'},server:{name:'服务器',hint:'承载项目的每一台机器',symbol:'▤'},appleid:{name:'Apple ID',hint:'各区 Apple ID 与付款卡、验证号码',symbol:'◉'},google:{name:'Google 账号',hint:'各区 Google 账号与验证号码',symbol:'◍'},ai:{name:'AI 订阅',hint:'各家 AI 服务的套餐与扣款',symbol:'✦'},domain:{name:'域名',hint:'网站的地址，也是创作的起点',symbol:'◎'},subscription:{name:'订阅与工具',hint:'每天陪你工作的好工具',symbol:'✳'},database:{name:'数据库',hint:'让每一份数据都有归处',symbol:'▱'},license:{name:'软件授权',hint:'买下的工具，不再遗忘',symbol:'◇'},repository:{name:'代码仓库',hint:'项目的代码与历史',symbol:'⌘'},deployment:{name:'部署服务',hint:'Pages 与 Worker 等线上服务',symbol:'◆'},storage:{name:'对象存储',hint:'R2 Bucket 等存储资源',symbol:'▣'}};
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
window.assetboardConnectionState=connections=>{
 if(!nativeStore)return;
 Object.assign(nativeStore,connections);
 const cloudflareStatus=$('#cloudflare-status');
 if(cloudflareStatus)cloudflareStatus.textContent=nativeStore.cloudflareConnected?'已连接 · 可重新同步':nativeStore.keychainUnavailable?'本机钥匙串暂未响应，可重新输入令牌同步':'尚未连接';
 const githubStatus=$('#github-status');
 if(githubStatus)githubStatus.textContent=nativeStore.githubConnected?'已连接 · 可重新同步':nativeStore.keychainUnavailable?'本机钥匙串暂未响应，可使用 gh 同步':'尚未连接';
};
let state=structuredClone(seed),query='',focusCategory=null,history=[],activeAsset=null,lastFocus=null,toastTimer,showHiddenBlocks=new Set(),assetFormSnapshot=null;
let migratedLegacyData=false;
try{const saved=nativeStore?nativeStore.data:JSON.parse(localStorage.getItem(key));if(saved&&Array.isArray(saved.blocks)&&Array.isArray(saved.assets)&&saved.blocks.every(b=>cats[b.id])){const migration=removeUntouchedDemo(saved);state=migration.board;migratedLegacyData=!!(migration.removed||migration.removedBlocks);}}catch{} if(!Array.isArray(state.deletedExternalIds))state.deletedExternalIds=[];
let saveSequence=0;
window.assetboardSaved=(sequence,success)=>{if(sequence!==saveSequence)return;if(!success)toast('本机文件保存失败，请保留窗口后重试');};
function save(){try{if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'save',sequence:++saveSequence,data:state});else localStorage.setItem(key,JSON.stringify(state));}catch{toast('未能保存，请保留此窗口');}}
function checkpoint(){history.push(JSON.stringify(state));if(history.length>25)history.shift();}
function toast(message,undoable=false){clearTimeout(toastTimer);const offer=undoable&&history.length;$('#toast').innerHTML=`<span>${esc(message)}</span>${offer?'<button class="toast-undo" data-action="undo">撤销</button>':''}`;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),offer?6000:3000);}
function undo(){if(!history.length){toast('没有可撤销的修改');return;}state=JSON.parse(history.pop());save();if(activeAsset&&!state.assets.some(a=>a.id===activeAsset))closeDetail();else if(activeAsset)showDetail(activeAsset);render();toast('已撤销上一次修改');}
function confirmDialog(title,message,confirmLabel,danger=false){return new Promise(resolve=>{modal(title,`<p class="form-note confirm-message">${esc(message).replaceAll('\n','<br>')}</p><div class="confirm-actions"><button class="button ${danger?'danger':'primary'}" id="confirm-yes">${esc(confirmLabel)}</button><button class="button" id="confirm-no">取消</button></div>`);const dialog=$('#modal');let settled=false;const finish=value=>{if(settled)return;settled=true;dialog.removeEventListener('close',cancel);resolve(value);},cancel=()=>finish(false);dialog.addEventListener('close',cancel);$('#confirm-yes').onclick=()=>{finish(true);dialog.close();};$('#confirm-no').onclick=()=>dialog.close();$('#confirm-no').focus();});}

function isHidden(a){return !!(a&&a.hiddenAt);}
function rememberDeleted(a){const key=assetSyncKey(a);if(!key)return;if(!Array.isArray(state.deletedExternalIds))state.deletedExternalIds=[];if(!state.deletedExternalIds.includes(key))state.deletedExternalIds.push(key);if(a.id&&!state.deletedExternalIds.includes(a.id))state.deletedExternalIds.push(a.id);}
function icon(type){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${icons[type]}</svg>`;}
function art(asset){
 if(typeof asset.iconData==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(asset.iconData)&&asset.iconData.length<400000)return `<div class="art custom-art" aria-hidden="true"><img src="${asset.iconData}" alt="" draggable="false"></div>`;
 const siteIcon=siteIconSrc(asset);if(siteIcon&&!assetProfiles[asset.type])return `<div class="art custom-art site-art" aria-hidden="true"><img src="${siteIcon}" alt="" draggable="false"></div>`;
 if(asset.source==='github'||asset.source==='cloudflare')return `<div class="art source-art" aria-hidden="true">${icon(asset.type)}</div>`;
 if(['note','orbit','build','rack','rack2','figma','claude','db','db2'].includes(asset.art))return `<div class="art" aria-hidden="true"><img src="assets/${asset.art}.png" alt="" width="320" height="320" draggable="false"></div>`;
 const wrap=(bg,body)=>`<div class="art" style="background:${bg}" aria-hidden="true"><svg viewBox="0 0 220 130" fill="none">${body}</svg></div>`;
 if(assetProfiles[asset.type]&&(!asset.art||asset.art==='generic'))return profileArt(asset,wrap);
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
function searchText(a){return [a.name,a.provider,a.purpose,a.reason,a.account,cats[a.type]?.name,regionName(a.region),a.region,a.network,a.last4,a.phone,String(a.phone||'').replace(/\D/g,'')].filter(Boolean).join(' ').toLowerCase();}
// Priority types draw what they are: a card with its network and tail, a SIM with its calling code, an account with its region flag.
function siteIconSrc(a){return typeof a?.siteIcon==='string'&&a.siteIcon.length<400000&&/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(a.siteIcon)?a.siteIcon:'';}
function assetMark(a){const src=siteIconSrc(a);return src?`<img class="site-mark" src="${src}" alt="" draggable="false">`:icon(a.type);}
function profileArt(a,wrap){
 const logo=siteIconSrc(a),flag=regionFlag(a.region),seedValue=[...String(a.id||a.name)].reduce((sum,letter)=>(sum*31+letter.charCodeAt(0))>>>0,7),tone=['#3f5d7a','#6a4f7d','#3d6b5b','#7c5a3c','#56663a','#7a3f4f'][seedValue%6],sans='font-family="Avenir Next,Helvetica,sans-serif"';
 const mark={'Visa':'VISA','Mastercard':'MASTERCARD','银联':'银联','American Express':'AMEX','JCB':'JCB','Discover':'DISCOVER'}[a.network]||'';
 if(a.type==='bankcard')return wrap('#e4e8ef',`<g transform="rotate(-4 110 65)"><rect x="35" y="17" width="150" height="96" rx="11" fill="${tone}"/>${logo?`<rect x="48" y="27" width="26" height="26" rx="6" fill="#fff"/><image href="${logo}" x="51" y="30" width="20" height="20"/>`:''}<rect x="50" y="${logo?60:40}" width="24" height="18" rx="4" fill="#e8d7a8"/><path d="M50 ${logo?69:49}h24M62 ${logo?60:40}v18" stroke="#c4ab70"/><text x="172" y="38" text-anchor="end" font-size="13" font-weight="700" fill="#fff" letter-spacing=".6" ${sans}>${esc(mark)}</text><text x="50" y="94" font-size="15" fill="#fff" letter-spacing="1.4" font-family="Menlo,monospace">•••• ${esc(a.last4||'····')}</text>${flag?`<text x="172" y="100" text-anchor="end" font-size="20" fill="#000">${flag}</text>`:''}</g>`);
 if(a.type==='phone'){const code=phoneParts(a.phone)?.code;return wrap('#e3ece7',`<path d="M80 8h46l20 20v88a8 8 0 0 1-8 8H80a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8Z" fill="${tone}"/><rect x="86" y="46" width="48" height="36" rx="6" fill="#e8d7a8"/><path d="M86 64h48M102 46v36M118 46v36" stroke="#c4ab70" stroke-width="1.2"/>${flag?`<text x="80" y="35" font-size="18" fill="#000">${flag}</text>`:''}<text x="109" y="109" text-anchor="middle" font-size="14" font-weight="600" fill="#fff" ${sans}>${code?'+'+code:''}</text>${logo?`<circle cx="146" cy="108" r="15" fill="#fff" stroke="${tone}" stroke-width="2"/><image href="${logo}" x="135" y="97" width="22" height="22"/>`:''}`);}
 if(a.type==='ai'&&logo)return wrap('#ece8f2',`<rect x="72" y="18" width="76" height="76" rx="18" fill="#fff"/><image href="${logo}" x="80" y="26" width="60" height="60"/>`);
 if(a.type==='ai')return wrap('#ece8f2',`<path d="M110 12c4 27 18 41 45 45-27 4-41 18-45 45-4-27-18-41-45-45 27-4 41-18 45-45Z" fill="#8f7ab8"/><path d="M158 14c1.4 9 5.6 13.6 14.6 15-9 1.4-13.2 6-14.6 15-1.4-9-5.6-13.6-14.6-15 9-1.4 13.2-6 14.6-15Z" fill="#b6a6d4"/>`);
 return wrap(a.type==='appleid'?'#eaeaf0':'#e6edf3',`<circle cx="110" cy="62" r="48" fill="${a.type==='appleid'?'#e9e9f1':'#e3ebf3'}"/>${flag?`<text x="110" y="81" text-anchor="middle" font-size="52" fill="#000">${flag}</text>`:`<text x="110" y="78" text-anchor="middle" font-size="42" font-family="Georgia" fill="#6f7a8a">${esc((a.name||'?').slice(0,1).toUpperCase())}</text>`}${logo?`<circle cx="148" cy="100" r="16" fill="#fff"/><image href="${logo}" x="137" y="89" width="22" height="22"/>`:`<circle cx="148" cy="100" r="15" fill="${tone}"/><g transform="translate(136 88)" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">${icons[a.type]}</g>`}`);
}
function matches(a){return !query||searchText(a).includes(query.toLowerCase());}
function safeManagementUrl(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&url.hostname&&!url.username&&!url.password?url.href:null;}catch{return null;}}
function displayName(a){return a.source==='github'&&a.name.includes('/')?a.name.slice(a.name.indexOf('/')+1):a.name;}
function eventInfo(a){if(a.syncMissing)return {text:'本次未返回',cls:'warn'};const status=assetDateStatus(a);if(status.level==='none')return {text:assetProfiles[a.type]?'':a.event||'日期待补充',cls:''};if(a.type==='bankcard'&&status.level==='upcoming')return {text:`有效期 ${expiryText(a.date)}`,cls:''};return {text:status.label,cls:status.level==='overdue'?'warn overdue':status.level==='soon'?'warn':''};}
function card(a,canDemote=false){const link=safeManagementUrl(a.url),event=eventInfo(a);return `<article class="asset-card" data-asset="${esc(a.id)}"><button class="card-open" data-action="detail" data-id="${esc(a.id)}" aria-label="查看 ${esc(a.name)} 详情" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight">${art(a)}<div class="card-copy"><span class="card-name" title="${esc(a.name)}">${esc(displayName(a))}</span>${cardLines(a)}</div></button><div class="card-foot">${event.text?`<span class="card-event ${event.cls}"><i class="dot"></i>${esc(event.text)}</span>`:''}${canDemote?`<button class="repo-swap" data-action="repo-swap" data-id="${esc(a.id)}" aria-label="将 ${esc(a.name)} 移到下方列表">移到列表</button>`:''}<button class="card-hide" data-action="hide-asset" data-id="${esc(a.id)}" aria-label="隐藏 ${esc(a.name)}">隐藏</button>${link&&new URL(link).hostname!=='example.com'?`<button class="open-link" data-action="external" data-id="${esc(a.id)}" aria-label="打开 ${esc(a.name)} 管理链接">↗</button>`:''}</div></article>`;}
// Priority types lead with region and a masked identifier; empty fields are left out instead of showing placeholders.
function cardLines(a){
 if(!assetProfiles[a.type])return `<span class="card-provider">${esc([a.provider,a.account].filter(Boolean).join(' · '))}</span>${a.purpose===cats[a.type].name?'':`<span class="card-purpose">${esc(a.purpose||'用途待补充')}</span>`}${linkChips(a)}`;
 const flag=regionFlag(a.region),identity={bankcard:[a.network,a.last4&&`•••• ${a.last4}`],phone:[maskPhone(a.phone)],appleid:[regionName(a.region)],google:[regionName(a.region)],ai:[a.cost&&a.cost!=='未知'?a.cost:'']}[a.type].filter(Boolean).join(' '),secondary={bankcard:a.provider,phone:a.provider,appleid:maskEmail(a.account),google:maskEmail(a.account),ai:[a.provider,maskEmail(a.account)].filter(Boolean).join(' · ')}[a.type];
 return `${identity||flag?`<span class="card-identity">${flag?`<span class="flag">${flag}</span>`:''}${esc(identity)}</span>`:''}${secondary?`<span class="card-provider">${esc(secondary)}</span>`:''}${a.purpose?`<span class="card-purpose">${esc(a.purpose)}</span>`:''}${linkChips(a)}`;
}
function linkLabel(a){const flag=regionFlag(a.region),digits=String(a.phone||'').replace(/\D/g,'');if(a.type==='bankcard'&&a.last4)return `${flag}•${a.last4}`;if(a.type==='phone'&&digits)return `${flag}•${digits.slice(-4)}`;return `${flag}${displayName(a)}`;}
function linkChips(a){const links=linkedAssets(state.assets,a).filter(x=>!isHidden(x));if(!links.length)return '';return `<span class="link-chips">${links.slice(0,3).map(x=>`<span class="link-chip">${assetMark(x)}${esc(linkLabel(x))}</span>`).join('')}${links.length>3?`<span class="link-chip">+${links.length-3}</span>`:''}</span>`;}
function identityText(a){return {bankcard:[a.network,a.last4&&`•••• ${a.last4}`],phone:[maskPhone(a.phone)],appleid:[maskEmail(a.account)],google:[maskEmail(a.account)],ai:[a.provider]}[a.type]?.filter(Boolean).join(' ')||a.provider||'';}
function flippedCard(a){return `<article class="asset-card flip-card" data-asset="${esc(a.id)}"><div class="flip-inner"><div class="flip-face front">${art(a)}<div class="card-copy"><span class="card-name">${esc(displayName(a))}</span></div></div><div class="flip-face back"><span class="flip-label">已隐藏</span><strong title="${esc(a.name)}">${esc(displayName(a))}</strong><span class="flip-note">仅在本机隐藏，可随时恢复；不表示退订或删除线上资源。</span><div class="flip-actions"><button class="button" data-action="restore-asset" data-id="${esc(a.id)}">恢复</button><button class="button" data-action="delete-asset" data-id="${esc(a.id)}">删除记录</button></div></div></div></article>`;}
function compactRepository(a){return `<div class="compact-repo" data-asset="${esc(a.id)}"><button class="compact-repo-open" data-action="detail" data-id="${esc(a.id)}" aria-label="查看 ${esc(a.name)} 详情" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight" title="${esc(a.name)}">${icon('repository')}<span>${esc(displayName(a))}</span></button><button class="repo-swap" data-action="repo-swap" data-id="${esc(a.id)}" aria-label="将 ${esc(a.name)} 显示为卡片">显示卡片</button></div>`;}
function renderBlock(b){
 const typed=state.assets.filter(a=>a.type===b.id&&matches(a));
 const hiddenCount=state.assets.filter(a=>a.type===b.id&&isHidden(a)).length;
 if(!hiddenCount)showHiddenBlocks.delete(b.id); // restoring or deleting the last hidden asset leaves the hidden view, which would otherwise have no way back
 const viewingHidden=showHiddenBlocks.has(b.id);
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
 <header class="block-head">
 <button class="block-title" data-action="collapse" data-id="${b.id}" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight" aria-expanded="${!collapsed}" aria-controls="cards-${b.id}" title="${collapsed?'展开资产卡片':'切换为图标与名称'}"><span>${cats[b.id].name}</span><span class="asset-count">${viewingHidden?hiddenCount:visible.length}</span><span class="chevron">${collapsed?'⌄':'⌃'}</span></button>
 ${summary&&!viewingHidden?`<span class="block-summary ${overdue?'overdue':''}">${summary}</span>`:''}
 <div class="block-actions">${hiddenToggle}<button class="text-button" data-action="all" data-id="${b.id}" aria-label="查看全部${cats[b.id].name}" hidden>查看全部</button><button class="icon-button" data-action="add-asset" data-id="${b.id}" aria-label="添加${cats[b.id].name}资产">＋</button><button class="icon-button" data-action="settings" data-id="${b.id}" aria-label="${cats[b.id].name}区块设置">⋯</button></div></header>
 <div class="cards" id="cards-${b.id}" ${fixed?`style="height:${b.height}px"`:''}>${cardsHtml||emptyHtml}</div>
 ${!collapsed&&!query&&!focusCategory?'<div class="resize-edge" data-edge="x" aria-hidden="true"></div><div class="resize-edge" data-edge="y" aria-hidden="true"></div><div class="resize-edge" data-edge="xy" aria-hidden="true"></div>':''}</section>`;
}
let layoutFrame=0,renderedQuery='',linkFocus=null,linkLayer=null;
function render(){
 clearLinks();
 if(typeof applyBoardTheme==='function'&&!themePreview)applyBoardTheme(state.theme);
 cancelAnimationFrame(layoutFrame);
 const previous=new Map([...document.querySelectorAll('.block')].map(el=>[el.dataset.block,el.getBoundingClientRect()]));
 const previousCards=query===renderedQuery?new Map([...document.querySelectorAll('#board [data-asset]')].map(el=>{const block=el.closest('.block');return [el.dataset.asset,{rect:el.getBoundingClientRect(),block:block?.dataset.block,origin:previous.get(block?.dataset.block)}];})):new Map();renderedQuery=query;
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
  const blocks=[...document.querySelectorAll('.block')].map(el=>({el,to:el.getBoundingClientRect()})),cards=[...document.querySelectorAll('#board [data-asset]')].map(el=>{const block=el.closest('.block');return {el,to:el.getBoundingClientRect(),block:block?.dataset.block,origin:block?.getBoundingClientRect()};});
  // Positions slide; sizes change in place so text is never stretched. Cards slide only within their block and only when their size is unchanged.
  for(const {el,to} of blocks){const from=previous.get(el.dataset.block);if(from&&to.width)slideFrom(el,from,240);}
  for(const {el,to,block,origin} of cards){const was=previousCards.get(el.dataset.asset);if(!was||was.block!==block||!was.origin||Math.abs(was.rect.width-to.width)>2||Math.abs(was.rect.height-to.height)>2)continue;const dx=(was.rect.left-was.origin.left)-(to.left-origin.left),dy=(was.rect.top-was.origin.top)-(to.top-origin.top);if(Math.abs(dx)>=1||Math.abs(dy)>=1)el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:240,easing:settleEase});}
 });
}
function syncToolbar(){const pending=pendingCount();$('#inbox-button').textContent=pending?`待确认 ${pending}`:'待确认';if(nativeStore)window.webkit.messageHandlers.assetboard.postMessage({action:'toolbarState',query,pending});}
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
 const grids=[...document.querySelectorAll('.block.fixed')].map(block=>{const grid=block.querySelector('.cards'),cards=[...grid.querySelectorAll('.asset-card:not(.is-dragging)')],style=getComputedStyle(grid),bottom=parseFloat(style.paddingBottom)||0;return {block,grid,cards,bottom,minHeight:(cards[0]?.offsetHeight||100)+(parseFloat(style.paddingTop)||0)+bottom};});
 for(const {grid,minHeight} of grids){const value=minHeight+'px';if(grid.style.minHeight!==value)grid.style.minHeight=value;}
 const visibility=grids.map(item=>{const limit=item.grid.offsetTop+item.grid.clientHeight-item.bottom+1;return {...item,hidden:item.cards.map(card=>card.offsetTop+card.offsetHeight>limit)};});
 for(const {block,cards,hidden} of visibility){cards.forEach((card,i)=>{const value=hidden[i]?'hidden':'';if(card.style.visibility!==value)card.style.visibility=value;if(card.inert!==hidden[i])card.inert=hidden[i];});const all=block.querySelector('[data-action="all"]');all.hidden=!hidden.some(Boolean);all.title='还有资产未显示，查看全部';}
}
function sourceLabel(a){if(a.syncMissing)return `${a.source==='github'?'GitHub':'Cloudflare'} 本次未返回`;if(a.source==='github')return `GitHub 仓库 · ${a.syncStatus||'状态未知'}`;if(a.source==='cloudflare')return `Cloudflare ${a.resourceKind||'Zone'} · ${a.syncStatus||'状态未知'}`;return a.source==='manual'?'手动录入':'演示资产';}
function dateText(a){const status=assetDateStatus(a);if(status.level==='none')return a.date||'待补充';return `${status.date} · ${status.label}${billingCycles[a.cycle]?` · ${billingCycles[a.cycle].label}重复`:''}`;}
function showDetail(id){const a=state.assets.find(a=>a.id===id);if(!a)return;lastFocus=document.activeElement;activeAsset=id;const link=safeManagementUrl(a.url),realLink=link&&new URL(link).hostname!=='example.com',lastSync=a.syncedAt&&!isNaN(Date.parse(a.syncedAt))?new Date(a.syncedAt).toLocaleString('zh-CN'):'';$('#detail-content').innerHTML=`${art(a)}<span class="eyebrow">${esc(cats[a.type].name)} / ASSET DETAILS</span><h2>${esc(a.name)}</h2><p class="detail-sub">${esc(assetProfiles[a.type]?[regionFlag(a.region),identityText(a)].filter(Boolean).join(' '):[a.provider,a.account].filter(Boolean).join(' · '))}</p>${a.purpose||!assetProfiles[a.type]?`<span class="detail-badge">${esc(a.purpose||'用途待补充')}</span>`:''}<div class="detail-actions">${realLink?`<button class="button primary" data-action="external" data-id="${esc(id)}">打开管理 ↗</button>`:''}<button class="button" data-action="edit-asset" data-id="${esc(id)}">编辑资料</button>${nativeStore?`<button class="button" data-action="icon-dialog" data-id="${esc(id)}">网站图标</button>`:''}</div><div class="detail-actions secondary-actions"><button class="button" data-action="${a.hiddenAt?'restore-asset':'hide-asset'}" data-id="${esc(id)}">${a.hiddenAt?'恢复显示':'隐藏'}</button><button class="button danger-quiet" data-action="delete-asset" data-id="${esc(id)}">删除记录</button></div><p class="form-note detail-note-inline">隐藏只在本机生效，可随时恢复；删除只清除 Assetboard 记录，不会取消订阅或删除线上资源。</p><div class="facts">${detailFacts(a,lastSync)}</div>${linkSection(a)}<details><summary>备注与来源</summary><p>${esc(a.notes||'暂无补充备注。')}</p>${a.source==='cloudflare'?'<p>同步自 Cloudflare 授权资源列表；列表元数据不能确定账单或到期日。编辑名称或账号后，下次同步会使用平台值。</p>':a.source==='github'?'<p>同步自 GitHub 仓库元数据；不读取代码、密钥或账单。编辑名称或账号后，下次同步会使用平台值。</p>':a.source==='manual'?'<p>此记录由你手动录入。</p>':'<p>此记录为原型演示数据，金额和日期不代表实际账户。</p>'}</details>`;$('#detail').hidden=false;$('#close-detail').focus();}
// Masked values reveal on request; the full value never appears on the board.
function secret(full,masked){return full&&masked&&masked!==full?`<span class="secret" data-full="${esc(full)}" data-masked="${esc(masked)}">${esc(masked)}</span><button class="text-button reveal" data-action="reveal" aria-pressed="false">显示</button>`:esc(full||'待补充');}
function detailFacts(a,lastSync){
 const row=([k,html])=>`<div class="fact"><span>${k}</span><span>${html}</span></div>`,text=value=>esc(value||'待补充');
 if(!assetProfiles[a.type])return [['保留原因',a.reason||'待补充'],['关联用途',a.purpose||'待补充'],['费用',a.cost||'未知'],['下一日期',dateText(a)],['账号',a.account],['记录状态',sourceLabel(a)],...(lastSync?[['最近同步',lastSync]]:[])].map(([k,v])=>row([k,esc(v)])).join('');
 const region=a.region?`${regionFlag(a.region)} ${regionName(a.region)}`:'',when=a.date?dateText(a):'';
 const rows={
  bankcard:[['地区',text(region)],['卡号',text(a.last4&&`•••• ${a.last4}`)],['卡组织',text(a.network)],['有效期',a.date?esc(`${expiryText(a.date)} · ${assetDateStatus(a).label}`):text('')],['发卡行',text(a.provider)],['账户备注',text(a.account)]],
  phone:[['地区',text(region)],['号码',secret(a.phone,maskPhone(a.phone))],['运营商',text(a.provider)],['保号',text(when)],['实名或用途',text(a.account)]],
  appleid:[['地区',text(region)],['登录邮箱',secret(a.account,maskEmail(a.account))]],
  google:[['地区',text(region)],['登录邮箱',secret(a.account,maskEmail(a.account))]],
  ai:[['服务',text(a.provider)],['费用',text(a.cost==='未知'?'':a.cost)],['下次扣款',text(when)],['登录账号',secret(a.account,maskEmail(a.account))]]
 }[a.type];
 return [...rows,...(a.reason?[['保留原因',esc(a.reason)]]:[]),['记录状态',esc(sourceLabel(a))]].map(row).join('');
}
function linkSection(a){
 const links=linkedAssets(state.assets,a);
 return `<section class="detail-links" aria-label="关联"><div class="detail-links-head"><strong>关联</strong><button class="text-button" data-action="link-picker" data-id="${esc(a.id)}">＋ 关联</button></div>${links.length?links.map(x=>`<div class="link-row"><button class="link-open" data-action="detail" data-id="${esc(x.id)}">${assetMark(x)}<span><b>${esc([regionFlag(x.region),displayName(x)].filter(Boolean).join(' '))}</b><small>${esc([cats[x.type].name,identityText(x),x.hiddenAt?'已隐藏':''].filter(Boolean).join(' · '))}</small></span></button><button class="icon-button" data-action="unlink" data-id="${esc(a.id)}" data-target="${esc(x.id)}" aria-label="取消关联 ${esc(x.name)}">×</button></div>`).join(''):`<p class="form-note">${esc(assetProfiles[a.type]?.links||'关联相关的资产，例如域名所在的服务器。')}</p>`}</section>`;
}
function linkPicker(id){
 const a=state.assets.find(x=>x.id===id);if(!a)return;
 const linked=new Set(linkedAssets(state.assets,a).map(x=>x.id)),order=linkOrder[a.type]||[],rank=type=>{const index=order.indexOf(type);return index<0?order.length:index;};
 const options=state.assets.filter(x=>x.id!==id&&!linked.has(x.id)).sort((left,right)=>rank(left.type)-rank(right.type)||left.name.localeCompare(right.name));
 modal(`关联到「${a.name}」`,`<input id="link-search" class="link-search" placeholder="搜索名称、尾号、号码或地区" aria-label="搜索要关联的资产"><div class="link-options">${options.map(x=>`<button class="link-option" data-action="link" data-id="${esc(id)}" data-target="${esc(x.id)}" data-search="${esc(searchText(x))}">${assetMark(x)}<span>${esc([regionFlag(x.region),displayName(x)].filter(Boolean).join(' '))}<small>${esc([cats[x.type].name,identityText(x)].filter(Boolean).join(' · '))}</small></span></button>`).join('')||'<p class="form-note">没有可以关联的其他资产。</p>'}</div>`);
 $('#link-search').oninput=e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('.link-option').forEach(option=>option.hidden=!!q&&!option.dataset.search.includes(q));};$('#link-search').focus();
}
// The Mac app downloads the icon from the site itself when asked; the page previews it and saves it only after confirmation.
let iconRequest=0,iconPreview=null;
function iconDialog(id){
 const a=state.assets.find(x=>x.id===id);if(!a||!nativeStore)return;
 const current=siteIconSrc(a);iconPreview=null;
 modal(`「${a.name}」的网站图标`,`<form id="icon-form" class="form" data-id="${esc(id)}"><label>网站域名<input name="host" required maxlength="253" autocomplete="off" value="${esc(a.siteIconHost||iconHost(a))}" placeholder="例如 wise.com"></label><div class="icon-preview" id="icon-preview" aria-live="polite">${current?`<img src="${current}" alt="当前图标">`:''}<span id="icon-status" class="form-note">${current?`当前图标来自 ${esc(a.siteIconHost||'网站')}。`:'图标直接从这个网站下载，不经过其他服务，只保存在此 Mac。'}</span></div><div class="confirm-actions"><button class="button" type="submit">获取</button><button class="button primary" type="button" data-action="icon-apply" data-id="${esc(id)}" disabled>使用这个图标</button>${a.siteIcon?`<button class="button danger-quiet" type="button" data-action="icon-remove" data-id="${esc(id)}">移除</button>`:''}</div></form>`);
 $('#icon-form [name="host"]').focus();
}
window.assetboardIconResult=result=>{
 if(result?.requestId!==iconRequest||!$('#icon-form'))return;
 $('#icon-form [type="submit"]').disabled=false;
 const valid=result.ok&&siteIconSrc({siteIcon:result.dataUrl});
 if(!valid){$('#icon-status').textContent=result.error||'没有获取到可用的图标。';return;}
 iconPreview={host:String(result.host||''),dataUrl:result.dataUrl};
 $('#icon-preview').innerHTML=`<img src="${result.dataUrl}" alt="获取到的图标"><span id="icon-status" class="form-note">来自 ${esc(iconPreview.host)}。确认后替换卡片上的图标。</span>`;
 $('[data-action="icon-apply"]').disabled=false;$('[data-action="icon-apply"]').focus();
};
document.addEventListener('submit',e=>{if(e.target.id!=='icon-form')return;e.preventDefault();const host=e.target.elements.host.value.trim();if(!host||!nativeStore)return;iconPreview=null;$('[data-action="icon-apply"]').disabled=true;e.target.querySelector('[type="submit"]').disabled=true;$('#icon-status').textContent=`正在从 ${host} 获取…`;window.webkit.messageHandlers.assetboard.postMessage({action:'iconFetch',requestId:++iconRequest,host});});
function closeDetail(){ $('#detail').hidden=true;activeAsset=null;if(lastFocus?.isConnected)lastFocus.focus();}
function modal(title,html,view=''){$('#modal-title').textContent=title;$('#modal-content').innerHTML=html;$('#modal').dataset.view=view;if(!html.includes('id="asset-form"')&&!html.includes("id='asset-form'")&&!html.includes('id="dirty-save"'))assetFormSnapshot=null;if(nativeStore)$('#modal-content').querySelectorAll('.form-note').forEach(el=>{if(el.textContent.includes('浏览器'))el.textContent=el.textContent.replaceAll('当前浏览器','此 Mac').replaceAll('此浏览器','此 Mac');});if(!$('#modal').open)$('#modal').showModal();}
function addBlock(){modal('给大板添一个区块',Object.entries(cats).map(([id,c])=>`<button class="category-choice" data-action="choose-block" data-id="${id}" ${state.blocks.some(b=>b.id===id)?'disabled':''}><span>${c.symbol}</span><span>${c.name}<small>${c.hint}</small></span><span class="plus">${state.blocks.some(b=>b.id===id)?'✓':'＋'}</span></button>`).join('')+'<p class="form-note">区块按类别展示已有资产。添加后可以自由移动、调整大小。</p>');}
function manualImport(){modal('选择资产类别',Object.entries(cats).map(([id,c])=>`<button class="category-choice" data-action="choose-asset-type" data-id="${id}"><span>${c.symbol}</span><span>${c.name}<small>${c.hint}</small></span><span class="plus">＋</span></button>`).join(''));}

function snapshotAssetForm(form){if(!form)return null;const data=new FormData(form);const values={};for(const [k,v] of data.entries()){if(k==='icon')continue;values[k]=String(v);}return {id:form.dataset.id||'',type:form.dataset.type||'',values,hadFile:false};}
function isAssetFormDirty(){const form=$('#asset-form');if(!form||!assetFormSnapshot)return false;if(form.elements.icon?.files?.length)return true;const data=new FormData(form);for(const key of Object.keys(assetFormSnapshot.values)){if(String(data.get(key)??'')!==assetFormSnapshot.values[key])return true;}for(const [k] of data.entries()){if(k==='icon'||k==='removeIcon')continue;if(!(k in assetFormSnapshot.values)&&String(data.get(k)??''))return true;}if(form.elements.removeIcon?.checked)return true;return false;}
function requestCloseModal(){if(isAssetFormDirty()){const resumeTitle=$('#modal-title').textContent,resumeView=$('#modal').dataset.view,live=[...$('#modal-content').childNodes],baseline=assetFormSnapshot;modal('未保存的修改',`<p class="form-note">表单有未保存的内容。可以保存、放弃修改，或继续编辑。</p><div class="dirty-actions"><button class="button primary" id="dirty-save">保存</button><button class="button" id="dirty-discard">放弃</button><button class="button" id="dirty-keep">继续编辑</button></div>`);const resume=()=>{$('#modal-title').textContent=resumeTitle;$('#modal').dataset.view=resumeView;$('#modal-content').replaceChildren(...live);assetFormSnapshot=baseline;};$('#dirty-save').onclick=()=>{resume();$('#asset-form').requestSubmit();};$('#dirty-discard').onclick=()=>{assetFormSnapshot=null;$('#modal').close();};$('#dirty-keep').onclick=resume;return;}assetFormSnapshot=null;$('#modal').close();}
function assetForm(type,id,fill={},candidateKey='',candidateItem=null){const a=id?state.assets.find(a=>a.id===id):null,v={...(a||{}),...fill},link=safeManagementUrl(v.url),synced=['cloudflare','github'].includes(a?.source),kind=dateKinds[v.dateKind]?v.dateKind:'expire';modal(a?'编辑资产资料':`添加${cats[type].name}资产`,`<form id="asset-form" class="form" data-type="${type}" data-id="${id||''}" data-candidate="${esc(candidateKey)}" data-item="${candidateItem??''}"><label>资产名称<input name="name" required maxlength="100" value="${esc(v.name||'')}" placeholder="${assetProfiles[type]?.name||'例如 my-project.dev'}"></label>${synced?'':`<label>类别<select name="type">${Object.entries(cats).map(([key,c])=>`<option value="${key}" ${key===type?'selected':''}>${c.name}</option>`).join('')}</select></label>`}<div id="profile-fields" class="profile-fields">${profileFields(type,v)}</div><label>用途<input name="purpose" maxlength="100" value="${esc(v.purpose||'')}" placeholder="它用来做什么？"></label><label>保留原因<input name="reason" maxlength="120" value="${esc(v.reason||'')}" placeholder="为什么还留着它？例如：客户站点仍在使用"></label><label>费用说明<input name="cost" maxlength="80" value="${esc(v.cost==='未知'?'':v.cost||'')}" placeholder="例如 ¥ 89 / 年"></label><label>管理链接<input name="url" type="url" maxlength="2000" value="${esc(link&&new URL(link).hostname!=='example.com'?link:'')}" placeholder="https://..." pattern="https?://.*"></label><label>自定义图标<input name="icon" type="file" accept="image/png,image/jpeg,image/webp"></label>${a?.iconData?'<label class="check-label"><input name="removeIcon" type="checkbox">移除当前自定义图标</label>':''}<span class="form-note">PNG、JPEG 或 WebP，最大 256 KB。图标随本机资产备份保存。</span><label>备注<textarea name="notes" rows="3" maxlength="2000">${esc(v.notes||'')}</textarea></label><button class="button primary" type="submit">${a?'保存修改':'添加资产'}</button><span class="form-note">资产资料仅保存在${nativeStore?'此 Mac':'此浏览器'}；管理链接会在系统浏览器中打开。</span></form>`);const form=$('#asset-form');assetFormSnapshot=snapshotAssetForm(form);
 form.elements.type?.addEventListener('change',e=>{const values=Object.fromEntries(new FormData(form));if('expiry' in values)values.date=cardExpiry(values.expiry)||'';form.dataset.type=e.target.value;$('#profile-fields').innerHTML=profileFields(e.target.value,values);form.elements.name.placeholder=assetProfiles[e.target.value]?.name||'例如 my-project.dev';});
 form.addEventListener('input',e=>{if(e.target.name!=='phone')return;const region=form.elements.region,code=regionFromPhone(e.target.value);if(region&&code&&!region.value)region.value=code;});
}
// Fields that depend on the category; rebuilt in place when the category select changes.
function profileFields(type,v){
 const p=assetProfiles[type]||{},extra=p.extra||[],kind=dateKinds[v.dateKind]?v.dateKind:p.dateKind||'expire',cycle=v.cycle??p.cycle??'';
 const provider=p.fixedProvider?'':`<label>${p.provider?.[0]||'平台'}<input name="provider" maxlength="80" value="${esc(v.provider==='平台待补充'?'':v.provider||'')}" placeholder="${p.provider?.[1]||'例如 Cloudflare'}"></label>`;
 const account=`<label>${p.account?.[0]||'账号'}<input name="account" maxlength="100" autocomplete="off" value="${esc(v.account||'')}" placeholder="${p.account?.[1]||'用于区分同平台的账号'}"></label>`;
 const region=extra.includes('region')?`<label>国家 / 地区<select name="region"><option value="">未设置</option>${regionList.map(([code,name])=>`<option value="${code}" ${code===v.region?'selected':''}>${regionFlag(code)} ${name}</option>`).join('')}</select></label>`:'';
 const phone=extra.includes('phone')?`<label>完整号码<input name="phone" type="tel" inputmode="tel" maxlength="30" autocomplete="off" value="${esc(v.phone||'')}" placeholder="+44 7700 900123"></label><span class="form-note">以 + 和国家区号开头时会自动识别地区。卡片上只显示区号和后 4 位。</span>`:'';
 const card=extra.includes('last4')?`<div class="field-row"><label>卡号后 4 位<input name="last4" inputmode="numeric" pattern="\\d{4}" maxlength="4" autocomplete="off" value="${esc(v.last4||'')}" placeholder="1234"></label><label>卡组织<select name="network"><option value="">未设置</option>${cardNetworks.map(network=>`<option ${network===v.network?'selected':''}>${network}</option>`).join('')}</select></label><label>有效期<input name="expiry" maxlength="7" autocomplete="off" placeholder="MM/YY" pattern="\\s*(0?[1-9]|1[0-2])\\s*/\\s*(\\d{2}|\\d{4})\\s*" value="${esc(expiryText(v.date))}"></label></div>`:'';
 const dates=type==='bankcard'?'':`<div class="field-row"><label>${p.date||'下一日期'}<input type="date" name="date" value="${esc(v.date||'')}"></label><label>日期类型<select name="dateKind">${Object.entries(dateKinds).map(([key,k])=>`<option value="${key}" ${key===kind?'selected':''}>${k.label}</option>`).join('')}</select></label><label>重复<select name="cycle"><option value="">不重复</option>${Object.entries(billingCycles).map(([key,c])=>`<option value="${key}" ${key===cycle?'selected':''}>${c.label}</option>`).join('')}</select></label></div><span class="form-note">设为重复后，日期过去会自动顺延到下一次。</span>`;
 return provider+account+region+phone+card+dates+(p.note?`<span class="form-note form-warning">${p.note}</span>`:'');
}
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
 renderAgenda();const next=afterEvidence;afterEvidence=null;
 if(next)next();else if($('#modal').open&&$('#modal').dataset.view==='inbox')inboxDialog(false);
};
// A person's own model endpoint. Swift keeps the key and sends the request; the page only receives reply text.
const aiRequests=new Map(),aiBusy=new Set(),aiErrors=new Map();let aiSequence=0,aiBatchState=null;
const aiProviders={anthropic:{label:'Anthropic Claude',baseURL:'https://api.anthropic.com',model:'claude-opus-5-5'},openai:{label:'OpenAI 兼容接口（OpenAI、通义千问、Kimi、本机 Ollama 等）',baseURL:'',model:''}};
function aiLocal(host){return ['localhost','127.0.0.1','::1','[::1]'].includes(String(host||'').toLowerCase());}
function aiReady(){const ai=nativeStore?.ai;return !!(ai?.model&&(nativeStore.aiKeySaved||aiLocal(ai.host)));}
function aiRequest(params){return new Promise(resolve=>{const requestId=++aiSequence;aiRequests.set(requestId,resolve);window.webkit.messageHandlers.assetboard.postMessage({action:'aiRecognize',requestId,...params});});}
function aiDialog(){
 if(!nativeStore){toast('AI 识别仅在 macOS App 中可用');return;}
 const ai=nativeStore.ai||{},provider=ai.provider||'anthropic',preset=aiProviders[provider];
 modal('AI 识别 · 使用你自己的 API key',`<form class="form" id="ai-form"><p class="form-note">默认只用本机规则识别。配置后，你在“待确认”中选择用 AI 识别时，Assetboard 会把那份资料（邮件的发件人、标题和正文，或截图原图）从此 Mac 直接发送到下面的接口，不经过 Assetboard 的服务器。费用与数据处理按该服务和你账号的条款。</p><label>服务类型<select name="provider">${Object.entries(aiProviders).map(([key,p])=>`<option value="${key}" ${key===provider?'selected':''}>${p.label}</option>`).join('')}</select></label><label>接口地址<input name="baseURL" required maxlength="300" value="${esc(ai.baseURL||preset.baseURL)}" placeholder="https://api.openai.com/v1"></label><label>模型<input name="model" required maxlength="120" value="${esc(ai.model||preset.model)}" placeholder="填写服务商提供的、支持图片的模型名"></label><label>${nativeStore.aiKeySaved?'更换 API key（留空则继续使用已保存的）':'API key'}<input name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${nativeStore.aiKeySaved?'留空使用已保存的 key':'粘贴 API key'}"></label><label class="check-label"><input type="checkbox" name="autoImages" ${ai.autoImages===false?'':'checked'}>导入截图后自动用 AI 识别图片</label><p id="ai-status" class="form-note">${ai.model?`已配置 · ${esc(ai.model)} · ${esc(ai.host)}${nativeStore.aiKeySaved||aiLocal(ai.host)?'':' · 钥匙串中没有 API key'}`:'尚未配置'}</p><button class="button primary" type="submit">验证并保存</button>${ai.model?'<button class="button" type="button" data-action="ai-disconnect">删除 AI 设置与 API key</button>':''}<p class="form-note">保存前会发送一条很短的测试请求。API key 保存在 macOS 钥匙串，网页界面读不到它。接口地址填本机服务（如 http://127.0.0.1:11434/v1）时可以不填 key，资料不会离开此 Mac。</p></form>`,'ai');
 const form=$('#ai-form');let previous=provider;
 form.elements.provider.onchange=()=>{const from=aiProviders[previous],to=aiProviders[form.elements.provider.value];for(const name of ['baseURL','model'])if(!form.elements[name].value||form.elements[name].value===from[name])form.elements[name].value=to[name];previous=form.elements.provider.value;};
}
document.addEventListener('submit',e=>{if(e.target.id!=='ai-form')return;e.preventDefault();const form=e.target;form.querySelector('[type="submit"]').disabled=true;$('#ai-status').textContent='正在发送测试请求…';window.webkit.messageHandlers.assetboard.postMessage({action:'aiSave',provider:form.elements.provider.value,baseURL:form.elements.baseURL.value,model:form.elements.model.value,apiKey:form.elements.apiKey.value,autoImages:form.elements.autoImages.checked});form.elements.apiKey.value='';});
window.assetboardAIResult=result=>{
 if(result.kind==='settings'){
  if(!result.ok){const status=$('#ai-status');if(status)status.textContent=result.error||'验证失败';const button=$('#ai-form [type="submit"]');if(button)button.disabled=false;return;}
  const closeSettings=()=>{if($('#modal').open&&$('#modal').dataset.view==='ai')$('#modal').close();};
  if(result.disconnected){nativeStore.ai=null;nativeStore.aiKeySaved=false;closeSettings();toast('已删除 AI 设置与本机保存的 API key');return;}
  nativeStore.ai=result.ai;nativeStore.aiKeySaved=!!result.aiKeySaved;closeSettings();toast(`AI 识别已可用 · ${result.ai.model}`);return;
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
 renderAgenda();refreshReview(key,0);
}
function aiProgressText(){return `AI 识别中 ${aiBatchState.done}/${aiBatchState.total}${aiBatchState.stop?' · 正在停止':''}`;}
async function aiBatch(){
 if(!aiReady()||aiBatchState)return;
 const targets=candidates().filter(c=>c.pending&&!c.ai).slice(0,100);
 if(!targets.length){toast('待确认的资料都已用 AI 识别过');return;}
 const ok=await confirmDialog('用 AI 识别待确认资料？',`将依次把 ${targets.length} 组资料中最近的一份（邮件的发件人、标题和正文，或截图）发送到 ${nativeStore.ai.host}，共 ${targets.length} 次请求，费用由该服务按你的账号计。\n一次最多处理 100 组，可随时停止。`,`识别 ${targets.length} 组`);
 if(!ok){inboxDialog(false);return;}
 aiBatchState={done:0,total:targets.length,stop:false};inboxDialog(false);
 let failure='';
 for(const c of targets){if(aiBatchState.stop)break;const result=await aiRequest({evidenceId:c.latest.id});if(!result.ok){failure=result.error||'AI 识别失败';break;}aiBatchState.done++;const progress=$('#ai-progress');if(progress)progress.textContent=aiProgressText();}
 const done=aiBatchState.done;aiBatchState=null;renderAgenda();
 if($('#modal').open&&$('#modal').dataset.view==='inbox')inboxDialog(false);
 toast(failure?`已识别 ${done} 组后停止：${failure}`:`AI 已识别 ${done} 组，请逐组核对`);
}
function recordedItems(c){return c.key==='paste'?[...pasteRecorded]:(state.evidenceDecisions||{})[c.ai?.rowId]?.recorded||[];}
function candidateView(c,index){const items=c.ai?.items||[];return index>0&&items[index]?applyAiItem(c.base,items[index],{assets:state.assets,fallback:false}):c;}
function aiSection(c,index){
 if(!nativeStore)return '';
 if(!aiReady())return '<p class="form-note ai-note">识别不准时，可以<button type="button" class="text-button inline-button" data-action="ai-settings">配置 AI 识别</button>，使用你自己的 API key。</p>';
 const items=c.ai?.items||[],recorded=recordedItems(c),busy=aiBusy.has(c.key),error=aiErrors.get(c.key);
 const sending=c.key==='paste'?'粘贴的文字':c.latest.kind==='ocr'?'这张截图（原文件不在时发送识别出的文字）':'这封邮件的发件人、标题和正文';
 const status=c.ai?c.ai.unreadable?'AI 的回复无法解析，仍显示本机规则的识别结果。':items.length?`AI（${c.ai.model}）找到 ${items.length} 项${items.length>1?'，选择要记录的一项：':'。'}`:'AI 没有在这份资料中找到资产信息。':'';
 const list=items.length>1?`<div class="ai-items">${items.map((item,i)=>{const view=candidateView(c,i);return `<label class="check-label ai-item"><input type="radio" name="ai-item" value="${i}" data-action="ai-item" data-id="${esc(c.key)}" ${i===index?'checked':''}><span>${esc(view.name||view.merchant)}${view.cost?` · ${esc(view.cost)}`:''}${view.date?` · ${esc(view.date.value)}`:''}${recorded.includes(i)?' · 已记录':''}</span></label>`;}).join('')}</div>`:'';
 return `<div class="ai-panel">${status?`<p class="form-note">${esc(status)}</p>`:''}${list}<button type="button" class="button" data-action="ai-recognize" data-id="${esc(c.key)}" ${busy?'disabled':''}>${busy?'AI 识别中…':c.ai?'重新用 AI 识别':'用 AI 识别'}</button><p class="form-note">会把${sending}发送到 ${esc(nativeStore.ai.host)}。</p>${error?`<p class="form-note ai-error">${esc(error)}</p>`:''}</div>`;
}
function candidateChips(c){const match=c.match&&state.assets.find(a=>a.id===c.match);return [c.ai&&!c.ai.unreadable&&'<span class="chip ai">AI</span>',`<span class="chip">${esc(cats[c.type].name)}</span>`,c.cost&&`<span class="chip">${esc(c.cost)}</span>`,c.date&&`<span class="chip ${c.date.source}">${esc(c.date.value)} ${esc(dateKinds[c.date.kind].label)}${c.date.source==='inferred'?' · 推算':''}</span>`,match&&`<span class="chip match">可能对应 ${esc(displayName(match))}</span>`,c.ai?.items.length>1&&`<span class="chip">共 ${c.ai.items.length} 项</span>`].filter(Boolean).join('');}
function decisionLabel(c){const decision=(state.evidenceDecisions||{})[c.ids[0]],asset=decision?.assetId&&state.assets.find(a=>a.id===decision.assetId);return decision?.status==='dismissed'?'已忽略':`${decision?.status==='linked'?'已补充到':'已新建'}${asset?` ${displayName(asset)}`:'资产'}`;}
function candidateRow(c){return `<article class="candidate ${c.pending?'':'resolved'}"><div class="candidate-main"><strong>${esc([c.merchant||c.latest.title||'未识别来源',c.name&&c.name!==c.merchant?c.name:''].filter(Boolean).join(' · '))}</strong><span class="candidate-meta">${esc(evidenceKinds[c.latest.kind]||'导入资料')}${c.count>1?` · ${c.count} 封`:''}${c.latest.day!=null?` · 最近 ${isoDay(c.latest.day)}`:''}</span><div class="chips">${candidateChips(c)}</div></div><div class="candidate-actions">${c.pending?`<button class="button" data-action="candidate-review" data-id="${esc(c.key)}">核对</button><button class="text-button" data-action="candidate-dismiss" data-id="${esc(c.key)}">忽略</button>`:`<span class="candidate-status">${esc(decisionLabel(c))}</span><button class="text-button" data-action="candidate-review" data-id="${esc(c.key)}">查看</button><button class="text-button" data-action="candidate-reopen" data-id="${esc(c.key)}">恢复待确认</button>`}</div></article>`;}
function inboxDialog(refresh=true){
 const list=candidates(),pending=list.filter(c=>c.pending),strong=pending.filter(c=>!c.weak),weak=pending.filter(c=>c.weak),resolved=list.filter(c=>!c.pending);
 const paste=`<form class="form inbox-paste" id="paste-form"><label>粘贴续费通知、账单或收据的文字<textarea id="paste-text" rows="3" placeholder="例如：Your plan renews on October 6, 2026 for $15.00/month"></textarea></label><button class="button primary" type="submit">识别</button><span class="form-note">先在${nativeStore?'此 Mac':'此浏览器'}按规则识别，不上传；确认前不会写入资产。</span></form>`;
 const aiControls=!nativeStore?'':aiBatchState?`<span id="ai-progress" class="candidate-meta">${aiProgressText()}</span><button class="text-button" data-action="ai-stop">停止</button>`:aiReady()?`${pending.some(c=>!c.ai)?'<button class="text-button" data-action="ai-batch">用 AI 识别全部</button>':''}<button class="text-button" data-action="ai-settings">AI 设置</button>`:'<button class="text-button" data-action="ai-settings">配置 AI 识别</button>';
 const imported=nativeStore||evidenceRows.length?`<div class="inbox-head"><strong>待确认 · ${strong.length}</strong><span>${aiControls}${nativeStore?'<button class="text-button" data-action="gmail-import">导入 Gmail</button><button class="text-button" data-action="ocr-import">识别截图/PDF</button>':''}</span></div>${strong.length?strong.slice(0,100).map(candidateRow).join(''):`<p class="form-note">${evidenceRows.length?'没有待确认的资料。':'还没有导入资料。可以导入 Gmail 账单通知，或识别截图/PDF。'}</p>`}${weak.length?`<details class="inbox-more"><summary>另有 ${weak.length} 组未识别出金额或日期</summary>${weak.slice(0,100).map(candidateRow).join('')}<button class="text-button" data-action="dismiss-weak">全部忽略</button></details>`:''}${resolved.length?`<details class="inbox-more"><summary>已处理 ${resolved.length} 组</summary>${resolved.slice(0,100).map(candidateRow).join('')}</details>`:''}`:'';
 modal('待确认资料',`<div class="inbox">${paste}${imported}</div>`,'inbox');
 if(refresh&&nativeStore)requestEvidence();
}
function refreshReview(key,index){const dialog=$('#modal');if(!dialog.open||dialog.dataset.view!=='review'||dialog.dataset.key!==key)return;const c=findCandidate(key);if(c)candidateReview(c,index??(Number(dialog.dataset.index)||0));}
function candidateReview(c,index=0){
 const items=c.ai?.items||[];if(!items[index])index=0;
 const view=candidateView(c,index),row=c.key==='paste'?pasteRow:evidenceRows.find(item=>item.id===(c.ai?.rowId||c.latest.id)),match=view.match&&state.assets.find(a=>a.id===view.match);
 const others=state.assets.filter(a=>a.id!==view.match).sort((left,right)=>left.name.localeCompare(right.name));
 const option=a=>`<option value="${esc(a.id)}">补充到：${esc(displayName(a))} · ${esc(cats[a.type].name)}</option>`;
 const facts=[['来源',`${evidenceKinds[c.latest.kind]||'导入资料'}${view.merchant?` · ${view.merchant}`:''}${c.count>1?` · ${c.count} 封`:''}`],['类别推测',cats[view.type].name],['名称',view.name||'待填写'],...(view.account?[['账号',view.account]]:[]),['金额',view.cost||'未识别'],['日期',view.date?`${view.date.value} ${dateKinds[view.date.kind].label}`:'未识别'],...(view.date?[['日期依据',view.date.basis]]:[]),...(view.quote?[['原文依据',view.quote]]:[]),...(!c.ai&&view.domains.length?[['提到的域名',view.domains.slice(0,3).join('、')]]:[])];
 modal('核对识别结果',`<div class="form candidate-review">${view.weak&&!c.ai?'<p class="form-note">没有识别出金额或日期。可以直接新建，再手动填写。</p>':''}<div class="facts">${facts.map(([k,v])=>`<div class="fact"><span>${k}</span><span>${esc(v)}</span></div>`).join('')}</div>${aiSection(c,index)}<label>记录到<select id="candidate-target">${match?option(match):''}<option value="">新建一项资产</option>${others.map(option).join('')}</select></label><div class="confirm-actions"><button class="button primary" data-action="candidate-apply" data-id="${esc(c.key)}" data-index="${index}">下一步：核对资料</button><button class="button" data-action="candidate-dismiss" data-id="${esc(c.key)}">${c.key==='paste'?'放弃':'忽略'}</button></div>${row?`<details><summary>原文 · ${esc(row.title)}</summary><pre class="imported-text">${esc(String(row.body).slice(0,4000))}</pre></details>`:''}<button class="text-button inbox-back" data-action="inbox">← 返回待确认</button></div>`,'review');
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
function settings(id){const b=state.blocks.find(b=>b.id===id);if(!b)return;modal(`${cats[id].name} · 区块设置`,`<div class="form"><label>区块宽度 · <span id="range-value">${Math.round(b.width)}%</span><input id="block-width" type="range" min="25" max="100" value="${b.width}" aria-label="区块宽度"></label><label>展示高度<select id="block-height"><option value="">随内容自适应</option><option value="240" ${b.height===240?'selected':''}>约一行卡片</option><option value="480" ${b.height===480?'selected':''}>约两行卡片</option></select></label><p class="form-note">这里是键盘与触屏的快捷设置。在大板上也可以直接拖动区块的右边或下边调整大小，拖动标题栏移动位置；选中标题后按 ⌥ + 方向键同样可以移动。</p><button class="button primary" data-action="save-settings" data-id="${id}">应用设置</button></div><div class="settings-actions"><button class="button" data-action="move-up" data-id="${id}">向前移动</button><button class="button" data-action="move-down" data-id="${id}">向后移动</button><button class="button" data-action="remove-block" data-id="${id}">从大板移除</button></div><p class="form-note">移除区块不删除资产，重新添加该类别即可找回。</p>`);$('#block-width').oninput=e=>$('#range-value').textContent=e.target.value+'%';}
document.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(!button)return;const {action,id}=button.dataset;
 if(action==='detail'){if($('#modal').open)$('#modal').close();showDetail(id);}
 else if(action==='undo')undo();
 else if(action==='reveal'){const value=button.previousElementSibling,shown=button.getAttribute('aria-pressed')==='true';value.textContent=shown?value.dataset.masked:value.dataset.full;button.setAttribute('aria-pressed',String(!shown));button.textContent=shown?'显示':'隐藏';}
 else if(action==='link-picker')linkPicker(id);
 else if(action==='icon-dialog')iconDialog(id);
 else if(action==='icon-apply'){const a=state.assets.find(x=>x.id===id);if(!a||!iconPreview)return;checkpoint();a.siteIcon=iconPreview.dataUrl;a.siteIconHost=iconPreview.host;save();$('#modal').close();render();if(activeAsset===id)showDetail(id);toast('已使用网站图标',true);}
 else if(action==='icon-remove'){const a=state.assets.find(x=>x.id===id);if(!a?.siteIcon)return;checkpoint();delete a.siteIcon;delete a.siteIconHost;save();$('#modal').close();render();if(activeAsset===id)showDetail(id);toast('已移除网站图标',true);}
 else if(action==='link'){$('#modal').close();checkpoint();if(!linkAssets(state.assets,id,button.dataset.target)){history.pop();return;}save();render();showDetail(id);toast('已关联',true);}
 else if(action==='unlink'){checkpoint();if(!unlinkAssets(state.assets,id,button.dataset.target)){history.pop();return;}save();render();showDetail(id);toast('已取消关联',true);}
 else if(action==='inbox')inboxDialog();
 else if(action==='agenda-all')agendaAll();
 else if(action==='close-modal')$('#modal').close();
 else if(action==='apply-collisions'){const chosen=[...document.querySelectorAll('input[name="collision"]:checked')].map(input=>pendingCollisions[Number(input.value)]).filter(Boolean);$('#modal').close();if(!chosen.length)return;checkpoint();const applied=chosen.filter(item=>applyCollision(state,item)).length;pendingCollisions=[];save();render();toast(`已用同步结果覆盖 ${applied} 条本地记录`,true);}
 else if(action==='candidate-review'){const c=findCandidate(id);if(c)candidateReview(c);}
 else if(action==='candidate-apply'){const c=findCandidate(id);if(!c)return;const index=Number(button.dataset.index)||0,target=$('#candidate-target').value,existing=target&&state.assets.find(a=>a.id===target);assetForm(existing?existing.type:candidateView(c,index).type,existing?existing.id:null,candidateFill(c,existing,index),c.key,index);}
 else if(action==='ai-settings')aiDialog();
 else if(action==='ai-disconnect')window.webkit.messageHandlers.assetboard.postMessage({action:'aiDisconnect'});
 else if(action==='ai-recognize')aiRecognizeCandidate(id);
 else if(action==='ai-batch')aiBatch();
 else if(action==='ai-stop'){if(aiBatchState){aiBatchState.stop=true;const progress=$('#ai-progress');if(progress)progress.textContent=aiProgressText();}}
 else if(action==='ai-item'){const c=findCandidate(id);if(c)candidateReview(c,Number(button.value)||0);}
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
 else if(action==='restore-asset'){const a=state.assets.find(a=>a.id===id),fromBoard=!!button.closest('#board');if(!a)return;checkpoint();delete a.hiddenAt;save();if(activeAsset===id)showDetail(id);render();if(fromBoard)(document.querySelector(`#board [data-asset="${CSS.escape(id)}"] .card-open`)||document.querySelector(`#board .block[data-block="${a.type}"] [data-action="restore-asset"]`))?.focus();toast('已恢复显示',true);}
 else if(action==='delete-asset'){const a=state.assets.find(a=>a.id===id);if(!a)return;confirmDialog('删除这条记录？',`将删除「${a.name}」在 Assetboard 中的记录。\n不会取消订阅，也不会删除 Cloudflare / GitHub 等平台上的资源；之后同步也不会自动加回。`,'删除记录',true).then(ok=>{const a=state.assets.find(a=>a.id===id);if(!ok||!a)return;checkpoint();rememberDeleted(a);state.assets=state.assets.filter(x=>x.id!==id);removeLinksTo(state.assets,id);if(Array.isArray(state.featuredRepositoryIds))state.featuredRepositoryIds=state.featuredRepositoryIds.filter(x=>x!==id);if(state.cardOrder){for(const key of Object.keys(state.cardOrder))state.cardOrder[key]=(state.cardOrder[key]||[]).filter(x=>x!==id);}if(activeAsset===id)closeDetail();save();render();toast('记录已删除 · 同步不会自动加回',true);});}
 else if(action==='remove-block'){checkpoint();state.blocks=state.blocks.filter(b=>b.id!==id);showHiddenBlocks.delete(id);if(focusCategory===id)focusCategory=null;save();$('#modal').close();render();toast('区块已移除，资产仍被保留',true);}
 else if(action==='move-up'||action==='move-down'){moveBlock(id,action==='move-up'?-1:1);$('#modal').close();}
});
document.addEventListener('submit',async e=>{if(e.target.id!=='asset-form')return;e.preventDefault();const form=e.target,data=new FormData(form),name=String(data.get('name')).trim(),url=String(data.get('url')).trim(),file=form.elements.icon.files[0];if(!name)return;const leaked=['name','provider','account','purpose','reason','cost','notes'].find(key=>looksLikeCardNumber(data.get(key)));if(leaked){const input=form.elements[leaked];input.setCustomValidity('这里像是完整卡号。Assetboard 只保存卡号后 4 位，请删掉后再保存。');input.reportValidity();input.addEventListener('input',()=>input.setCustomValidity(''),{once:true});return;}if(url&&!safeManagementUrl(url)){form.elements.url.setCustomValidity('请输入不含账号密码的 http 或 https 链接');form.elements.url.reportValidity();return;}form.elements.url.setCustomValidity('');if(file&&(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>256*1024)){toast('图标需为 PNG、JPEG 或 WebP，且不超过 256 KB');return;}const submit=form.querySelector('[type="submit"]');submit.disabled=true;try{const iconData=file?await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);}):null;const id=form.dataset.id,chosen=String(data.get('type')||''),type=cats[chosen]?chosen:form.dataset.type,candidateKey=form.dataset.candidate,candidateItem=form.dataset.item===''||form.dataset.item===undefined?null:Number(form.dataset.item),profile=assetProfiles[type]||{},date=data.has('expiry')?cardExpiry(data.get('expiry'))||'':String(data.get('date')??''),dateKind=data.has('expiry')?'expire':dateKinds[data.get('dateKind')]?String(data.get('dateKind')):'expire',cycle=billingCycles[data.get('cycle')]?String(data.get('cycle')):'',extras=Object.fromEntries((profile.extra||[]).map(key=>[key,String(data.get(key)??'').trim()])),fields={name,provider:profile.fixedProvider||String(data.get('provider')??'').trim()||(assetProfiles[type]?'':'平台待补充'),account:String(data.get('account')).trim(),purpose:String(data.get('purpose')).trim(),reason:String(data.get('reason')||'').trim(),date,dateKind,cycle,cost:String(data.get('cost')).trim()||'未知',notes:String(data.get('notes')).trim(),url:url?safeManagementUrl(url):''},event=date?`${date} ${dateKinds[dateKind].future}`:'日期待补充';if(extras.region&&!regionName(extras.region))extras.region='';if(extras.last4&&!/^\d{4}$/.test(extras.last4))extras.last4='';if(extras.network&&!cardNetworks.includes(extras.network))extras.network='';if(extras.phone)extras.phone=extras.phone.slice(0,30);Object.assign(fields,extras);checkpoint();let assetId=id;if(id){const a=state.assets.find(a=>a.id===id);const synced=['cloudflare','github'].includes(a.source);Object.assign(a,fields);for(const key of ['region','last4','network','phone'])if(!(key in extras))delete a[key];if(file)a.iconData=iconData;else if(data.has('removeIcon'))delete a.iconData;if(!synced){a.source='manual';a.type=type;a.event=event;}delete a.warn;ensureBlock(state,a.type);}else{assetId='asset-'+crypto.randomUUID();state.assets.push({id:assetId,type,...fields,iconData,source:'manual',event,art:'generic'});ensureBlock(state,type);}const resolved=candidateKey?resolveCandidate(candidateKey,id?'linked':'created',assetId,candidateItem):0;assetFormSnapshot=null;save();render();if(id&&activeAsset===id)showDetail(id);const source=candidateKey&&findCandidate(candidateKey),items=source?.ai?.items||[],recorded=items.length>1?recordedItems(source):[],next=items.length>1?items.findIndex((_,index)=>!recorded.includes(index)):-1;if(next>=0){candidateReview(source,next);toast(`已记录，这份资料里还有 ${items.length-recorded.length} 项`,true);}else if(candidateKey&&nativeStore&&pendingCount()){inboxDialog(false);toast(resolved?'已记录，继续核对下一组':'已记录',true);}else{$('#modal').close();toast(id?'资料已更新':'资产已添加',true);}}catch{toast('读取图标失败，请重试');}finally{submit.disabled=false;}});
$('#add-block').onclick=addBlock;$('#close-modal').onclick=()=>requestCloseModal();$('#close-detail').onclick=closeDetail;$('#modal').addEventListener('cancel',e=>{if(isAssetFormDirty()){e.preventDefault();requestCloseModal();}else assetFormSnapshot=null;});
$('#search').oninput=e=>{query=e.target.value;focusCategory=null;render();};$('#clear-search').onclick=()=>{if(query){$('#search').value='';query='';render();}else addBlock();};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();$('#search').focus();}if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='z'&&!$('#modal').open&&!e.target.closest?.('input,textarea,select,[contenteditable]')){e.preventDefault();undo();}if(e.key==='Escape'&&!$('#modal').open){if(!$('#detail').hidden)closeDetail();else if(focusCategory){focusCategory=null;render();}}});
// Direct manipulation, no layout mode: block headers move blocks, cards move themselves, block edges resize. Mouse starts after 5px, touch after a long press; Esc cancels; ⌥ + arrows is the keyboard path.
let gesture=null,suppressClick=false,floatTip=null,snapGuide=null;
const settleEase='cubic-bezier(.22,1,.36,1)';
function reduceMotion(){return matchMedia('(prefers-reduced-motion: reduce)').matches;}
function docRect(el){const r=el.getBoundingClientRect();return {left:r.left+scrollX,top:r.top+scrollY,right:r.right+scrollX,bottom:r.bottom+scrollY,width:r.width,height:r.height};}
function inside(r,x,y){return !!r&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}
function slideFrom(el,from,duration=220){if(!from)return;const to=el.getBoundingClientRect(),dx=from.left-to.left,dy=from.top-to.top;if(Math.abs(dx)>=1||Math.abs(dy)>=1)el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration,easing:settleEase});}
function showTip(text,x=0,y=0,tone='',clear=null){if(!floatTip){floatTip=document.createElement('div');floatTip.setAttribute('aria-hidden','true');document.body.append(floatTip);}floatTip.hidden=!text;if(!text)return;floatTip.className=`float-tip ${tone}`;floatTip.textContent=text;const w=floatTip.offsetWidth,h=floatTip.offsetHeight;let left=x+14,top=y+20;if(clear){left=x-w/2;top=clear.bottom+8;if(top+h>innerHeight-8)top=clear.top-h-8;}floatTip.style.left=Math.max(8,Math.min(innerWidth-w-8,left))+'px';floatTip.style.top=Math.max(8,Math.min(innerHeight-h-8,top))+'px';}
function showGuide(x){if(!snapGuide){snapGuide=document.createElement('div');snapGuide.className='snap-guide';document.body.append(snapGuide);}snapGuide.hidden=x===null;if(x===null)return;const r=$('#board').getBoundingClientRect(),top=Math.max(0,r.top);snapGuide.style.cssText=`left:${Math.round(x)}px;top:${top}px;height:${Math.max(0,Math.min(innerHeight,r.bottom)-top)}px`;}
function saveCardOrder(category,next){const existing=state.cardOrder?.[category]||[];checkpoint();state.cardOrder ||= {};state.cardOrder[category]=[...next,...existing.filter(id=>!next.includes(id))];save();}
function commitAssetOrder(source,target,after=false){
 if(!source||!target||source===target||source.parentElement!==target.parentElement)return false;
 const category=source.closest('.block')?.dataset.block;if(!category)return false;
 const current=[...source.parentElement.children].filter(n=>n.dataset.asset).map(n=>n.dataset.asset),next=moveAsset(current,source.dataset.asset,target.dataset.asset,after);
 if(next.every((id,i)=>id===current[i]))return false;
 saveCardOrder(category,next);render();return true;
}
function moveBlock(id,step){const index=state.blocks.findIndex(b=>b.id===id),target=index+step;if(index<0||target<0||target>=state.blocks.length){toast(step<0?'已经是第一个区块':'已经是最后一个区块');return false;}checkpoint();[state.blocks[target],state.blocks[index]]=[state.blocks[index],state.blocks[target]];save();render();toast(step<0?'已向前移动':'已向后移动',true);return true;}
function dragSource(target){
 if(query)return null;
 const card=target.closest('#board [data-asset]:not(.flip-card)');
 if(card)return {kind:'card',el:card,container:card.parentElement,block:card.closest('.block')};
 const head=!focusCategory&&target.closest('#board .block-head');
 return head?{kind:'block',el:head.closest('.block'),container:$('#board')}:null;
}
function releaseGesture(){const g=gesture;if(!g)return;clearTimeout(g.timer);cancelAnimationFrame(g.frame);removeEventListener('pointermove',dragMove);removeEventListener('pointerup',dragEnd);removeEventListener('pointercancel',dragEnd);gesture=null;}
function slotOrder(g){const key=g.kind==='block'?'block':'asset';return [...g.container.children].filter(n=>n===g.slot||n!==g.el&&n.dataset[key]).map(n=>(n===g.slot?g.el:n).dataset[key]);}
function measureItems(g){const key=g.kind==='block'?'block':'asset';g.items=[...g.container.children].filter(n=>n!==g.el&&n!==g.slot&&n.dataset[key]&&n.style.visibility!=='hidden').map(n=>({el:n,r:docRect(n)}));g.slotRect=docRect(g.slot);g.box=docRect(g.container);}
function beginDrag(g){
 const el=g.el;if(!el.isConnected){releaseGesture();return;}
 clearTimeout(g.timer);g.active=true;cancelAnimationFrame(layoutFrame);clearLinks();
 document.querySelectorAll('#board .block,#board [data-asset]').forEach(n=>n.getAnimations().forEach(a=>a.cancel()));
 const r=el.getBoundingClientRect();g.rect=r;g.dx=g.x0-r.left;g.dy=g.y0-r.top;
 g.slot=document.createElement('div');g.slot.className=`drop-slot ${g.kind}-slot`;g.slot.style.width=r.width+'px';g.slot.style.height=r.height+'px';el.before(g.slot);
 el.classList.add('is-dragging');document.body.classList.add('drag-active');
 Object.assign(el.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',margin:'0',transformOrigin:`${g.dx}px ${g.dy}px`});
 const placed=el.getBoundingClientRect();if(Math.abs(placed.left-r.left)>.5||Math.abs(placed.top-r.top)>.5){el.style.left=2*r.left-placed.left+'px';el.style.top=2*r.top-placed.top+'px';}
 if(g.kind==='card'){g.asset=state.assets.find(a=>a.id===el.dataset.asset);updateOverflow();g.homeRect=docRect(g.block);g.others=focusCategory?[]:[...document.querySelectorAll('#board .block')].filter(n=>n!==g.block).map(n=>({el:n,r:docRect(n)}));}
 g.initial=slotOrder(g);measureItems(g);
 const bar=document.querySelector('.toolbar');g.top=bar&&getComputedStyle(bar).display!=='none'?Math.max(0,bar.getBoundingClientRect().bottom):0;
 try{$('#board').setPointerCapture(g.id);}catch{}
 getSelection()?.removeAllRanges();
 if(reduceMotion())el.classList.add('lifted');else requestAnimationFrame(()=>el.classList.add('lifted'));
 followPointer(g);g.frame=requestAnimationFrame(()=>autoScroll(g));
}
function followPointer(g){g.el.style.translate=`${g.x-g.dx-g.rect.left}px ${g.y-g.dy-g.rect.top}px`;}
function setCrossTarget(g,block){
 if(g.cross===block)return;
 g.cross?.classList.remove('drop-into','drop-refused');g.cross=block;g.crossAllowed=!!block&&!['cloudflare','github'].includes(g.asset?.source);
 block?.classList.add(g.crossAllowed?'drop-into':'drop-refused');g.el.classList.toggle('refused',!!block&&!g.crossAllowed);
}
function moveSlot(g,mode,ref){
 const items=g.items.map(it=>it.el),near=(n,dir)=>{let s=n[dir];while(s&&!items.includes(s))s=s[dir];return s;};
 if(mode==='home'?g.slot.nextElementSibling===g.el:mode==='before'?near(g.slot,'nextElementSibling')===ref:near(g.slot,'previousElementSibling')===ref)return;
 const motion=!reduceMotion(),all=[...g.container.children].filter(n=>n!==g.el&&n!==g.slot),from=motion?new Map(all.map(n=>[n,n.getBoundingClientRect()])):null;
 if(motion)all.forEach(n=>n.getAnimations().forEach(a=>a.cancel()));
 if(mode==='home')g.el.before(g.slot);else if(mode==='before')ref.before(g.slot);else ref.after(g.slot);
 g.lockUntil=performance.now()+60;
 if(g.kind==='card')updateOverflow();
 measureItems(g);
 if(motion)for(const n of all)slideFrom(n,from.get(n));
}
function placeSlot(g){
 if(performance.now()<(g.lockUntil||0))return;
 const x=g.x+scrollX,y=g.y+scrollY;
 if(g.kind==='card'){const home=inside(g.homeRect,x,y),over=home?null:g.others.find(o=>inside(o.r,x,y))?.el||null;setCrossTarget(g,over);if(!home){moveSlot(g,'home');return;}}
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
 if(v){const before=scrollY;scrollBy(0,Math.sign(v)*Math.min(1,v*v)*20);if(scrollY!==before)placeSlot(g);}
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
  if(changed&&g.kind==='block'&&next.length===state.blocks.length){checkpoint();state.blocks=next.map(id=>state.blocks.find(b=>b.id===id));save();}
  else if(changed&&g.kind==='card')saveCardOrder(g.block.dataset.block,next);
  render();if(changed)toast(g.kind==='block'?'区块已移动':'顺序已调整',true);
 };
 if(reduceMotion()){done();return;}
 const to=g.slot.getBoundingClientRect();g.el.classList.add('settling');g.el.classList.remove('lifted','refused');g.el.style.translate=`${to.left-g.rect.left}px ${to.top-g.rect.top}px`;setTimeout(done,260);
}
function finishCross(g,type){
 const a=g.asset,ghost=g.el.getBoundingClientRect(),target=g.cross;
 cleanupDrag(g);
 if(!a||!cats[type]){render();return;}
 checkpoint();a.type=type;
 if(state.cardOrder){for(const key of Object.keys(state.cardOrder))state.cardOrder[key]=(state.cardOrder[key]||[]).filter(id=>id!==a.id);if(state.cardOrder[type]?.length)state.cardOrder[type].push(a.id);}
 save();render();
 const moved=document.querySelector(`#board [data-asset="${CSS.escape(a.id)}"]`);
 if(moved&&!reduceMotion()){
  if(moved.style.visibility==='hidden'){const block=moved.closest('.block');block.classList.add('drop-flash');setTimeout(()=>block.classList.remove('drop-flash'),900);}
  else{const to=moved.getBoundingClientRect();moved.animate([{transform:`translate(${ghost.left+ghost.width/2-to.left-to.width/2}px,${ghost.top+ghost.height/2-to.top-to.height/2}px)`,opacity:.5},{transform:'none',opacity:1}],{duration:320,easing:settleEase});}
 }
 toast(`已将「${displayName(a)}」移到「${cats[type].name}」`,true);
}
function rubber(value,min,max){const damp=over=>(1-1/(over*.55/120+1))*120;return value<min?min-damp(min-value):value>max?max+damp(value-max):value;}
function startResize(e,edge){
 const block=edge.closest('.block'),b=state.blocks.find(x=>x.id===block?.dataset.block);if(!b||query||focusCategory)return;
 e.preventDefault();cancelAnimationFrame(layoutFrame);
 const board=$('#board'),blocks=[...board.querySelectorAll('.block')];blocks.forEach(n=>n.getAnimations().forEach(a=>a.cancel()));
 const axis=edge.dataset.edge,bs=getComputedStyle(board),gap=parseFloat(bs.columnGap)||0,inner=board.clientWidth-parseFloat(bs.paddingLeft)-parseFloat(bs.paddingRight),px=w=>w/100*(inner+gap)-gap;
 const rect=block.getBoundingClientRect(),grid=block.querySelector('.cards'),gs=getComputedStyle(grid),rowH=grid.querySelector('[data-asset]')?.offsetHeight||0,rowGap=parseFloat(gs.rowGap)||0,pad=(parseFloat(gs.paddingTop)||0)+(parseFloat(gs.paddingBottom)||0);
 const startH=grid.clientHeight,natural=grid.scrollHeight,minW=Math.max(px(25),parseFloat(getComputedStyle(block).minWidth)||0),maxW=inner,minH=Math.max(96,pad+rowH);
 const snaps=[[25,'1/4'],[100/3,'1/3'],[50,'1/2'],[200/3,'2/3'],[75,'3/4'],[100,'整行']].map(([w,label])=>({w:px(w),label}));
 for(const other of blocks)if(other!==block){const r=other.getBoundingClientRect();for(const x of [r.right,r.left-gap])snaps.push({w:x-rect.left,x});}
 const startWidth=b.width,startHeight=b.height,x0=e.clientX,y0=e.clientY;let frame=0,pending=null,moved=false,heightOn=axis==='y';
 checkpoint();try{edge.setPointerCapture(e.pointerId);}catch{}block.classList.add('resizing');document.body.classList.add(`resize-${axis}`);
 const flush=()=>{
  frame=0;if(!pending)return;const {x,y,free}=pending;pending=null;moved=true;
  const neighbours=reduceMotion()?[]:blocks.filter(n=>n!==block).map(n=>[n,n.getBoundingClientRect()]),parts=[];neighbours.forEach(([n])=>n.getAnimations().forEach(a=>a.cancel()));
  if(axis!=='y'){
   let w=rect.width+x-x0,snap=null;
   if(!free)for(const s of snaps){const d=Math.abs(s.w-w);if(s.w>=minW-.5&&s.w<=maxW+.5&&d<=8&&(!snap||d<snap.d))snap={...s,d};}
   if(snap)w=snap.w;
   b.width=Math.round((Math.min(maxW,Math.max(minW,w))+gap)/(inner+gap)*1000)/10;block.style.setProperty('--width',b.width);block.style.width=rubber(w,minW,maxW)+'px';
   showGuide(snap&&'x' in snap?snap.x:null);parts.push(`宽 ${snap?.label||Math.round(b.width)+'%'}`);
  }
  if(axis!=='x'&&!heightOn&&Math.abs(y-y0)>8)heightOn=true;
  if(heightOn){
   let h=startH+y-y0;
   if(!free&&rowH){const n=Math.max(1,Math.round((h-pad+rowGap)/(rowH+rowGap))),fit=pad+n*rowH+(n-1)*rowGap;if(Math.abs(fit-h)<=12)h=fit;}
   if(h>=natural-4){b.height=null;block.classList.remove('fixed');grid.style.height=h>natural?rubber(h,minH,natural)+'px':'';grid.style.minHeight='';grid.querySelectorAll('[data-asset]').forEach(card=>{card.style.visibility='';card.inert=false;});parts.push('自动高度');}
   else{const clamped=Math.max(minH,h);b.height=Math.round(clamped);block.classList.add('fixed');grid.style.height=rubber(h,minH,natural)+'px';parts.push(rowH?`显示 ${Math.max(1,Math.round((clamped-pad+rowGap)/(rowH+rowGap)))} 行`:'固定高度');}
   updateOverflow();
  }else parts.push(b.height?'固定高度':'自动高度');
  for(const [n,from] of neighbours)slideFrom(n,from,180);
  showTip(parts.join(' · '),x,y);
 };
 const move=event=>{pending={x:event.clientX,y:event.clientY,free:event.metaKey||event.ctrlKey};if(!frame)frame=requestAnimationFrame(flush);};
 const end=()=>{
  cancelAnimationFrame(frame);flush();edge.removeEventListener('pointermove',move);edge.removeEventListener('pointerup',end);edge.removeEventListener('pointercancel',end);
  showGuide(null);showTip('');document.body.classList.remove(`resize-${axis}`);
  const changed=b.width!==startWidth||b.height!==startHeight;
  if(!changed)history.pop();else save();
  if(!moved){block.classList.remove('resizing');return;}
  const finish=()=>{block.classList.remove('resizing','settling-size');render();if(changed)toast('区块大小已调整',true);};
  if(reduceMotion()){finish();return;}
  block.classList.add('settling-size');block.style.width=px(b.width)+'px';grid.style.height=(b.height??natural)+'px';setTimeout(finish,260);
 };
 edge.addEventListener('pointermove',move);edge.addEventListener('pointerup',end);edge.addEventListener('pointercancel',end);
}
document.addEventListener('pointerdown',e=>{
 if(gesture||!e.isPrimary||e.button!==0||e.target.closest('input,select,textarea'))return;
 const edge=e.target.closest('#board .resize-edge');if(edge){startResize(e,edge);return;}
 const source=dragSource(e.target);if(!source)return;
 const g=gesture={...source,id:e.pointerId,touch:e.pointerType!=='mouse',x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,active:false};
 if(g.touch)g.timer=setTimeout(()=>{if(gesture===g)beginDrag(g);},300);
 addEventListener('pointermove',dragMove);addEventListener('pointerup',dragEnd);addEventListener('pointercancel',dragEnd);
});
addEventListener('click',e=>{if(!suppressClick)return;suppressClick=false;e.preventDefault();e.stopPropagation();},true);
addEventListener('keydown',e=>{if(e.key!=='Escape'||!gesture?.active)return;e.preventDefault();e.stopImmediatePropagation();suppressClick=true;addEventListener('pointerup',()=>setTimeout(()=>suppressClick=false,0),{once:true,capture:true});dropDrag(gesture,true);},true);
$('#board').addEventListener('touchmove',e=>{if(gesture?.active)e.preventDefault();},{passive:false});
$('#board').addEventListener('dragstart',e=>e.preventDefault());
document.addEventListener('contextmenu',e=>{if(gesture?.touch)e.preventDefault();});
document.addEventListener('dblclick',e=>{const edge=e.target.closest('#board .resize-edge');if(!edge||edge.dataset.edge==='x')return;const b=state.blocks.find(x=>x.id===edge.closest('.block').dataset.block);if(!b?.height)return;checkpoint();b.height=null;save();render();toast('已恢复自适应高度',true);});
document.addEventListener('keydown',e=>{
 if(!e.altKey||e.metaKey||e.ctrlKey||query||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
 const step=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1,opener=e.target.closest?.('#board .card-open,#board .compact-repo-open');
 if(opener){e.preventDefault();const source=opener.closest('[data-asset]'),id=source.dataset.asset,siblings=[...source.parentElement.children].filter(n=>n.dataset.asset);if(commitAssetOrder(source,siblings[siblings.indexOf(source)+step],step>0)){document.querySelector(`#board [data-asset="${CSS.escape(id)}"] :is(.card-open,.compact-repo-open)`)?.focus();toast(step<0?'已向前移动':'已向后移动',true);}return;}
 const title=!focusCategory&&e.target.closest?.('#board .block-title');
 if(title){e.preventDefault();const id=title.dataset.id;if(moveBlock(id,step))document.querySelector(`#board .block-title[data-id="${id}"]`)?.focus();}
});
// Hovering or focusing a linked card draws lines to the records it is linked with.
function edgePoint(r,x,y){const cx=r.left+r.width/2,cy=r.top+r.height/2,dx=x-cx,dy=y-cy;if(!dx&&!dy)return [cx,cy];const scale=Math.min(dx?Math.abs(r.width/2/dx):Infinity,dy?Math.abs(r.height/2/dy):Infinity);return [cx+dx*scale,cy+dy*scale];}
function clearLinks(){if(!linkFocus)return;linkFocus=null;document.querySelectorAll('.link-source,.link-peer').forEach(n=>n.classList.remove('link-source','link-peer'));if(linkLayer)linkLayer.innerHTML='';}
function showLinks(el){
 if(el===linkFocus)return;clearLinks();if(!el||gesture)return;
 const a=state.assets.find(x=>x.id===el.dataset.asset),peers=a?linkedAssets(state.assets,a).map(x=>document.querySelector(`#board [data-asset="${CSS.escape(x.id)}"]`)).filter(n=>n&&n.style.visibility!=='hidden'):[];
 if(!peers.length)return;
 linkFocus=el;el.classList.add('link-source');peers.forEach(n=>n.classList.add('link-peer'));
 if(!linkLayer){linkLayer=document.createElementNS('http://www.w3.org/2000/svg','svg');linkLayer.setAttribute('class','link-lines');linkLayer.setAttribute('aria-hidden','true');document.body.append(linkLayer);}
 const from=el.getBoundingClientRect();
 linkLayer.innerHTML=peers.map(n=>{const to=n.getBoundingClientRect(),[x1,y1]=edgePoint(from,to.left+to.width/2,to.top+to.height/2),[x2,y2]=edgePoint(to,from.left+from.width/2,from.top+from.height/2),length=Math.hypot(x2-x1,y2-y1)||1,bend=Math.min(40,length*.15),mx=(x1+x2)/2-(y2-y1)/length*bend,my=(y1+y2)/2+(x2-x1)/length*bend;return `<path d="M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}"/><circle cx="${x1}" cy="${y1}" r="3"/><circle cx="${x2}" cy="${y2}" r="3"/>`;}).join('');
}
$('#board').addEventListener('pointerover',e=>{if(e.pointerType==='mouse')showLinks(e.target.closest('#board [data-asset]:not(.flip-card)'));});
$('#board').addEventListener('pointerleave',clearLinks);
$('#board').addEventListener('focusin',e=>showLinks(e.target.closest('#board [data-asset]:not(.flip-card)')));
$('#board').addEventListener('focusout',e=>{if(!e.relatedTarget?.closest?.('#board [data-asset]'))clearLinks();});
addEventListener('scroll',clearLinks,{passive:true});
let viewportFrame=0;
window.addEventListener('resize',()=>{if(gesture?.active)dropDrag(gesture,true);if(viewportFrame)return;viewportFrame=requestAnimationFrame(()=>{viewportFrame=0;updateOverflow();});});render();
if(nativeStore){document.documentElement.classList.add('native-app');requestEvidence();document.querySelectorAll('.form-note').forEach(el=>{el.textContent=el.textContent.replaceAll('当前浏览器','此 Mac').replaceAll('此浏览器','此 Mac');});if(!nativeStore.data||migratedLegacyData)save();}
else if(migratedLegacyData)save();
