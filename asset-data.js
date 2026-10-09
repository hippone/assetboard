// v0.1.0 sample records are recognized by their exact contents. Edited records stay intact.
const legacyDemoFingerprints={a1:'a25c4927',a2:'4ae9484c',a3:'6a950cfa',a4:'f4736ff',a5:'4967c541',a6:'11aae485',a7:'3df0a90b',a8:'de0706d5',a9:'79622532'};
const legacyDefaultBlocks=[['domain',60],['server',40],['subscription',40],['database',60]];

function assetFingerprint(asset){
 const canonical=JSON.stringify(Object.keys(asset).sort().map(key=>[key,asset[key]]));
 let hash=2166136261;
 for(let i=0;i<canonical.length;i++){hash^=canonical.charCodeAt(i);hash=Math.imul(hash,16777619);}
 return (hash>>>0).toString(16);
}

function removeUntouchedDemo(board){
 const assets=board.assets.filter(asset=>legacyDemoFingerprints[asset.id]!==assetFingerprint(asset));
 const isDefaultPrefix=legacyDefaultBlocks.every(([id,width],index)=>{
  const block=board.blocks[index];
  return block&&Object.keys(block).length===4&&block.id===id&&block.width===width&&block.collapsed===false&&block.height===null;
 });
 const removeBlocks=isDefaultPrefix&&!assets.some(asset=>legacyDefaultBlocks.some(([id])=>asset.type===id));
 const blocks=removeBlocks?board.blocks.slice(legacyDefaultBlocks.length):board.blocks;
 return {board:{...board,assets,blocks},removed:board.assets.length-assets.length,removedBlocks:removeBlocks?legacyDefaultBlocks.length:0};
}

// Display order (2026-10-09): what shows first is the person's own order (cardOrder), then the most recently updated.
// The board never guesses importance; urgency only colours dates, the agenda and block summaries.
// Recency: updatedAt (platform or last local edit), else createdAt (added or first imported); records with neither keep their stored order after dated ones.
function recencyTime(asset){return Date.parse(asset?.updatedAt)||Date.parse(asset?.createdAt)||0;}
function recentFirst(assets){return assets.map((asset,index)=>({asset,index,time:recencyTime(asset)})).sort((left,right)=>(right.time-left.time)||(left.index-right.index)).map(item=>item.asset);}
function arrangeAssets(assets,ids){
 const rank=new Map((Array.isArray(ids)?ids:[]).map((id,index)=>[id,index]));
 const ranked=assets.filter(asset=>rank.has(asset.id)).sort((left,right)=>rank.get(left.id)-rank.get(right.id));
 return [...ranked,...recentFirst(assets.filter(asset=>!rank.has(asset.id)))];
}
// Manual orders only keep the part a person actually changed, so everything after it stays in recency order.
function touchedPrefix(before,after){let last=-1;for(let i=0;i<after.length;i++)if(before[i]!==after[i])last=i;return after.slice(0,last+1);}
function swapInOrder(ids,first,second){const next=[...ids],a=next.indexOf(first),b=next.indexOf(second);if(a<0||b<0||a===b)return next;[next[a],next[b]]=[next[b],next[a]];return next;}
function bringToFront(ids,id){return [id,...(Array.isArray(ids)?ids:[]).filter(other=>other!==id)];}

// Category quick actions (DESIGN-PRINCIPLES §5): read-only, local actions only — open a link, copy a value, open an existing local folder.
const ACTION_FIELDS={server:[['host','主机或 IP','例如 203.0.113.10'],['sshUser','SSH 用户','例如 deploy'],['sshPort','SSH 端口','22']],repository:[['localPath','本机目录','例如 ~/code/my-project']]};
const QUICK_LIMIT=2;
function validActionField(key,value){
 const v=String(value??'').trim();if(!v)return true;
 if(key==='host')return /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$|^\[?[0-9A-Fa-f:]{2,39}\]?$/.test(v);
 if(key==='sshUser')return /^[A-Za-z_][A-Za-z0-9_.-]{0,31}$/.test(v);
 if(key==='sshPort')return /^\d{1,5}$/.test(v)&&+v>=1&&+v<=65535;
 if(key==='localPath')return v.length<=1000&&/^(\/|~\/)/.test(v)&&!v.includes('\0')&&!v.split('/').includes('..');
 return false;
}
function sshCommand(asset){const host=String(asset.host||'').trim();if(!host||!validActionField('host',host))return '';const user=validActionField('sshUser',asset.sshUser)?String(asset.sshUser||'').trim():'',port=validActionField('sshPort',asset.sshPort)?String(asset.sshPort||'').trim():'';return `ssh ${port&&port!=='22'?`-p ${port} `:''}${user?user+'@':''}${host.replace(/^\[|\]$/g,'')}`;}
function cloneUrl(link){try{const url=new URL(link);const parts=url.pathname.split('/').filter(Boolean);if(url.protocol!=='https:'||!['github.com','gitlab.com','codeberg.org'].includes(url.hostname)||parts.length!==2)return '';return `https://${url.hostname}/${parts[0]}/${parts[1].replace(/\.git$/,'')}.git`;}catch{return '';}}
// link is the asset's safe, real management URL (or ''); native tells whether local folders can be opened.
function quickActions(asset,{link='',native=false}={}){
 if(!asset||asset.hiddenAt)return [];
 const open=label=>link?{id:'open',kind:'open',label,value:link}:null,copy=(id,label,value,done)=>value?{id,kind:'copy',label,value,done}:null;
 const local=native&&asset.localPath&&validActionField('localPath',asset.localPath)?{id:'editor',kind:'local',label:'用本机编辑器打开',value:String(asset.localPath).trim()}:null;
 const list=asset.type==='domain'?[open('打开管理页'),copy('copy-name','复制域名',String(asset.name||'').trim(),'域名')]
  :asset.type==='server'?[copy('copy-ssh','复制 SSH 命令',sshCommand(asset),'SSH 命令'),open('打开控制台'),copy('copy-host','复制主机',validActionField('host',asset.host)?String(asset.host||'').trim():'','主机地址')]
  :asset.type==='repository'?[open('在浏览器打开'),copy('copy-clone','复制克隆地址',cloneUrl(link),'克隆地址'),local]
  :[open('打开管理页')];
 return list.filter(Boolean);
}
function repositoryGroups(assets, preferredIds, limit=6){
 const repositories=assets.filter(asset=>asset.type==='repository').sort((left,right)=>{
  const difference=recencyTime(right)-recencyTime(left);
  return difference||left.name.localeCompare(right.name);
 });
 const byId=new Map(repositories.map(asset=>[asset.id,asset]));
 const preferred=Array.isArray(preferredIds)?preferredIds.filter(id=>byId.has(id)):[];
 const featuredIds=[...new Set(preferred)].slice(0,limit);
 for(const asset of repositories)if(featuredIds.length<limit&&!featuredIds.includes(asset.id))featuredIds.push(asset.id);
 const featured=featuredIds.map(id=>byId.get(id));
 return {featured,compact:repositories.filter(asset=>!featuredIds.includes(asset.id))};
}

function swapRepositoryDisplay(assets,preferredIds,id,limit=6){
 const {featured,compact}=repositoryGroups(assets,preferredIds,limit);
 const ids=featured.map(asset=>asset.id);
 const position=ids.indexOf(id);
 if(position>=0){
  ids.splice(position,1);
  if(compact[0])ids.splice(position,0,compact[0].id);
 }else if(compact.some(asset=>asset.id===id)){
  if(ids.length>=limit)ids.pop();
  ids.unshift(id);
 }
 return ids;
}

function orderAssets(assets,ids){
 if(!Array.isArray(ids)||!ids.length)return assets;
 const rank=new Map(ids.map((id,index)=>[id,index]));
 return [...assets].sort((left,right)=>(rank.get(left.id)??Infinity)-(rank.get(right.id)??Infinity));
}

function moveAsset(ids,movingId,targetId,after=false){
 if(movingId===targetId||!ids.includes(movingId)||!ids.includes(targetId))return ids;
 const next=ids.filter(id=>id!==movingId);
 next.splice(next.indexOf(targetId)+(after?1:0),0,movingId);
 return next;
}

// Dates are local calendar days (YYYY-MM-DD). Day numbers avoid DST drift.
const DAY_MS=86400000;
const SOON_DAYS=30;
const dateKinds={
 expire:{label:'到期',future:'到期',past:'已过期'},
 renew:{label:'自动续费扣款',future:'扣款',past:'扣款日已过'},
 trial:{label:'试用结束',future:'试用结束',past:'试用已结束'},
 cancel:{label:'取消截止',future:'取消截止',past:'已过取消截止'},
 keep:{label:'保号期限',future:'保号到期',past:'保号已过期'}
};
const billingCycles={monthly:{label:'每月',months:1,suffix:'月'},quarterly:{label:'每 3 个月',months:3,suffix:'3 个月'},halfyearly:{label:'每 6 个月',months:6,suffix:'6 个月'},yearly:{label:'每年',months:12,suffix:'年'}};

function dayNumber(value){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
 if(!match)return null;
 const year=+match[1],month=+match[2],day=+match[3],time=Date.UTC(year,month-1,day),check=new Date(time);
 return check.getUTCFullYear()===year&&check.getUTCMonth()===month-1&&check.getUTCDate()===day?time/DAY_MS:null;
}

function localDay(now=new Date()){return Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/DAY_MS;}
function isoDay(number){return new Date(number*DAY_MS).toISOString().slice(0,10);}

function addMonths(value,months){
 const [year,month,day]=value.split('-').map(Number),total=year*12+month-1+months,targetYear=Math.floor(total/12),targetMonth=total-targetYear*12;
 const last=new Date(Date.UTC(targetYear,targetMonth+1,0)).getUTCDate();
 return isoDay(Date.UTC(targetYear,targetMonth,Math.min(day,last))/DAY_MS);
}

