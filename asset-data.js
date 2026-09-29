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

function repositoryGroups(assets, preferredIds, limit=6){
 const repositories=assets.filter(asset=>asset.type==='repository').sort((left,right)=>{
  const difference=(Date.parse(right.updatedAt)||0)-(Date.parse(left.updatedAt)||0);
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
   next.assets.push({id,type,name:item.name,provider:'Cloudflare',account:item.account,purpose:kind==='zone'?'DNS Zone':kind==='r2'?'R2 Bucket':kind==='pages'?'Pages 项目':'Worker 脚本',event:item.status||'状态未知',date:'',cost:'未知',notes:'Cloudflare 资源列表同步；到期日和账单未知。',url:item.url,art:'generic',source:'cloudflare',resourceKind:kind,externalId:item.id,syncStatus:item.status,syncedAt});
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
   next.assets.push({id,type:'repository',name:repo.name,provider:'GitHub',account:repo.owner,purpose:repo.description?.slice(0,100)||'代码仓库',event:status,date:'',cost:'未知',notes:'GitHub 仓库元数据同步。',url:repo.url,art:'generic',source:'github',externalId:repo.id,updatedAt:repo.updatedAt||'',syncStatus:status,syncedAt});
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

// Suggested website for an asset's icon: its management link, then the account's own service, then well-known names. The person can change it.
const iconHints=[[/chatgpt|openai/i,'chatgpt.com'],[/claude|anthropic/i,'claude.ai'],[/gemini/i,'gemini.google.com'],[/midjourney/i,'midjourney.com'],[/perplexity/i,'perplexity.ai'],[/cursor/i,'cursor.com'],[/copilot|github/i,'github.com'],[/deepseek/i,'deepseek.com'],[/\bwise\b/i,'wise.com'],[/revolut/i,'revolut.com'],[/汇丰|hsbc/i,'hsbc.com.hk'],[/中银香港|bochk/i,'bochk.com'],[/招商银行|招行/i,'cmbchina.com'],[/giffgaff/i,'giffgaff.com'],[/cmlink/i,'cmlink.com'],[/figma/i,'figma.com'],[/notion/i,'notion.so'],[/cloudflare/i,'cloudflare.com']];
function iconHost(asset){
 try{const host=new URL(asset?.url||'').hostname.replace(/^www\./,'');if(host&&host!=='example.com')return host;}catch{}
 if(asset?.type==='appleid')return 'apple.com';
 if(asset?.type==='google')return 'google.com';
 const text=[asset?.provider,asset?.name].filter(Boolean).join(' ');
 return iconHints.find(([pattern])=>pattern.test(text))?.[1]||'';
}

if(typeof module!=='undefined')module.exports={blockDensity,setBlockDensity,ensureBlock,iconHost,guessAssetType,regionList,regionName,regionFlag,phoneParts,regionFromPhone,maskPhone,maskEmail,cardExpiry,expiryText,looksLikeCardNumber,linkAssets,unlinkAssets,linkedAssets,removeLinksTo,assetFingerprint,removeUntouchedDemo,repositoryGroups,swapRepositoryDisplay,orderAssets,moveAsset,dateKinds,billingCycles,dayNumber,localDay,isoDay,addMonths,nextOccurrence,assetDateStatus,upcomingEvents,syncKey,assetSyncKey,isBlacklisted,findByExternal,findNameCollision,mergeCloudflare,mergeGitHub,applyCollision,parseSender,registrableDomain,cleanMerchant,findAmounts,findDates,findDomains,evidenceFacts,inferCycle,formatCost,matchAsset,buildCandidates,evidencePayload,parseAiItems,applyAiItem};