// A recurring date rolls forward from its original anchor, so a month-end date stays month-end.
function nextOccurrence(value,cycle,today){
 const start=dayNumber(value),months=billingCycles[cycle]?.months;
 if(start===null)return null;
 if(!months||start>=today)return value;
 for(let step=1;step<=1200;step++){
  const next=addMonths(value,months*step);
  if(dayNumber(next)>=today)return next;
 }
 return null;
}

function assetDateStatus(asset,now=new Date()){
 const kind=dateKinds[asset?.dateKind]?asset.dateKind:'expire',today=localDay(now),date=nextOccurrence(asset?.date,asset?.cycle,today);
 if(!date)return {level:'none',label:'',kind,date:'',days:null,rolled:false};
 const days=dayNumber(date)-today,words=dateKinds[kind];
 const label=days<0?`${words.past} ${-days} 天`:days===0?`今天${words.future}`:days===1?`明天${words.future}`:days<=60?`${days} 天后${words.future}`:`${date} ${words.future}`;
 return {level:days<0?'overdue':days<=SOON_DAYS?'soon':'upcoming',label,kind,date,days,rolled:date!==asset.date};
}

function upcomingEvents(assets,now=new Date(),horizon=60){
 return assets.filter(asset=>!asset.hiddenAt)
  .map(asset=>({asset,status:assetDateStatus(asset,now)}))
  .filter(({status})=>status.level!=='none'&&status.days<=horizon)
  .sort((left,right)=>left.status.days-right.status.days||left.asset.name.localeCompare(right.asset.name));
}

// Platform sync merge. Pure: returns a new board plus name collisions that need a person's decision.
function syncKey(source,externalId,kind){
 if(!externalId&&externalId!==0)return null;
 const id=String(externalId);
 if(source==='cloudflare')return `cloudflare:${kind||'zone'}:${id}`;
 if(source==='github')return `github:${id}`;
 return `${source}:${id}`;
}

function assetSyncKey(asset){
 if(!asset)return null;
 return syncKey(asset.source,asset.externalId,asset.resourceKind)||(asset.source==='cloudflare'||asset.source==='github'?asset.id:null);
}

function isBlacklisted(board,key){return !!key&&Array.isArray(board.deletedExternalIds)&&board.deletedExternalIds.includes(key);}

function findByExternal(board,source,externalId,kind){
 const id=String(externalId);
 return board.assets.find(asset=>asset.source===source&&asset.externalId!=null&&String(asset.externalId)===id&&(source!=='cloudflare'||(asset.resourceKind||'zone')===(kind||'zone')));
}

function findNameCollision(board,source,name,type,externalId){
 return board.assets.find(asset=>asset.type===type&&asset.name===name&&asset.source!=='demo'&&!(asset.source===source&&asset.externalId!=null&&String(asset.externalId)===String(externalId)));
}

function ensureBlock(board,type){if(!board.blocks.some(block=>block.id===type))board.blocks.push({id:type,width:50,height:null,density:'full',folded:false});}
// Blocks saved before 2026-09-29 used collapsed:true for what is now the compact card style.
function blockDensity(block){return block?.density==='compact'||block?.density==='full'?block.density:block?.collapsed?'compact':'full';}
function setBlockDensity(block,density){block.density=density==='compact'?'compact':'full';delete block.collapsed;}

function applySyncedFields(asset,fields){Object.assign(asset,fields);asset.syncMissing=false;}

function mergeCloudflare(board,result,syncedAt=new Date().toISOString()){
 const next=structuredClone(board),resources=result.resources||[],queried=new Set(result.queriedKinds||[]),seen=new Set(),collisions=[];
 let added=0;
 if(!Array.isArray(next.deletedExternalIds))next.deletedExternalIds=[];
 for(const item of resources){
  const kind=item.kind||'zone',type=kind==='zone'?'domain':kind==='r2'?'storage':'deployment',id=`cloudflare-${kind}-${item.id}`;
  seen.add(id);
  if(isBlacklisted(next,syncKey('cloudflare',item.id,kind))||isBlacklisted(next,id))continue;
  const fields={name:item.name,account:item.account,syncStatus:item.status,syncedAt,resourceKind:kind,externalId:item.id,source:'cloudflare',provider:'Cloudflare'};
  const existing=next.assets.find(asset=>asset.id===id)||findByExternal(next,'cloudflare',item.id,kind);
  if(existing){
   applySyncedFields(existing,fields);
   existing.event=item.status||existing.event||'状态未知';
   seen.add(existing.id);
  }else{
   const collision=findNameCollision(next,'cloudflare',item.name,type,item.id);
   if(collision){collisions.push({assetId:collision.id,name:item.name,source:'Cloudflare',fields:{...fields,type,url:item.url||collision.url}});continue;}
   next.assets.push({id,createdAt:syncedAt,type,name:item.name,provider:'Cloudflare',account:item.account,purpose:kind==='zone'?'DNS Zone':kind==='r2'?'R2 Bucket':kind==='pages'?'Pages 项目':'Worker 脚本',event:item.status||'状态未知',date:'',cost:'未知',notes:'Cloudflare 资源列表同步；到期日和账单未知。',url:item.url,art:'generic',source:'cloudflare',resourceKind:kind,externalId:item.id,syncStatus:item.status,syncedAt});
   added++;
  }
  ensureBlock(next,type);
 }
 for(const asset of next.assets)if(asset.source==='cloudflare'&&queried.has(asset.resourceKind||'zone')&&!seen.has(asset.id))asset.syncMissing=true;
 return {board:next,added,read:resources.length,collisions};
}

function mergeGitHub(board,result,syncedAt=new Date().toISOString()){
 const next=structuredClone(board),repositories=result.repositories||[],seen=new Set(),collisions=[];
 let added=0;
 if(!Array.isArray(next.deletedExternalIds))next.deletedExternalIds=[];
 for(const repo of repositories){
  const id='github-repo-'+repo.id,status=repo.archived?'已归档':repo.private?'私有仓库':'公开仓库';
  seen.add(id);
  if(isBlacklisted(next,syncKey('github',repo.id))||isBlacklisted(next,id))continue;
  const fields={name:repo.name,account:repo.owner,updatedAt:repo.updatedAt||'',syncStatus:status,syncedAt,externalId:repo.id,source:'github',provider:'GitHub',event:status};
  const existing=next.assets.find(asset=>asset.id===id)||findByExternal(next,'github',repo.id);
  if(existing){
   applySyncedFields(existing,fields);
   if(repo.url)existing.url=repo.url;
   seen.add(existing.id);
  }else{
   const collision=findNameCollision(next,'github',repo.name,'repository',repo.id);
   if(collision){collisions.push({assetId:collision.id,name:repo.name,source:'GitHub',fields:{...fields,type:'repository',url:repo.url||collision.url,purpose:repo.description?.slice(0,100)||collision.purpose||'代码仓库'}});continue;}
   next.assets.push({id,createdAt:syncedAt,type:'repository',name:repo.name,provider:'GitHub',account:repo.owner,purpose:repo.description?.slice(0,100)||'代码仓库',event:status,date:'',cost:'未知',notes:'GitHub 仓库元数据同步。',url:repo.url,art:'generic',source:'github',externalId:repo.id,updatedAt:repo.updatedAt||'',syncStatus:status,syncedAt});
   added++;
  }
 }
 for(const asset of next.assets)if(asset.source==='github'&&!seen.has(asset.id))asset.syncMissing=true;
 ensureBlock(next,'repository');
 return {board:next,added,read:repositories.length,collisions};
}

function applyCollision(board,collision){
 const asset=board.assets.find(item=>item.id===collision.assetId);
 if(!asset)return false;
 applySyncedFields(asset,collision.fields);
 ensureBlock(board,asset.type);
 return true;
}

// Imported evidence (mail, OCR, pasted text) → reviewable candidates. Rules only; nothing leaves the device.
const monthNumbers={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sept:9,sep:9,oct:10,nov:11,dec:12};
const monthWords='january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec';
const currencySymbols={'US$':'USD','HK$':'HKD','S$':'SGD','A$':'AUD','C$':'CAD','$':'USD','¥':'CNY','￥':'CNY','€':'EUR','£':'GBP'};
const currencyDisplay={USD:'$',CNY:'¥',EUR:'€',GBP:'£',HKD:'HK$',SGD:'S$',AUD:'A$',CAD:'C$',JPY:'JP¥'};
const amountNumber='(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)';
const amountPatterns=[
 [new RegExp('(US\\$|HK\\$|S\\$|A\\$|C\\$|\\$|¥|￥|€|£)\\s?'+amountNumber,'g'),match=>[currencySymbols[match[1]],match[2]]],
 [new RegExp('\\b(USD|CNY|RMB|EUR|GBP|HKD|SGD|AUD|CAD|JPY)\\s?'+amountNumber,'gi'),match=>[match[1].toUpperCase(),match[2]]],
 [new RegExp(amountNumber+'\\s?(USD|CNY|RMB|EUR|GBP|HKD|SGD|AUD|CAD|JPY)\\b','gi'),match=>[match[2].toUpperCase(),match[1]]],
 [new RegExp(amountNumber+'\\s?元','g'),match=>['CNY',match[1]]]
];
const datePatterns=[
 [/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g,match=>[+match[1],+match[2],+match[3]]],
 [/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/g,match=>[+match[1],+match[2],+match[3]]],
 [new RegExp(`\\b(${monthWords})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`,'gi'),match=>[+match[3],monthNumbers[match[1].toLowerCase()],+match[2]]],
 [new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthWords})\\.?,?\\s+(20\\d{2})\\b`,'gi'),match=>[+match[3],monthNumbers[match[2].toLowerCase()],+match[1]]],
 [/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g,match=>+match[1]>12?[+match[3],+match[2],+match[1]]:[+match[3],+match[1],+match[2]]]
];
const dateKeywords={
 trial:/free trial|trial (?:ends|period|expires)|试用/gi,
 cancel:/cancel (?:by|before)|取消.{0,4}(?:截止|之前|前)/gi,
 renew:/auto-?renew\w*|renews?|renewal|next (?:billing|payment|charge|invoice)|will be (?:charged|billed)|billing date|续费|续订|自动扣款|扣款|下次|下一次/gi,
 expire:/expir\w*|valid (?:until|through)|到期|过期|有效期/gi,
 paid:/\bpaid\b|payment date|invoice date|date paid|order date|支付时间|付款时间|订单日期|交易时间/gi
};
const paymentProcessors=['stripe.com','paddle.com','paypal.com','fastspring.com','lemonsqueezy.com','gumroad.com','chargebee.com','recurly.com','alipay.com','apple.com','google.com'];
const domainSuffixes='com|net|org|io|dev|app|ai|co|me|xyz|cn|site|tech|studio|so|sh|cc|info|biz|top|link|page|cloud|design|blog|online|store|shop|space|fun|life|us|uk|de|jp|tw|hk|gg|tv|fm';
const ignoredDomains=new Set(['gmail.com','google.com','apple.com','icloud.com','outlook.com','hotmail.com','github.com','stripe.com','paypal.com','example.com']);

function scanAll(pattern,text){pattern.lastIndex=0;const matches=[];let match;while((match=pattern.exec(text))){matches.push(match);if(!match[0])pattern.lastIndex++;}return matches;}

function lineAt(text,index){
 const start=text.lastIndexOf('\n',index-1)+1,end=text.indexOf('\n',index);
 return text.slice(start,end<0?text.length:end);
}

function cycleNear(text){
 if(/^\s*(?:\/|per|a|每|按)\s*(?:mo\b|month|月)/i.test(text))return 'monthly';
 if(/^\s*(?:\/|per|a|每|按)\s*(?:yr\b|year|年)/i.test(text))return 'yearly';
 return null;
}

function textCycle(text){
 const monthly=/\bmonthly\b|per month|\/\s?mo\b|每月|月付|包月|按月|月度/i.test(text),yearly=/\bannual(?:ly)?\b|\byearly\b|per year|\/\s?(?:yr|year)\b|每年|年付|包年|按年|年度/i.test(text);
 return monthly===yearly?null:monthly?'monthly':'yearly';
}

function findAmounts(text){
 const found=[];
 for(const [pattern,read] of amountPatterns)for(const match of scanAll(pattern,text)){
  const [code,raw]=read(match),value=Number(raw.replace(/,/g,''));
  if(!(value>0))continue;
  if(found.some(item=>match.index<item.end&&item.index<match.index+match[0].length))continue;
  const line=lineAt(text,match.index);
  let score=0;
  if(/total|amount due|amount charged|grand total|合计|总计|实付|应付|支付金额|付款金额/i.test(line))score+=3;
  if(/charged|renew|billed|price|amount|金额|费用|续费|扣款/i.test(line))score+=2;
  if(/tax|vat|gst|discount|coupon|credit|refund|税|优惠|折扣|退款|余额/i.test(line))score-=3;
  found.push({currency:code==='RMB'?'CNY':code,value:raw,index:match.index,end:match.index+match[0].length,score,cycle:cycleNear(text.slice(match.index+match[0].length,match.index+match[0].length+16))});
 }
 return found.sort((left,right)=>right.score-left.score||left.index-right.index);
}

function nearestKind(text,start,end){
 const before=text.slice(Math.max(0,start-100),start),after=text.slice(end,end+14);
 let best=null,distance=Infinity;
 for(const [kind,pattern] of Object.entries(dateKeywords)){
  for(const match of scanAll(pattern,before)){const gap=before.length-(match.index+match[0].length);if(gap<distance){best=kind;distance=gap;}}
  for(const match of scanAll(pattern,after)){if(match.index<distance){best=kind;distance=match.index;}}
 }
 return best||'unknown';
}

function findDates(text){
 const found=[];
 for(const [pattern,read] of datePatterns)for(const match of scanAll(pattern,text)){
  const [year,month,day]=read(match),value=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  if(dayNumber(value)===null||found.some(item=>match.index<item.end&&item.index<match.index+match[0].length))continue;
  found.push({value,index:match.index,end:match.index+match[0].length,kind:nearestKind(text,match.index,match.index+match[0].length)});
 }
 return found.sort((left,right)=>left.index-right.index);
}

function findDomains(text,exclude){
 const counts=new Map(),pattern=new RegExp(`((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:${domainSuffixes}))(?![\\w-]|\\.[a-z])`,'gi');
 for(const match of scanAll(pattern,text)){
  const before=text[match.index-1]||' ';
  if(/[@/\w.-]/.test(before))continue;
  const domain=match[1].toLowerCase().replace(/^www\./,'');
  if(ignoredDomains.has(domain)||exclude.has(registrableDomain(domain)))continue;
  counts.set(domain,(counts.get(domain)||0)+1);
 }
 return [...counts].sort((left,right)=>right[1]-left[1]).map(([domain])=>domain);
}

function parseSender(value){
 const text=String(value||'').trim(),match=/^"?([^"<]*?)"?\s*<([^>]+)>$/.exec(text);
 const address=(match?match[2]:text.includes('@')?text:'').trim().toLowerCase();
 return {name:(match?match[1]:text.includes('@')?'':text).trim(),address,host:address.split('@')[1]||''};
}

function registrableDomain(host){
 const labels=String(host||'').toLowerCase().split('.').filter(Boolean);
 if(labels.length<=2)return labels.join('.');
 return (labels.at(-1).length===2&&['co','com','net','org','gov','edu','ac'].includes(labels.at(-2))?labels.slice(-3):labels.slice(-2)).join('.');
}

function cleanMerchant(name){
 let value=String(name||'').replace(/\s+/g,' ').trim(),previous;
 do{previous=value;value=value.replace(/[\s.。!！]+$/,'').replace(/[\s,|·:-]*\b(?:billing|receipts?|invoices?|team|support|notifications?|no-?reply|payments?|accounts?|sales|customer (?:care|service)|via .+)$/i,'').replace(/[\s,|·:-]*(?:账单|通知|客服|团队)$/,'').trim();}while(value!==previous);
 return /^(?:no-?reply|billing|support|notifications?|info|hello)$/i.test(value)?'':value;
}

function capitalize(value){return value?value[0].toUpperCase()+value.slice(1):'';}

function dayFromDateString(value){
 if(!value)return null;
 const exact=dayNumber(String(value).slice(0,10));
 if(exact!==null&&/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return exact;
 const time=Date.parse(value);
 return Number.isFinite(time)?localDay(new Date(time)):null;
}

function guessAssetType(text,domains){
 if(domains.length&&/domain|域名|registrar|whois|注册商/i.test(text))return 'domain';
 if(/\b(?:vps|server|droplet|instance|linode|vultr|hetzner|ec2|lightsail)\b|服务器|云主机|轻量应用/i.test(text))return 'server';
 if(/\b(?:database|postgres(?:ql)?|mysql|redis|mongodb|supabase|planetscale)\b|数据库/i.test(text))return 'database';
 if(/\b(?:licen[cs]e|lifetime)\b|授权|许可证|激活码/i.test(text))return 'license';
 if(/\b(?:openai|chatgpt|anthropic|claude|midjourney|perplexity|cursor|copilot|gemini|runway|elevenlabs|suno|deepseek)\b/i.test(text))return 'ai';
 return 'subscription';
}

function evidencePayload(row){
 let payload=row.payload||{};
 if(typeof payload==='string'){try{payload=JSON.parse(payload)||{};}catch{payload={};}}
 return payload&&typeof payload==='object'?payload:{};
}

function evidenceFacts(row,types=[]){
 const payload=evidencePayload(row);
 const sender=parseSender(row.kind==='gmail'?row.source:''),senderDomain=registrableDomain(sender.host),processor=paymentProcessors.includes(senderDomain);
 const title=String(row.title||''),body=String(row.body||''),text=`${title}\n${body}`;
 let merchant=cleanMerchant(sender.name);
 if(processor||!merchant){const subject=/(?:receipt|invoice|payment|subscription|order)\s+(?:from|for|to|with)\s+([^#[\]()（）,:：|\n-]{2,40})/i.exec(title);if(subject)merchant=cleanMerchant(subject[1]);}
 if(!merchant&&senderDomain&&!processor)merchant=capitalize(senderDomain.split('.')[0]);
 const amounts=findAmounts(text),amount=amounts[0]||null,dates=findDates(text),domains=findDomains(text,new Set(senderDomain?[senderDomain]:[]));
 const head=`${title}\n${body.slice(0,2000)}`;
 return {
  id:row.id,kind:row.kind||'',title,merchant,senderDomain,
  merchantKey:senderDomain?(processor?`${senderDomain}:${merchant.toLowerCase()}`:senderDomain):null,
  day:dayFromDateString(payload.date)??dayFromDateString(row.importedAt),
  amount,cycle:amount?.cycle||textCycle(head),dates,domains,type:guessAssetType(head,domains),
  ai:payload.ai&&typeof payload.ai.text==='string'?{provider:String(payload.ai.provider||''),model:String(payload.ai.model||''),at:String(payload.ai.at||''),items:parseAiItems(payload.ai.text,types)}:null
 };
}

function inferCycle(days){
 const unique=[...new Set(days.filter(day=>day!=null))].sort((left,right)=>left-right),charges=[];
 for(const day of unique)if(!charges.length||day-charges.at(-1)>5)charges.push(day);
 if(charges.length<2)return null;
 const gaps=charges.slice(1).map((day,index)=>day-charges[index]).sort((left,right)=>left-right),median=gaps[Math.floor(gaps.length/2)];
 return median>=26&&median<=35?'monthly':median>=350&&median<=380?'yearly':null;
}

function formatCost(amount,cycle){
 if(!amount)return '';
 return `${currencyDisplay[amount.currency]??(amount.currency?amount.currency+' ':'')}${amount.value}${billingCycles[cycle]?` / ${billingCycles[cycle].suffix}`:''}`;
}

// The asset's own name counts most; a merchant alone (e.g. "Apple") must not pull in a sibling product.
function matchAsset(assets,facts){
 const normalize=value=>String(value||'').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g,'');
 const merchant=normalize(facts.merchant),name=normalize(facts.name),byMerchant=!name||name===merchant;
 const similar=(left,right)=>left.length>=3&&right.length>=3&&(left.includes(right)||right.includes(left));
 let best=null,bestScore=0;
 for(const asset of assets){
  const assetName=normalize(asset.name),provider=normalize(asset.provider);
  let score=0;
  if(facts.domains.includes(String(asset.name).toLowerCase()))score+=5;
  if(similar(assetName,name))score+=4;
  else if(byMerchant&&similar(assetName,merchant))score+=3;
  if(similar(provider,merchant))score+=2;
  try{if(facts.senderDomain&&registrableDomain(new URL(asset.url).hostname)===facts.senderDomain)score+=2;}catch{}
  if(score>bestScore){best=asset;bestScore=score;}
 }
 return bestScore>=3?best.id:null;
}

function buildCandidates(rows,{assets=[],decisions={},now=new Date(),types=[]}={}){
 const today=localDay(now),groups=new Map();
 for(const row of rows){
  const facts=evidenceFacts(row,types),key=facts.merchantKey||'row:'+row.id;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(facts);
 }
 const candidates=[...groups].map(([key,items])=>{
  items.sort((left,right)=>(right.day??0)-(left.day??0));
  const latest=items[0],amount=items.find(item=>item.amount)?.amount||null;
  const inferredCycle=inferCycle(items.map(item=>item.day)),cycle=items.find(item=>item.cycle)?.cycle||inferredCycle;
  const stated=items.flatMap(item=>item.dates).filter(date=>dateKinds[date.kind]);
  const future=stated.filter(date=>dayNumber(date.value)>=today).sort((left,right)=>dayNumber(left.value)-dayNumber(right.value))[0];
  const past=stated.sort((left,right)=>dayNumber(right.value)-dayNumber(left.value))[0];
  const paidDay=items.flatMap(item=>item.dates).filter(date=>date.kind==='paid').map(date=>dayNumber(date.value)).sort((left,right)=>right-left)[0];
  const chargeDay=latest.kind==='gmail'?latest.day:paidDay??null;
  let date=null;
  if(future)date={value:future.value,kind:future.kind,source:'stated',basis:'通知中写明'};
  else if(past&&cycle)date={value:nextOccurrence(past.value,cycle,today),kind:past.kind,source:'inferred',basis:`按${billingCycles[cycle].label}周期从 ${past.value} 推算`};
  else if(cycle&&chargeDay!=null)date={value:nextOccurrence(isoDay(chargeDay),cycle,today),kind:'renew',source:'inferred',basis:inferredCycle&&!items.some(item=>item.cycle)?`根据 ${items.length} 封收据的间隔推算`:`按${billingCycles[cycle].label}周期从最近一次付款（${isoDay(chargeDay)}）推算`};
  const domains=[...new Set(items.flatMap(item=>item.domains))],type=items.find(item=>item.type!=='subscription')?.type||'subscription';
  const merchant=items.find(item=>item.merchant)?.merchant||'';
  const facts={merchant,name:type==='domain'&&domains[0]?domains[0]:merchant,domains,senderDomain:latest.senderDomain};
  const pendingIds=items.filter(item=>!decisions[item.id]).map(item=>item.id);
  const base={
   key,ids:items.map(item=>item.id),pendingIds,count:items.length,latest:{id:latest.id,title:latest.title,day:latest.day,kind:latest.kind},
   merchant,name:type==='domain'&&domains[0]?domains[0]:merchant,type,amount,cycle,cost:formatCost(amount,cycle),date,domains,senderDomain:latest.senderDomain,account:'',quote:'',
   match:matchAsset(assets,facts),weak:!amount&&!date&&!(type==='domain'&&domains.length),pending:pendingIds.length>0,ai:null
  };
  const analyzed=items.find(item=>item.ai);
  if(!analyzed)return base;
  const ai={rowId:analyzed.id,provider:analyzed.ai.provider,model:analyzed.ai.model,at:analyzed.ai.at,items:analyzed.ai.items||[],unreadable:!analyzed.ai.items};
  const candidate=ai.unreadable?base:ai.items.length?applyAiItem(base,ai.items[0],{assets,now,fallback:ai.items.length===1}):{...base,weak:true};
  return {...candidate,ai,base};
 });
 const days=candidate=>candidate.date?dayNumber(candidate.date.value)-today:Infinity;
 return candidates.sort((left,right)=>right.pending-left.pending||left.weak-right.weak||days(left)-days(right)||(right.latest.day??0)-(left.latest.day??0));
}

// Replies from a person's own model are untrusted text: parse, then keep only known fields with bounded length.
function parseAiItems(text,types=[]){
 const raw=String(text||'').replace(/```(?:json)?/gi,''),start=raw.indexOf('{'),end=raw.lastIndexOf('}');
 const read=part=>{try{return JSON.parse(part);}catch{return null;}},open=raw.indexOf('['),close=raw.lastIndexOf(']');
 let value=start>=0&&end>start?read(raw.slice(start,end+1)):null;
 if(!Array.isArray(value?.items)){const list=open>=0&&close>open?read(raw.slice(open,close+1)):null;value=Array.isArray(list)?{items:list}:null;}
 if(!value)return null;
 const clean=(input,max)=>{const field=typeof input==='string'||typeof input==='number'?String(input).replace(/\s+/g,' ').trim():'';return /^(?:null|none|n\/a|unknown|未知|无)$/i.test(field)?'':field.slice(0,max);};
 return value.items.slice(0,10).filter(item=>item&&typeof item==='object').map(item=>{
  const amount=clean(item.amount,24).replace(/,/g,'').replace(/^[^\d]+/,''),code=clean(item.currency,8).toUpperCase(),date=clean(item.date,10),paidDate=clean(item.paidDate,10);
  return {
   name:clean(item.name,100),merchant:clean(item.merchant,80),type:types.includes(item.type)?item.type:null,
   amount:/^\d+(?:\.\d{1,2})?$/.test(amount)&&Number(amount)>0?amount:'',currency:code==='RMB'?'CNY':/^[A-Z]{3}$/.test(code)?code:'',
   cycle:billingCycles[item.cycle]?item.cycle:null,date:dayNumber(date)!==null?date:null,dateKind:dateKinds[item.dateKind]?item.dateKind:null,
   paidDate:dayNumber(paidDate)!==null?paidDate:null,account:clean(item.account,100),quote:clean(item.quote,120)
  };
 }).filter(item=>item.name||item.merchant);
}

// Overlay one AI item on the rule-based candidate. With several items, fields are not borrowed from the rules.
function applyAiItem(base,item,{assets=[],now=new Date(),fallback=true}={}){
 const today=localDay(now),cycle=item.cycle||(fallback?base.cycle:null);
 const amount=item.amount?{currency:item.currency||(fallback?base.amount?.currency||'':''),value:item.amount}:fallback?base.amount:null;
 let date=fallback?base.date:null;
 if(item.date){const value=cycle&&dayNumber(item.date)<today?nextOccurrence(item.date,cycle,today):item.date;date={value,kind:item.dateKind||'expire',source:'ai',basis:value===item.date?'AI 从原文识别':`AI 识别为 ${item.date}，按${billingCycles[cycle].label}顺延`};}
 else if(item.paidDate&&cycle)date={value:nextOccurrence(item.paidDate,cycle,today),kind:'renew',source:'ai',basis:`AI 识别付款日 ${item.paidDate}，按${billingCycles[cycle].label}推算`};
 const merchant=item.merchant||base.merchant,name=item.name||(fallback?base.name:merchant),type=item.type||base.type;
 const domains=type==='domain'&&name?[name.toLowerCase(),...base.domains]:base.domains;
 return {...base,merchant,name,type,amount,cycle,cost:formatCost(amount,cycle),date,account:item.account,quote:item.quote,
  match:matchAsset(assets,{merchant,name,domains,senderDomain:base.senderDomain})||(fallback&&!item.name?base.match:null),weak:false};
}

// Cross-border accounts: region code, Chinese name and calling code.
const regionList=[['CN','中国大陆','86'],['HK','中国香港','852'],['MO','中国澳门','853'],['TW','中国台湾','886'],['US','美国','1'],['GB','英国','44'],['JP','日本','81'],['KR','韩国','82'],['SG','新加坡','65'],['MY','马来西亚','60'],['TH','泰国','66'],['VN','越南','84'],['PH','菲律宾','63'],['ID','印度尼西亚','62'],['IN','印度','91'],['AU','澳大利亚','61'],['NZ','新西兰','64'],['CA','加拿大','1'],['MX','墨西哥','52'],['BR','巴西','55'],['AR','阿根廷','54'],['DE','德国','49'],['FR','法国','33'],['NL','荷兰','31'],['IE','爱尔兰','353'],['ES','西班牙','34'],['IT','意大利','39'],['CH','瑞士','41'],['SE','瑞典','46'],['PL','波兰','48'],['UA','乌克兰','380'],['RU','俄罗斯','7'],['KZ','哈萨克斯坦','7'],['TR','土耳其','90'],['AE','阿联酋','971'],['SA','沙特阿拉伯','966'],['IL','以色列','972'],['PK','巴基斯坦','92'],['NG','尼日利亚','234'],['ZA','南非','27'],['EG','埃及','20']];
function regionName(code){return regionList.find(([id])=>id===code)?.[1]||'';}
function regionFlag(code){return /^[A-Z]{2}$/.test(code||'')?String.fromCodePoint(...[...code].map(letter=>0x1F1A5+letter.charCodeAt(0))):'';}

// Phone numbers are stored in full and shown masked. A leading + or 00 marks an international number; the longest known calling code wins.
function phoneParts(value){
 const text=String(value||'').trim(),digits=text.replace(/\D/g,'');
 if(!digits)return null;
 const intl=/^(?:\+|00)/.test(text),body=text.startsWith('00')?digits.slice(2):digits;
 const code=intl?[...new Set(regionList.map(region=>region[2]))].sort((left,right)=>right.length-left.length).find(prefix=>body.startsWith(prefix))||'':'';
 return {code,local:code?body.slice(code.length):body,intl};
}
function regionFromPhone(value){const code=phoneParts(value)?.code;return code?regionList.find(region=>region[2]===code)[0]:'';}
function maskPhone(value){const parts=phoneParts(value);if(!parts)return '';if(parts.local.length<4)return String(value).trim();return `${parts.code?`+${parts.code} `:parts.intl?'+':''}••• ${parts.local.slice(-4)}`;}
function maskEmail(value){const text=String(value||'').trim(),at=text.lastIndexOf('@');if(at<1)return text;const user=text.slice(0,at);return `${user.slice(0,user.length>2?2:1)}•••${text.slice(at)}`;}

// Card expiry is written MM/YY or MM/YYYY and stored as the last day of that month.
function cardExpiry(value){const match=/^\s*(0?[1-9]|1[0-2])\s*\/\s*(\d{2}|\d{4})\s*$/.exec(String(value||''));if(!match)return null;const year=match[2].length===2?2000+Number(match[2]):Number(match[2]);return isoDay(Date.UTC(year,Number(match[1]),0)/DAY_MS);}
function expiryText(date){const match=/^(\d{4})-(\d{2})-\d{2}$/.exec(date||'');return match?`${match[2]}/${match[1].slice(2)}`:'';}

// Full card numbers are never stored: a 13–19 digit run starting 2–6 that passes the Luhn check is treated as one.
function looksLikeCardNumber(text){
 for(const match of String(text||'').matchAll(/(?:\d[ -]?){12,18}\d/g)){
  const digits=match[0].replace(/\D/g,'');
  if(digits.length<13||digits.length>19||!/^[2-6]/.test(digits))continue;
  let sum=0;
  for(let i=0;i<digits.length;i++){let digit=Number(digits[digits.length-1-i]);if(i%2){digit*=2;if(digit>9)digit-=9;}sum+=digit;}
  if(sum%10===0)return true;
 }
 return false;
}

// Links between records (an account, the card that pays for it, the number that verifies it) are symmetric.
function linkAssets(assets,leftId,rightId){
 const left=assets.find(asset=>asset.id===leftId),right=assets.find(asset=>asset.id===rightId);
 if(!left||!right||left===right)return false;
 let changed=false;
 for(const [from,to] of [[left,right],[right,left]]){const links=Array.isArray(from.links)?from.links:[];if(!links.includes(to.id)){from.links=[...links,to.id];changed=true;}}
 return changed;
}
function unlinkAssets(assets,leftId,rightId){
 let changed=false;
 for(const [from,to] of [[leftId,rightId],[rightId,leftId]]){const asset=assets.find(item=>item.id===from);if(Array.isArray(asset?.links)&&asset.links.includes(to)){asset.links=asset.links.filter(id=>id!==to);changed=true;}}
 return changed;
}
function linkedAssets(assets,asset){const ids=new Set(Array.isArray(asset?.links)?asset.links:[]);return assets.filter(item=>item.id!==asset?.id&&(ids.has(item.id)||Array.isArray(item.links)&&item.links.includes(asset?.id)));}
function removeLinksTo(assets,id){for(const asset of assets)if(Array.isArray(asset.links)&&asset.links.includes(id))asset.links=asset.links.filter(item=>item!==id);}

// Icon sources (DESIGN-PRINCIPLES §9 rule 16). Every host here is a vendor's public homepage, checked by hand on 2026-10-09;
// `tried` notes hosts that did not give a usable icon. A person's own names (domains, repositories, servers) never become a host.
const iconVendors=[
 // Registrars and DNS
 {host:'cloudflare.com',label:'Cloudflare',match:/cloudflare|\bR2\b/i},
 {host:'namecheap.com',label:'Namecheap',match:/namecheap/i},
 {host:'godaddy.com',label:'GoDaddy',match:/godaddy/i},
 {host:'porkbun.com',label:'Porkbun',match:/porkbun/i},
 {host:'gandi.net',label:'Gandi',match:/gandi/i},
 {host:'dynadot.com',label:'Dynadot',match:/dynadot/i},
 {host:'squarespace.com',label:'Squarespace',match:/squarespace|google\s*domains/i},
 {host:'dnspod.cn',label:'DNSPod',match:/dnspod/i},
 {host:'west.cn',label:'西部数码',match:/西部数码|west\.cn/i},
 {host:'xinnet.com',label:'新网',match:/新网|xinnet/i},
 // Clouds and hosting
 {host:'aliyun.com',label:'阿里云',match:/阿里云|万网|aliyun|alibaba\s*cloud|alibabacloud/i,tried:['alibabacloud.com: 只有 32px favicon，且部分网络下握手失败']},
 {host:'cloud.tencent.com',label:'腾讯云',match:/腾讯云|tencent\s*cloud|tencentcloud|qcloud/i,tried:['tencentcloud.com: 每个路径都返回脚本渲染的页面，没有图标']},
 {host:'huaweicloud.com',label:'华为云',match:/华为云|huawei\s*cloud|huaweicloud/i},
 {host:'cloud.baidu.com',label:'百度智能云',match:/百度智能云|百度云|baidu\s*cloud/i},
 {host:'aws.amazon.com',label:'AWS',match:/\baws\b|amazon\s*web\s*services|lightsail|\bec2\b|亚马逊云/i},
 {host:'cloud.google.com',label:'Google Cloud',match:/google\s*cloud|\bgcp\b|firebase/i},
 {host:'azure.microsoft.com',label:'Azure',match:/azure/i},
 {host:'digitalocean.com',label:'DigitalOcean',match:/digital\s*ocean|droplet/i},
 {host:'vultr.com',label:'Vultr',match:/vultr/i},
 {host:'linode.com',label:'Linode',match:/linode|akamai/i,tried:['akamai.com: 首页对自动请求返回 403']},
 {host:'hetzner.com',label:'Hetzner',match:/hetzner/i},
 {host:'ovhcloud.com',label:'OVHcloud',match:/\bovh/i},
 {host:'scaleway.com',label:'Scaleway',match:/scaleway/i},
 {host:'fly.io',label:'Fly.io',match:/fly\.io/i},
 {host:'render.com',label:'Render',match:/^render\b|render\.com/i},
 {host:'railway.com',label:'Railway',match:/railway/i},
 {host:'vercel.com',label:'Vercel',match:/vercel/i},
 {host:'netlify.com',label:'Netlify',match:/netlify/i},
 {host:'racknerd.com',label:'RackNerd',match:/racknerd/i},
 {host:'bandwagonhost.com',label:'搬瓦工',match:/搬瓦工|bandwagon|\bbwh\b/i,tried:['bandwagonhost.com: 页面没有声明图标，/favicon.ico 返回 404']},
 // Code, deployment and storage
 {host:'github.com',label:'GitHub',match:/github|copilot/i},
 {host:'gitlab.com',label:'GitLab',match:/gitlab/i},
 {host:'gitee.com',label:'Gitee',match:/gitee|码云/i},
 {host:'bitbucket.org',label:'Bitbucket',match:/bitbucket/i},
 {host:'supabase.com',label:'Supabase',match:/supabase/i},
 {host:'backblaze.com',label:'Backblaze',match:/backblaze/i},
 // Subscriptions and AI
 {host:'apple.com',label:'Apple',match:/\bapple\b|icloud|app\s*store/i},
 {host:'google.com',label:'Google',match:/\bgoogle\b(?!\s*(cloud|domains))|google\s*one/i},
 {host:'microsoft.com',label:'Microsoft',match:/microsoft|office\s*365|microsoft\s*365|onedrive/i},
 {host:'adobe.com',label:'Adobe',match:/adobe|photoshop|creative\s*cloud/i},
 {host:'jetbrains.com',label:'JetBrains',match:/jetbrains|intellij|webstorm|pycharm/i},
 {host:'figma.com',label:'Figma',match:/figma/i},
 {host:'notion.so',label:'Notion',match:/notion/i},
 {host:'chatgpt.com',label:'ChatGPT',match:/chatgpt|openai/i},
 {host:'claude.ai',label:'Claude',match:/claude|anthropic/i},
 {host:'gemini.google.com',label:'Gemini',match:/gemini/i},
 {host:'midjourney.com',label:'Midjourney',match:/midjourney/i},
 {host:'perplexity.ai',label:'Perplexity',match:/perplexity/i},
 {host:'cursor.com',label:'Cursor',match:/cursor/i},
 {host:'deepseek.com',label:'DeepSeek',match:/deepseek/i},
 // Banks and carriers
 {host:'wise.com',label:'Wise',match:/\bwise\b/i},
 {host:'revolut.com',label:'Revolut',match:/revolut/i},
 {host:'hsbc.com.hk',label:'汇丰',match:/汇丰|hsbc/i},
 {host:'bochk.com',label:'中银香港',match:/中银香港|bochk/i},
 {host:'cmbchina.com',label:'招商银行',match:/招商银行|招行/i},
 {host:'giffgaff.com',label:'giffgaff',match:/giffgaff/i},
 {host:'cmlink.com',label:'CMLink',match:/cmlink/i}
];
// Types whose record name is the person's own thing (their domain, repository, machine, bucket…): only provider, account and source say who runs it.
const ownNamedTypes=new Set(['domain','server','database','repository','deployment','storage']);
// Known vendor for a host, including its subdomains (dash.cloudflare.com → Cloudflare).
function vendorForHost(host){const h=String(host||'').toLowerCase().replace(/^www\./,'');if(!h)return null;return iconVendors.find(v=>h===v.host||h.endsWith('.'+v.host))||null;}
// The vendor behind an asset, or null. Order: sync source, management link on a vendor host, provider/account text, then the name for service-named types.
function iconVendor(asset){
 if(!asset)return null;
 if(asset.source==='cloudflare')return vendorForHost('cloudflare.com');
 if(asset.source==='github')return vendorForHost('github.com');
 let linkHost='';try{linkHost=new URL(asset.url||'').hostname;}catch{}
 const byLink=vendorForHost(linkHost);if(byLink)return byLink;
 const text=[asset.provider,asset.account].filter(Boolean).join(' ');
 const byText=text&&iconVendors.find(v=>v.match.test(text));if(byText)return byText;
 if(asset.type==='appleid')return vendorForHost('apple.com');
 if(asset.type==='google')return vendorForHost('google.com');
 if(!ownNamedTypes.has(asset.type)&&asset.name)return iconVendors.find(v=>v.match.test(asset.name))||null;
 return null;
}
// Suggested website for the per-asset icon dialog (the person can change it). Beyond known vendors, a service-type asset may suggest its own management link;
// own-named types never suggest their link, which may be the person's own site.
function iconHost(asset){
 const vendor=iconVendor(asset);if(vendor)return vendor.host;
 if(ownNamedTypes.has(asset?.type))return '';
 try{const host=new URL(asset?.url||'').hostname.replace(/^www\./,'');if(host&&host!=='example.com')return host;}catch{}
 return '';
}
// Plan for 「为全部资产获取网站图标」: one request per vendor host, shared by every asset it serves. Only vendor hosts from iconVendors are ever listed.
// Assets with a custom icon are left alone (it wins anyway); assets that already have a site icon are skipped unless overwrite is set; hidden assets are skipped.
function iconPlan(assets,{overwrite=false}={}){
 const groups=new Map(),skipped={custom:0,existing:0,unknown:0,hidden:0};
 for(const asset of assets||[]){
  if(asset.hiddenAt){skipped.hidden++;continue;}
  if(typeof asset.iconData==='string'&&asset.iconData.startsWith('data:image/')){skipped.custom++;continue;}
  if(asset.siteIcon&&!overwrite){skipped.existing++;continue;}
  const vendor=iconVendor(asset);if(!vendor){skipped.unknown++;continue;}
  if(!groups.has(vendor.host))groups.set(vendor.host,{host:vendor.host,label:vendor.label,ids:[]});
  groups.get(vendor.host).ids.push(asset.id);
 }
 return {hosts:[...groups.values()].sort((a,b)=>b.ids.length-a.ids.length||a.host.localeCompare(b.host)),skipped};
}

// Display limits: how much the board shows at once, so large collections never flood the one-screen board.
// Data is never truncated; search and "查看全部" always show everything.
const DISPLAY_LIMITS={count:99,columns:4,cardRows:3,compactRows:4,listRows:2,featuredRows:2,strongDates:3};
function formatCount(value){const n=Math.max(0,Math.floor(Number(value)||0));return n>DISPLAY_LIMITS.count?DISPLAY_LIMITS.count+'+':String(n);}
// How many items fit in `rows` rows of `columns`; everything when it already fits.
function rowLimit(total,columns,rows){const max=Math.max(1,columns|0)*Math.max(1,rows|0);return total>max?max:total;}
// Featured cards fill whole rows only (no lone card on a last row), at most `maxRows` rows; the rest move to the list.
function wholeRows(total,columns,maxRows){const cols=Math.max(1,columns|0);if(total<=cols)return total;return cols*Math.max(1,Math.min(maxRows,Math.floor(total/cols)));}
// Overdue dates always keep their colour; of the "soon" ones only the most urgent few do, so a block never turns all amber.
function strongDateIds(assets,now=new Date(),limit=DISPLAY_LIMITS.strongDates){
 const rows=assets.filter(asset=>!asset.hiddenAt).map(asset=>({id:asset.id,status:assetDateStatus(asset,now)}));
 const soon=rows.filter(row=>row.status.level==='soon').sort((left,right)=>left.status.days-right.status.days).slice(0,limit);
 return new Set([...rows.filter(row=>row.status.level==='overdue'),...soon].map(row=>row.id));
}


// Batch import (2026-10-09): CSV/table paste, JSON backup restore. Pure; the UI decides when to preview.
const IMPORT_ROW_LIMIT=100;
const IMPORT_SECRET_HEADERS=/^(?:password|passwd|pwd|pass|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|auth|authorization|cvv|cvc|pin|ssn|信用卡|密码|令牌|密钥)$/i;
const IMPORT_HEADER_ALIASES={
 name:['name','domain','domain name','hostname','host name','asset','title','名称','域名','主机','资产','项目'],
 type:['type','category','kind','类别','类型','分类'],
 provider:['provider','registrar','vendor','platform','平台','注册商','厂商','服务商'],
 account:['account','owner','login','账号','账户','登录','归属'],
 date:['date','expiry','expires','expires at','expiration','expiration date','next date','renewal','due','到期','到期日','过期','下次','续费','扣款'],
 dateKind:['date kind','date type','日期类型'],
 cycle:['cycle','billing cycle','period','周期','计费周期'],
 cost:['cost','price','amount','fee','费用','价格','金额'],
 url:['url','link','management url','dashboard','网址','链接','管理链接'],
 notes:['notes','note','remark','comment','备注','说明'],
 purpose:['purpose','description','用途','描述']
};
const IMPORT_TYPE_ALIASES={
 domain:['domain','domains','域名'],
 server:['server','vps','droplet','instance','服务器','云主机'],
 subscription:['subscription','subscriptions','tool','tools','订阅','工具'],
 database:['database','db','数据库'],
 license:['license','licence','授权','许可证'],
 repository:['repository','repo','repositories','仓库','代码仓库'],
 deployment:['deployment','pages','worker','workers','部署','部署服务'],
 storage:['storage','bucket','r2','对象存储','存储'],
 ai:['ai','ai subscription','ai 订阅'],
 bankcard:['bankcard','card','银行卡'],
 phone:['phone','mobile','手机','手机号'],
 appleid:['appleid','apple id','apple'],
 google:['google','gmail','google 账号']
};
const VENDOR_CSV_PRESETS=[
 {id:'namecheap',label:'Namecheap',match:h=>h.includes('domain name')&&(h.includes('expires')||h.includes('expired date')),map:{name:'domain name',date:'expires',provider:()=>'Namecheap',type:()=>'domain'}},
 {id:'godaddy',label:'GoDaddy',match:h=>h.includes('domain name')&&(h.includes('expiration date')||h.includes('expires')),map:{name:'domain name',date:h=>h.find(x=>x.includes('expiration')||x==='expires')||'expiration date',provider:()=>'GoDaddy',type:()=>'domain'}},
 {id:'porkbun',label:'Porkbun',match:h=>h.includes('domain')&&h.includes('expire date'),map:{name:'domain',date:'expire date',provider:()=>'Porkbun',type:()=>'domain'}},
 {id:'aliyun',label:'阿里云',match:h=>(h.includes('域名')||h.includes('实例名称'))&&(h.includes('到期')||h.includes('到期日期')),map:{name:h=>h.find(x=>x.includes('域名')||x.includes('实例')||x==='名称')||'域名',date:h=>h.find(x=>x.includes('到期'))||'到期日期',provider:()=>'阿里云'}},
 {id:'tencent',label:'腾讯云',match:h=>h.includes('域名')&&h.includes('到期时间'),map:{name:'域名',date:'到期时间',provider:()=>'腾讯云',type:()=>'domain'}},
 {id:'vultr',label:'Vultr',match:h=>h.includes('label')&&(h.includes('main ip')||h.includes('ip address')),map:{name:'label',provider:()=>'Vultr',type:()=>'server',notes:h=>h.find(x=>x.includes('ip'))||'main ip'}},
 {id:'digitalocean',label:'DigitalOcean',match:h=>h.includes('name')&&h.includes('ip address')&&h.includes('region'),map:{name:'name',provider:()=>'DigitalOcean',type:()=>'server',account:'region'}},
 {id:'hetzner',label:'Hetzner',match:h=>h.includes('name')&&(h.includes('server')||h.includes('ipv4')),map:{name:'name',provider:()=>'Hetzner',type:()=>'server'}}
];

function normalizeImportHeader(value){return String(value||'').trim().toLowerCase().replace(/[\s_-]+/g,' ').replace(/[^\w\u4e00-\u9fa5 ]+/g,'');}
function importHeaderField(header){
 const key=normalizeImportHeader(header);
 if(IMPORT_SECRET_HEADERS.test(key.replace(/\s/g,'')))return 'secret';
 for(const [field,aliases] of Object.entries(IMPORT_HEADER_ALIASES))if(aliases.includes(key))return field;
 return null;
}
function importTypeFromText(value){
 const key=normalizeImportHeader(value);
 for(const [type,aliases] of Object.entries(IMPORT_TYPE_ALIASES))if(aliases.includes(key))return type;
 return null;
}
function splitDelimitedLine(line,delimiter){
 const cells=[];let current='',inQuotes=false;
 for(let i=0;i<line.length;i++){
  const ch=line[i];
  if(ch==='"'){if(inQuotes&&line[i+1]==='"'){current+='"';i++;}else inQuotes=!inQuotes;continue;}
  if(ch===delimiter&&!inQuotes){cells.push(current);current='';continue;}
  current+=ch;
 }
 cells.push(current);
 return cells.map(cell=>cell.trim());
}
function detectDelimiter(sample){
 const lines=sample.split(/\r?\n/).filter(line=>line.trim()).slice(0,5);
 if(!lines.length)return ',';
 const scores={'\t':0,',':0,';':0};
 for(const line of lines)for(const d of Object.keys(scores))scores[d]+=Math.max(0,splitDelimitedLine(line,d).length-1);
 return Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
}
function parseDelimitedText(text,{limit=IMPORT_ROW_LIMIT}={}){
 const raw=String(text||'').replace(/^\uFEFF/,'').trim();
 if(!raw)return {ok:false,error:'没有可解析的表格内容',headers:[],rows:[],droppedSecrets:[],truncated:null};
 const delimiter=detectDelimiter(raw);
 const lines=raw.split(/\r?\n/).filter(line=>line.trim());
 if(lines.length<2)return {ok:false,error:'表格至少需要表头和一行数据',headers:[],rows:[],droppedSecrets:[],delimiter};
 const headers=splitDelimitedLine(lines[0],delimiter);
 const droppedSecrets=[];
 const fields=headers.map(header=>{
  const field=importHeaderField(header);
  if(field==='secret'){droppedSecrets.push(header);return null;}
  return field;
 });
 if(!fields.includes('name')){
  // Vendor presets may still map a name column by raw header.
  const normalized=headers.map(normalizeImportHeader);
  const preset=VENDOR_CSV_PRESETS.find(item=>item.match(normalized));
  if(!preset)return {ok:false,error:'未识别到名称列。请包含「名称」或「域名」表头。',headers,rows:[],droppedSecrets,delimiter};
 }
 const dataLines=lines.slice(1);
 const truncated=dataLines.length>limit;
 const rows=dataLines.slice(0,limit).map((line,index)=>{
  const cells=splitDelimitedLine(line,delimiter);
  const row={_line:index+2};
  headers.forEach((header,i)=>{if(fields[i]&&fields[i]!=='secret')row[fields[i]]=cells[i]??'';row['raw:'+normalizeImportHeader(header)]=cells[i]??'';});
  return row;
 });
 const normalized=headers.map(normalizeImportHeader);
 const preset=VENDOR_CSV_PRESETS.find(item=>item.match(normalized))||null;
 return {ok:true,headers,rows,droppedSecrets,delimiter,truncated,preset,totalRows:dataLines.length};
}
function resolvePresetValue(spec,headers,row){
 if(typeof spec==='function'){
  const key=spec(headers.map(normalizeImportHeader));
  return typeof key==='string'?row['raw:'+normalizeImportHeader(key)]??row[key]??'':key;
 }
 if(typeof spec==='string')return row['raw:'+normalizeImportHeader(spec)]??row[importHeaderField(spec)]??'';
 return '';
}
function parseImportDate(value){
 const text=String(value||'').trim();
 if(!text)return '';
 for(const [pattern,read] of datePatterns){
  pattern.lastIndex=0;
  const match=pattern.exec(text);
  if(match){
   const [y,m,d]=read(match);
   if(y>=2000&&y<=2100&&m>=1&&m<=12&&d>=1&&d<=31)return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
 }
 return '';
}
function csvSyncKey(type,name){return syncKey('csv',`${type}:${String(name||'').trim().toLowerCase()}`);}
function rowsToImportItems(parsed,{types=Object.keys(IMPORT_TYPE_ALIASES)}={}){
 if(!parsed?.ok)return {items:[],unreadable:[{reason:parsed?.error||'无法解析'}]};
 const items=[],unreadable=[];
 const headers=parsed.headers.map(normalizeImportHeader);
 for(const row of parsed.rows){
  let name=String(row.name||'').trim();
  let type=importTypeFromText(row.type)||'';
  let provider=String(row.provider||'').trim();
  let account=String(row.account||'').trim();
  let date=parseImportDate(row.date);
  let dateKind=dateKinds[row.dateKind]?row.dateKind:'expire';
  let cycle=billingCycles[row.cycle]?row.cycle:'';
  let cost=String(row.cost||'').trim();
  let url=String(row.url||'').trim();
  let notes=String(row.notes||'').trim();
  let purpose=String(row.purpose||'').trim();
  if(parsed.preset){
   const map=parsed.preset.map;
   if(map.name)name=String(resolvePresetValue(map.name,parsed.headers,row)||name).trim();
   if(map.type)type=importTypeFromText(resolvePresetValue(map.type,parsed.headers,row))||(typeof map.type==='function'?map.type():type);
   if(map.provider)provider=String(resolvePresetValue(map.provider,parsed.headers,row)||provider).trim();
   if(map.account)account=String(resolvePresetValue(map.account,parsed.headers,row)||account).trim();
   if(map.date)date=parseImportDate(resolvePresetValue(map.date,parsed.headers,row))||date;
   if(map.notes){const extra=String(resolvePresetValue(map.notes,parsed.headers,row)||'').trim();if(extra)notes=notes?`${notes} · ${extra}`:extra;}
   if(map.cost)cost=String(resolvePresetValue(map.cost,parsed.headers,row)||cost).trim();
   if(map.url)url=String(resolvePresetValue(map.url,parsed.headers,row)||url).trim();
  }
  if(!type)type=guessAssetType(`${name} ${provider} ${notes} ${purpose}`,/\./.test(name)?[name.toLowerCase()]:[]);
  if(!types.includes(type))type='subscription';
  if(!name){unreadable.push({line:row._line,reason:'缺少名称',raw:row});continue;}
  if(url){try{const parsedUrl=new URL(url);if(!/^https?:$/.test(parsedUrl.protocol)||parsedUrl.username||parsedUrl.password)url='';}catch{url='';}}
  const externalId=`${type}:${name.toLowerCase()}`;
  items.push({name:name.slice(0,100),type,provider:provider.slice(0,80),account:account.slice(0,100),date,dateKind,cycle,cost:cost.slice(0,80),url:url.slice(0,2000),notes:notes.slice(0,2000),purpose:purpose.slice(0,100),source:'csv',externalId,vendorPreset:parsed.preset?.id||null});
 }
 return {items,unreadable,truncated:parsed.preset,droppedSecrets:parsed.droppedSecrets||[],truncated:parsed.truncated,totalRows:parsed.totalRows};
}
function classifyImportPayload({text='',filename='',mime=''}={}){
 const name=String(filename||'').toLowerCase(),type=String(mime||'').toLowerCase(),body=String(text||'');
 if(/\.(png|jpe?g|webp)$/i.test(name)||/^image\//.test(type))return {kind:'image',filename};
 if(/\.pdf$/i.test(name)||type==='application/pdf')return {kind:'pdf',filename};
 if(/\.csv$/i.test(name)||type==='text/csv'||type==='text/tab-separated-values')return {kind:'csv',filename,text:body};
 if(/\.tsv$/i.test(name))return {kind:'csv',filename,text:body};
 if(/\.json$/i.test(name)||type==='application/json')return {kind:'json',filename,text:body};
 const trimmed=body.trim();
 if(!trimmed)return {kind:'empty'};
 if(/^[\[{]/.test(trimmed)){
  try{const value=JSON.parse(trimmed);if(value&&typeof value==='object'&&(Array.isArray(value.assets)||Array.isArray(value.blocks)))return {kind:'json',filename,text:trimmed};}catch{}
 }
 if((trimmed.includes('\n')&&(/,|\t|;/.test(trimmed.split(/\n/,1)[0])))||(trimmed.includes('\t')&&trimmed.includes('\n'))){
  const parsed=parseDelimitedText(trimmed);
  if(parsed.ok)return {kind:'csv',filename,text:trimmed,parsed};
 }
 return {kind:'paste',text:trimmed};
}
function findCsvMatch(board,item){
 const key=csvSyncKey(item.type,item.name);
 const byKey=board.assets.find(asset=>assetSyncKey(asset)===key||(asset.source==='csv'&&asset.externalId===item.externalId));
 if(byKey)return byKey;
 return board.assets.find(asset=>asset.type===item.type&&asset.name===item.name&&asset.source!=='demo');
}
function planImport(board,items,{sameName='skip'}={}){
 const added=[],updated=[],collisions=[],skippedDeleted=[],hidden=[],skippedSame=[];
 if(!Array.isArray(board.deletedExternalIds))board={...board,deletedExternalIds:[]};
 for(const item of items||[]){
  const key=csvSyncKey(item.type,item.name);
  if(isBlacklisted(board,key)||isBlacklisted(board,`csv:${item.externalId}`)){skippedDeleted.push({item,key});continue;}
  const existing=findCsvMatch(board,item);
  if(existing){
   if(sameName==='skip'){skippedSame.push({item,assetId:existing.id,name:existing.name,hidden:!!existing.hiddenAt});continue;}
   const target={item,assetId:existing.id,name:existing.name,hidden:!!existing.hiddenAt};
   if(existing.hiddenAt)hidden.push(target);else updated.push(target);
   continue;
  }
  const collision=findNameCollision(board,'csv',item.name,item.type,item.externalId);
  if(collision){
   if(sameName==='skip'){skippedSame.push({item,assetId:collision.id,name:collision.name,hidden:!!collision.hiddenAt});continue;}
   collisions.push({item,assetId:collision.id,name:collision.name,hidden:!!collision.hiddenAt});
   continue;
  }
  added.push({item});
 }
 const conflicts=collisions.length+skippedDeleted.length+hidden.length>0;
 return {added,updated,collisions,skippedDeleted,hidden,skippedSame,conflicts,sameName};
}
function importItemFields(item,syncedAt){
 return {
  name:item.name,type:item.type,provider:item.provider||'',account:item.account||'',purpose:item.purpose||'',
  date:item.date||'',dateKind:item.dateKind||'expire',cycle:item.cycle||'',cost:item.cost||'未知',
  notes:item.notes||'',url:item.url||'',source:'csv',externalId:item.externalId,syncedAt,
  event:item.date?`${item.date} ${dateKinds[item.dateKind||'expire'].future}`:'日期待补充',art:'generic'
 };
}
function applyImport(board,plan,{restoreKeys=[],applySame=[],applyCollisions=[],now=new Date().toISOString()}={}){
 const next=structuredClone(board);
 if(!Array.isArray(next.deletedExternalIds))next.deletedExternalIds=[];
 const restore=new Set(restoreKeys);
 if(restore.size)next.deletedExternalIds=next.deletedExternalIds.filter(key=>!restore.has(key));
 const writeNew=entry=>{
  const fields=importItemFields(entry.item,now);
  const id='csv-'+cryptoRandomId();
  next.assets.push({id,createdAt:now,...fields});
  ensureBlock(next,fields.type);
  if(next.cardOrder?.[fields.type]?.length)next.cardOrder[fields.type].unshift(id);
 };
 const writeUpdate=(assetId,item)=>{
  const asset=next.assets.find(a=>a.id===assetId);if(!asset)return;
  const fields=importItemFields(item,now);
  Object.assign(asset,{name:fields.name,provider:fields.provider,account:fields.account,purpose:fields.purpose||asset.purpose,date:fields.date||asset.date,dateKind:fields.dateKind,cycle:fields.cycle||asset.cycle,cost:fields.cost==='未知'?asset.cost:fields.cost,notes:fields.notes||asset.notes,url:fields.url||asset.url,source:'csv',externalId:fields.externalId,syncedAt:now,updatedAt:now,event:fields.event});
  // Keep hiddenAt untouched.
  ensureBlock(next,asset.type);
 };
 for(const entry of plan.added||[])writeNew(entry);
 for(const entry of plan.updated||[])writeUpdate(entry.assetId,entry.item);
 for(const entry of plan.hidden||[])writeUpdate(entry.assetId,entry.item);
 for(const key of applySame){const entry=(plan.skippedSame||[]).find(row=>row.assetId===key||row.item.externalId===key);if(entry)writeUpdate(entry.assetId,entry.item);}
 for(const key of applyCollisions){const entry=(plan.collisions||[]).find(row=>row.assetId===key);if(entry)writeUpdate(entry.assetId,entry.item);}
 for(const entry of plan.skippedDeleted||[]){
  if(!restore.has(entry.key))continue;
  writeNew(entry);
 }
 return next;
}
function cryptoRandomId(){
 if(typeof crypto!=='undefined'&&crypto.randomUUID)return crypto.randomUUID();
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&0x3|0x8)).toString(16);});
}
function parseBoardBackup(text){
 let value;
 try{value=typeof text==='string'?JSON.parse(text):text;}catch{return {ok:false,error:'不是有效的 JSON'};}
 if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false,error:'备份需要是对象'};
 if(!Array.isArray(value.assets)||!Array.isArray(value.blocks))return {ok:false,error:'备份缺少 assets 或 blocks'};
 if(value.blocks.some(block=>!block||typeof block.id!=='string'))return {ok:false,error:'区块格式无效'};
 if(value.assets.some(asset=>!asset||typeof asset.id!=='string'||typeof asset.name!=='string'||typeof asset.type!=='string'))return {ok:false,error:'资产格式无效'};
 return {ok:true,board:{blocks:value.blocks,assets:value.assets,deletedExternalIds:Array.isArray(value.deletedExternalIds)?value.deletedExternalIds:[],evidenceDecisions:value.evidenceDecisions&&typeof value.evidenceDecisions==='object'?value.evidenceDecisions:{},cardOrder:value.cardOrder&&typeof value.cardOrder==='object'?value.cardOrder:{},featuredRepositoryIds:Array.isArray(value.featuredRepositoryIds)?value.featuredRepositoryIds:[],theme:value.theme}};
}
function planBoardBackup(current,backup,{mode='merge'}={}){
 if(!backup?.ok)return {ok:false,error:backup?.error||'无效备份',conflicts:true};
 if(mode==='replace')return {ok:true,mode:'replace',added:backup.board.assets.map(asset=>({item:asset})),updated:[],collisions:[],skippedDeleted:[],hidden:[],skippedSame:[],conflicts:true,board:backup.board};
 const added=[],updated=[],skippedDeleted=[];
 const currentIds=new Set(current.assets.map(a=>a.id));
 const deleted=new Set(current.deletedExternalIds||[]);
 for(const asset of backup.board.assets){
  if(deleted.has(asset.id)||(assetSyncKey(asset)&&deleted.has(assetSyncKey(asset)))){skippedDeleted.push({item:asset,key:assetSyncKey(asset)||asset.id});continue;}
  if(currentIds.has(asset.id))updated.push({item:asset,assetId:asset.id,name:asset.name,hidden:!!current.assets.find(a=>a.id===asset.id)?.hiddenAt});
  else added.push({item:asset});
 }
 const hidden=updated.filter(row=>row.hidden);
 const plainUpdated=updated.filter(row=>!row.hidden);
 return {ok:true,mode:'merge',added,updated:plainUpdated,collisions:[],skippedDeleted,hidden,skippedSame:[],conflicts:skippedDeleted.length+hidden.length>0,board:backup.board};
}
function applyBoardBackup(current,plan,{restoreKeys=[]}={}){
 if(plan.mode==='replace'){
  const next=structuredClone(plan.board);
  if(!Array.isArray(next.deletedExternalIds))next.deletedExternalIds=[];
  return next;
 }
 const next=structuredClone(current);
 if(!Array.isArray(next.deletedExternalIds))next.deletedExternalIds=[];
 const restore=new Set(restoreKeys);
 if(restore.size)next.deletedExternalIds=next.deletedExternalIds.filter(key=>!restore.has(key));
 const byId=new Map(next.assets.map(asset=>[asset.id,asset]));
 for(const entry of [...plan.updated,...plan.hidden]){
  const local=byId.get(entry.assetId);if(!local)continue;
  const incoming=entry.item;
  Object.assign(local,{...incoming,hiddenAt:local.hiddenAt,iconData:local.iconData||incoming.iconData,siteIcon:local.siteIcon||incoming.siteIcon,siteIconHost:local.siteIconHost||incoming.siteIconHost,notes:incoming.notes||local.notes});
  ensureBlock(next,local.type);
 }
 for(const entry of plan.added){
  if(byId.has(entry.item.id))continue;
  next.assets.push(structuredClone(entry.item));
  ensureBlock(next,entry.item.type);
 }
 for(const entry of plan.skippedDeleted){
  if(!restore.has(entry.key))continue;
  if(byId.has(entry.item.id))continue;
  next.assets.push(structuredClone(entry.item));
  ensureBlock(next,entry.item.type);
 }
 if(plan.board.evidenceDecisions)next.evidenceDecisions={...(next.evidenceDecisions||{}),...plan.board.evidenceDecisions};
 if(plan.board.cardOrder)next.cardOrder={...(next.cardOrder||{}),...plan.board.cardOrder};
 for(const key of plan.board.deletedExternalIds||[])if(!restore.has(key)&&!next.deletedExternalIds.includes(key))next.deletedExternalIds.push(key);
 return next;
}
function demoImportSampleCsv(){
 return ['名称,类别,平台,到期日,费用,备注','sample-studio.com,域名,示例注册商,2026-10-21,$10.98 / 年,演示用域名','demo-box-tokyo,服务器,Example VPS,2026-11-04,$6.00 / 月,演示用服务器','Example Notes Pro,订阅与工具,Example Notes,2026-11-06,$8.00 / 月,演示用订阅'].join('\n');
}

if(typeof module!=='undefined')module.exports={ACTION_FIELDS,QUICK_LIMIT,validActionField,sshCommand,cloneUrl,quickActions,recencyTime,recentFirst,arrangeAssets,touchedPrefix,swapInOrder,bringToFront,DISPLAY_LIMITS,formatCount,rowLimit,wholeRows,strongDateIds,blockDensity,setBlockDensity,ensureBlock,iconHost,iconVendor,iconVendors,vendorForHost,iconPlan,guessAssetType,regionList,regionName,regionFlag,phoneParts,regionFromPhone,maskPhone,maskEmail,cardExpiry,expiryText,looksLikeCardNumber,linkAssets,unlinkAssets,linkedAssets,removeLinksTo,assetFingerprint,removeUntouchedDemo,repositoryGroups,swapRepositoryDisplay,orderAssets,moveAsset,dateKinds,billingCycles,dayNumber,localDay,isoDay,addMonths,nextOccurrence,assetDateStatus,upcomingEvents,syncKey,assetSyncKey,isBlacklisted,findByExternal,findNameCollision,mergeCloudflare,mergeGitHub,applyCollision,parseSender,registrableDomain,cleanMerchant,findAmounts,findDates,findDomains,evidenceFacts,inferCycle,formatCost,matchAsset,buildCandidates,evidencePayload,parseAiItems,applyAiItem,IMPORT_ROW_LIMIT,parseDelimitedText,importHeaderField,rowsToImportItems,classifyImportPayload,planImport,applyImport,parseBoardBackup,planBoardBackup,applyBoardBackup,demoImportSampleCsv,csvSyncKey,VENDOR_CSV_PRESETS};
