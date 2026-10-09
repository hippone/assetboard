const test=require('node:test');
const assert=require('node:assert/strict');
const {removeUntouchedDemo,repositoryGroups,swapRepositoryDisplay,orderAssets,moveAsset}=require('../asset-data.js');

const sample={id:'a1',type:'domain',name:'halfnote.studio',provider:'Cloudflare',account:'个人账号',purpose:'写作工具',event:'12 天后到期',date:'2026-10-06',cost:'¥ 89 / 年',warn:true,art:'note',url:'https://example.com',notes:'主站域名，记录每一个从想法到作品的瞬间。'};

test('removes only untouched legacy demo records',()=>{
 const edited={...sample,purpose:'我的项目'};
 const manual={id:'asset-1',type:'domain',name:'my.dev',source:'manual'};
 const blocks=[{id:'domain',width:55},{id:'repository',width:45}];
 const result=removeUntouchedDemo({blocks,assets:[sample,edited,manual]});
 assert.equal(result.removed,1);
 assert.deepEqual(result.board.assets,[edited,manual]);
 assert.deepEqual(result.board.blocks,blocks);
});

test('leaves an already migrated board unchanged',()=>{
 const board={blocks:[],assets:[{id:'asset-1',type:'repository',name:'owner/repo',source:'github'}]};
 const result=removeUntouchedDemo(board);
 assert.equal(result.removed,0);
 assert.deepEqual(result.board,board);
});

test('removes the untouched sample layout and preserves a later custom block',()=>{
 const original=[['domain',60],['server',40],['subscription',40],['database',60]].map(([id,width])=>({id,width,collapsed:false,height:null}));
 const custom={id:'license',width:50,collapsed:false,height:null};
 const result=removeUntouchedDemo({blocks:[...original,custom],assets:[]});
 assert.equal(result.removedBlocks,4);
 assert.deepEqual(result.board.blocks,[custom]);
});

test('shows recently updated repositories first and swaps a compact one into the expanded group',()=>{
 const assets=Array.from({length:8},(_,index)=>({id:`repo-${index}`,type:'repository',name:`repo-${index}`,updatedAt:`2026-09-${String(index+1).padStart(2,'0')}T00:00:00Z`}));
 const initial=repositoryGroups(assets,null);
 assert.deepEqual(initial.featured.map(asset=>asset.id),['repo-7','repo-6','repo-5','repo-4','repo-3','repo-2']);
 assert.deepEqual(initial.compact.map(asset=>asset.id),['repo-1','repo-0']);
 const swapped=swapRepositoryDisplay(assets,initial.featured.map(asset=>asset.id),'repo-0');
 assert.deepEqual(repositoryGroups(assets,swapped).featured.map(asset=>asset.id),['repo-0','repo-7','repo-6','repo-5','repo-4','repo-3']);
 assert.equal(repositoryGroups(assets,swapped).compact.length,2);
});

test('preserves a user card order and places newly synced cards afterward',()=>{
 const assets=[{id:'new'},{id:'first'},{id:'second'}];
 const ids=moveAsset(['first','second'],'second','first');
 assert.deepEqual(ids,['second','first']);
 assert.deepEqual(orderAssets(assets,ids).map(asset=>asset.id),['second','first','new']);
 assert.deepEqual(moveAsset(ids,'second','second'),ids);
});

const {assetDateStatus,upcomingEvents,nextOccurrence,dayNumber,addMonths,mergeCloudflare,mergeGitHub,applyCollision,evidenceFacts,buildCandidates,inferCycle,parseSender,registrableDomain}=require('../asset-data.js');
const now=new Date(2026,8,29,15,0);

test('describes upcoming, due and overdue dates in local calendar days',()=>{
 assert.equal(assetDateStatus({date:'2026-10-06'},now).label,'7 天后到期');
 assert.equal(assetDateStatus({date:'2026-10-06'},now).level,'soon');
 assert.equal(assetDateStatus({date:'2026-09-29',dateKind:'renew'},now).label,'今天扣款');
 assert.equal(assetDateStatus({date:'2026-09-30',dateKind:'trial'},now).label,'明天试用结束');
 assert.equal(assetDateStatus({date:'2026-09-26'},now).label,'已过期 3 天');
 assert.equal(assetDateStatus({date:'2026-09-26'},now).level,'overdue');
 assert.equal(assetDateStatus({date:'2027-03-01'},now).label,'2027-03-01 到期');
 assert.equal(assetDateStatus({date:'2027-03-01'},now).level,'upcoming');
 assert.equal(assetDateStatus({date:''},now).level,'none');
 assert.equal(assetDateStatus({date:'2026-02-30'},now).level,'none');
});

test('rolls recurring dates forward from their anchor',()=>{
 const monthly=assetDateStatus({date:'2026-01-31',dateKind:'renew',cycle:'monthly'},now);
 assert.equal(monthly.date,'2026-09-30');
 assert.equal(monthly.rolled,true);
 assert.equal(addMonths('2026-01-31',1),'2026-02-28');
 assert.equal(nextOccurrence('2024-02-29','yearly',dayNumber('2026-09-29')),'2027-02-28');
 assert.equal(nextOccurrence('2025-10-15','yearly',dayNumber('2026-09-29')),'2026-10-15');
 assert.equal(nextOccurrence('2026-09-29','monthly',dayNumber('2026-09-29')),'2026-09-29');
});

test('lists visible dated assets soonest first',()=>{
 const assets=[{id:'late',name:'b',date:'2026-11-10'},{id:'hidden',name:'h',date:'2026-10-01',hiddenAt:'x'},{id:'soon',name:'a',date:'2026-10-02'},{id:'none',name:'n'},{id:'past',name:'p',date:'2026-09-20'},{id:'far',name:'f',date:'2027-06-01'}];
 assert.deepEqual(upcomingEvents(assets,now).map(item=>item.asset.id),['past','soon','late']);
});

test('merges Cloudflare resources without touching local notes and reports name collisions',()=>{
 const board={blocks:[],assets:[
  {id:'cloudflare-zone-z1',type:'domain',name:'old.dev',source:'cloudflare',resourceKind:'zone',externalId:'z1',notes:'mine',url:'https://dash.example.org'},
  {id:'asset-1',type:'domain',name:'clash.dev',source:'manual'},
  {id:'moved',type:'domain',name:'moved.dev',source:'cloudflare',resourceKind:'zone',externalId:'z3'},
  {id:'cloudflare-r2-gone',type:'storage',name:'gone',source:'cloudflare',resourceKind:'r2',externalId:'gone'},
  {id:'cloudflare-zone-gone',type:'domain',name:'gone.dev',source:'cloudflare',resourceKind:'zone',externalId:'gone'}
 ],deletedExternalIds:['cloudflare:zone:z9']};
 const result=mergeCloudflare(board,{queriedKinds:['zone'],resources:[
  {id:'z1',name:'new.dev',account:'acct',status:'active'},{id:'z2',name:'clash.dev',status:'active'},
  {id:'z3',name:'moved.dev',status:'active'},{id:'z9',name:'deleted.dev'},{id:'p1',kind:'pages',name:'site',status:'ok'}]},'2026-09-29T00:00:00Z');
 const byId=id=>result.board.assets.find(asset=>asset.id===id);
 assert.equal(board.assets[0].name,'old.dev','input board must not be mutated');
 assert.equal(byId('cloudflare-zone-z1').name,'new.dev');
 assert.equal(byId('cloudflare-zone-z1').notes,'mine');
 assert.equal(byId('cloudflare-zone-z1').url,'https://dash.example.org');
 assert.equal(byId('moved').syncMissing,false,'a record matched by platform id is not missing');
 assert.equal(byId('cloudflare-zone-gone').syncMissing,true);
 assert.equal(byId('cloudflare-r2-gone').syncMissing,undefined,'kinds that were not queried stay untouched');
 assert.equal(byId('cloudflare-zone-z9'),undefined,'deleted records are not re-added');
 assert.equal(byId('cloudflare-pages-p1').type,'deployment');
 assert.equal(result.added,1);
 assert.deepEqual(result.collisions.map(item=>item.assetId),['asset-1']);
 assert.equal(byId('asset-1').source,'manual','collisions wait for confirmation');
 assert.deepEqual(result.board.blocks.map(block=>block.id),['domain','deployment']);
 assert.ok(applyCollision(result.board,result.collisions[0]));
 assert.equal(byId('asset-1').source,'cloudflare');
 assert.equal(byId('asset-1').syncMissing,false);
});

test('merges GitHub repositories and marks missing ones',()=>{
 const board={blocks:[],assets:[{id:'github-repo-1',type:'repository',name:'me/a',source:'github',externalId:'1',notes:'keep'},{id:'github-repo-2',type:'repository',name:'me/b',source:'github',externalId:'2'},{id:'asset-x',type:'repository',name:'me/c',source:'manual'}]};
 const result=mergeGitHub(board,{repositories:[{id:'1',name:'me/a',owner:'me',url:'https://github.com/me/a',private:true},{id:'3',name:'me/c',owner:'me',archived:true}]});
 const byId=id=>result.board.assets.find(asset=>asset.id===id);
 assert.equal(byId('github-repo-1').notes,'keep');
 assert.equal(byId('github-repo-1').event,'私有仓库');
 assert.equal(byId('github-repo-2').syncMissing,true);
 assert.equal(result.collisions[0].fields.event,'已归档');
 assert.deepEqual(result.board.blocks.map(block=>block.id),['repository']);
});

test('reads sender, merchant and registrable domain',()=>{
 assert.deepEqual(parseSender('"Figma" <Billing@Figma.com>'),{name:'Figma',address:'billing@figma.com',host:'figma.com'});
 assert.equal(parseSender('noreply@github.com').name,'');
 assert.equal(registrableDomain('mail.notify.cloudflare.com'),'cloudflare.com');
 assert.equal(registrableDomain('billing.example.com.cn'),'example.com.cn');
 assert.equal(evidenceFacts({id:'g',kind:'gmail',source:'Namecheap Support <support@namecheap.com>',title:'Hi',body:''}).merchant,'Namecheap');
 assert.equal(evidenceFacts({id:'g',kind:'gmail',source:'no-reply@vercel.com',title:'Hi',body:''}).merchant,'Vercel');
});

test('extracts a stated renewal, amount and cycle from an English notice',()=>{
 const [candidate]=buildCandidates([{id:'gmail-1',kind:'gmail',source:'Figma <billing@figma.com>',title:'Your Professional plan renews soon',body:'Your Figma Professional plan will renew on October 6, 2026.\nYou will be charged $15.00/month.\nTax: $1.20',payload:JSON.stringify({date:'Mon, 21 Sep 2026 10:00:00 +0000'})}],{now});
 assert.equal(candidate.merchant,'Figma');
 assert.equal(candidate.type,'subscription');
 assert.equal(candidate.cost,'$15.00 / 月');
 assert.deepEqual(candidate.date,{value:'2026-10-06',kind:'renew',source:'stated',basis:'通知中写明'});
 assert.equal(candidate.pending,true);
});

test('recognizes a Chinese domain expiry notice',()=>{
 const [candidate]=buildCandidates([{id:'gmail-2',kind:'gmail',source:'阿里云通知 <noreply@notice.aliyun.com>',title:'域名到期提醒',body:'尊敬的用户，您的域名 halfnote.cn 将于 2026年10月20日 到期，请及时续费。\n续费价格：¥ 89 / 年\n详情见 https://www.aliyun.com/renew',payload:{date:'2026-09-20'}}],{assets:[{id:'mine',type:'domain',name:'halfnote.cn'}],now});
 assert.equal(candidate.merchant,'阿里云');
 assert.equal(candidate.type,'domain');
 assert.equal(candidate.name,'halfnote.cn');
 assert.equal(candidate.cost,'¥89 / 年');
 assert.equal(candidate.cycle,'yearly');
 assert.equal(candidate.date.value,'2026-10-20');
 assert.equal(candidate.date.kind,'expire');
 assert.equal(candidate.match,'mine');
});

test('groups monthly receipts and infers the next charge from their spacing',()=>{
 const receipt=(id,date)=>({id,kind:'gmail',source:'Notion Team <team@makenotion.com>',title:'Your receipt',body:'Total $10.00\nThanks for your payment.',payload:{date}});
 const candidates=buildCandidates([receipt('r1','2026-07-03'),receipt('r2','2026-08-03'),receipt('r3','2026-09-03'),{id:'other',kind:'gmail',source:'Acme <receipts+acct_1@stripe.com>',title:'Your receipt from Acme #1',body:'Amount paid ¥20'},{id:'other2',kind:'gmail',source:'Beta Co <receipts+acct_2@stripe.com>',title:'Your receipt from Beta Co #2',body:'Amount paid ¥30'}],{now,decisions:{other2:{status:'dismissed'}}});
 const notion=candidates.find(item=>item.key==='makenotion.com');
 assert.equal(notion.count,3);
 assert.equal(notion.merchant,'Notion');
 assert.equal(notion.cycle,'monthly');
 assert.equal(notion.cost,'$10.00 / 月');
 assert.equal(notion.date.value,'2026-10-03');
 assert.equal(notion.date.source,'inferred');
 assert.match(notion.date.basis,/3 封收据/);
 assert.equal(candidates.filter(item=>item.key.startsWith('stripe.com:')).length,2,'payment processor receipts stay separate per merchant');
 assert.equal(candidates.at(-1).key,'stripe.com:beta co');
 assert.equal(candidates.at(-1).pending,false);
 assert.equal(inferCycle([1,366,731]),'yearly');
 assert.equal(inferCycle([1,3]),null);
});

test('keeps pasted text without a date as a weak candidate',()=>{
 const [candidate]=buildCandidates([{id:'paste',kind:'paste',title:'粘贴的文字',body:'感谢订阅，我们会不定期发送更新。',importedAt:'2026-09-29T08:00:00Z'}],{now});
 assert.equal(candidate.weak,true);
 assert.equal(candidate.date,null);
});

const {parseAiItems,applyAiItem}=require('../asset-data.js');
const types=['domain','server','subscription','database','license','repository','deployment','storage'];

test('keeps only well-formed fields from a model reply',()=>{
 const reply='Here you go:\n```json\n{"items":[{"name":"  example.dev ","merchant":"Namecheap","type":"domain","amount":"1,299.00","currency":"rmb","cycle":"yearly","date":"2026-10-20","dateKind":"expire","paidDate":"null","account":null,"quote":"expires on Oct 20"},{"name":"x","type":"spaceship","amount":"free","currency":"dollars","cycle":"weekly","date":"2026-02-30","dateKind":"soon"},{"merchant":""},"junk"]}\n```';
 const items=parseAiItems(reply,types);
 assert.equal(items.length,2);
 assert.deepEqual(items[0],{name:'example.dev',merchant:'Namecheap',type:'domain',amount:'1299.00',currency:'CNY',cycle:'yearly',date:'2026-10-20',dateKind:'expire',paidDate:null,account:'',quote:'expires on Oct 20'});
 assert.deepEqual(items[1],{name:'x',merchant:'',type:null,amount:'',currency:'',cycle:null,date:null,dateKind:null,paidDate:null,account:'',quote:''});
 assert.deepEqual(parseAiItems('{"items":[]}',types),[]);
 assert.equal(parseAiItems('I cannot help with that.',types),null);
 assert.deepEqual(parseAiItems('[{"name":"Figma"}]',types).map(item=>item.name),['Figma']);
});

test('prefers an AI reading over rules and keeps rule inference it cannot see',()=>{
 const receipt=(id,date,ai)=>({id,kind:'gmail',source:'Apple <no_reply@email.apple.com>',title:'Your receipt from Apple.',body:'Total ¥68.00',payload:{date,...(ai?{ai:{provider:'anthropic',model:'m',at:'t',text:ai}}:{})}});
 const single=buildCandidates([receipt('a1','2026-07-10'),receipt('a2','2026-08-10'),receipt('a3','2026-09-10','{"items":[{"name":"iCloud+ 200GB","merchant":"Apple","type":"storage","amount":"21","currency":"CNY","cycle":"monthly","paidDate":"2026-09-10"}]}')],{now,types})[0];
 assert.equal(single.name,'iCloud+ 200GB');
 assert.equal(single.type,'storage');
 assert.equal(single.cost,'¥21 / 月');
 assert.deepEqual([single.date.value,single.date.source],['2026-10-10','ai']);
 assert.equal(single.ai.rowId,'a3');
 assert.equal(single.base.cost,'¥68.00 / 月','the rule reading stays available');
 const multi=buildCandidates([receipt('b1','2026-09-01','{"items":[{"name":"Notes Pro","merchant":"Acme","amount":"12","currency":"USD","cycle":"yearly","date":"2027-09-01","dateKind":"renew"},{"name":"Photo Lab","merchant":"Beta"}]}')],{now,types})[0];
 assert.equal(multi.name,'Notes Pro');
 const second=applyAiItem(multi.base,multi.ai.items[1],{now,fallback:false});
 assert.equal(second.name,'Photo Lab');
 assert.equal(second.date,null,'a second item does not borrow the first item\'s date');
 assert.equal(second.cost,'');
 const empty=buildCandidates([{id:'n',kind:'gmail',source:'News <hi@letters.io>',title:'Weekly',body:'Total $5',payload:{ai:{text:'{"items":[]}'}}}],{now,types})[0];
 assert.equal(empty.weak,true);
 const unreadable=buildCandidates([{id:'u',kind:'gmail',source:'Figma <billing@figma.com>',title:'Receipt',body:'Total $15.00',payload:{ai:{text:'sorry'}}}],{now,types})[0];
 assert.equal(unreadable.ai.unreadable,true);
 assert.equal(unreadable.cost,'$15.00','an unreadable reply keeps the rule reading');
});

test('rolls a past AI date forward only when it repeats',()=>{
 const base=buildCandidates([{id:'p',kind:'paste',title:'t',body:'',importedAt:'2026-09-29T00:00:00Z'}],{now})[0];
 assert.equal(applyAiItem(base,{name:'Figma',date:'2026-01-15',dateKind:'renew',cycle:'monthly'},{now}).date.value,'2026-10-15');
 assert.equal(applyAiItem(base,{name:'old.dev',date:'2026-01-15',dateKind:'expire'},{now}).date.value,'2026-01-15');
});

test('suggests an existing asset by its own name, not by a shared merchant',()=>{
 const {matchAsset}=require('../asset-data.js');
 const assets=[{id:'music',name:'Apple Music',provider:'Apple'},{id:'figma',name:'Figma Professional',provider:'Figma'},{id:'site',name:'example.dev',provider:'Registrar'}];
 assert.equal(matchAsset(assets,{name:'iCloud+ 200GB',merchant:'Apple',domains:[]}),null);
 assert.equal(matchAsset(assets,{name:'Apple Music',merchant:'Apple',domains:[]}),'music');
 assert.equal(matchAsset(assets,{name:'Figma',merchant:'Figma',domains:[]}),'figma');
 assert.equal(matchAsset(assets,{name:'example.dev',merchant:'Namecheap',domains:['example.dev']}),'site');
});

const {regionFlag,regionName,regionFromPhone,maskPhone,maskEmail,cardExpiry,expiryText,looksLikeCardNumber,linkAssets,unlinkAssets,linkedAssets,removeLinksTo,assetDateStatus:dateStatus,guessAssetType}=require('../asset-data.js');

test('shows regions as flags and names, and infers them from calling codes',()=>{
 assert.equal(regionFlag('US'),'🇺🇸');
 assert.equal(regionFlag('us'),'');
 assert.equal(regionName('HK'),'中国香港');
 assert.equal(regionFromPhone('+44 7700 900123'),'GB');
 assert.equal(regionFromPhone('00852 6123 4567'),'HK');
 assert.equal(regionFromPhone('+353 85 123 4567'),'IE');
 assert.equal(regionFromPhone('13800138000'),'');
});

test('masks phone numbers and emails but keeps enough to recognise them',()=>{
 assert.equal(maskPhone('+44 7700 900123'),'+44 ••• 0123');
 assert.equal(maskPhone('+1 (415) 555-2671'),'+1 ••• 2671');
 assert.equal(maskPhone('138 0013 8000'),'••• 8000');
 assert.equal(maskPhone(''),'');
 assert.equal(maskEmail('hans.dev@icloud.com'),'ha•••@icloud.com');
 assert.equal(maskEmail('a@gmail.com'),'a•••@gmail.com');
 assert.equal(maskEmail('not an email'),'not an email');
});

test('stores card expiry as the last day of the month and dates it',()=>{
 assert.equal(cardExpiry('08/28'),'2028-08-31');
 assert.equal(cardExpiry('2/2028'),'2028-02-29');
 assert.equal(cardExpiry('13/28'),null);
 assert.equal(expiryText('2028-08-31'),'08/28');
 assert.equal(dateStatus({date:'2026-10-31',dateKind:'expire'},new Date(2026,9,1)).label,'30 天后到期');
 assert.equal(dateStatus({date:'2026-10-05',dateKind:'keep',cycle:'halfyearly'},new Date(2026,9,1)).label,'4 天后保号到期');
 assert.equal(dateStatus({date:'2026-04-05',dateKind:'keep',cycle:'halfyearly'},new Date(2026,9,1)).date,'2026-10-05');
});

test('recognises full card numbers so they are never stored',()=>{
 assert.equal(looksLikeCardNumber('卡号 4111 1111 1111 1111'),true);
 assert.equal(looksLikeCardNumber('5555-5555-5555-4444'),true);
 assert.equal(looksLikeCardNumber('378282246310005'),true);
 assert.equal(looksLikeCardNumber('4111 1111 1111 1112'),false);
 assert.equal(looksLikeCardNumber('尾号 1111'),false);
 assert.equal(looksLikeCardNumber('+86 138 0013 8000'),false);
});

test('links records both ways and cleans up after a delete',()=>{
 const assets=[{id:'apple',type:'appleid'},{id:'card',type:'bankcard'},{id:'phone',type:'phone',links:['apple']}];
 assert.equal(linkAssets(assets,'apple','card'),true);
 assert.equal(linkAssets(assets,'card','apple'),false);
 assert.equal(linkAssets(assets,'apple','apple'),false);
 assert.deepEqual(linkedAssets(assets,assets[0]).map(asset=>asset.id),['card','phone']);
 assert.equal(unlinkAssets(assets,'card','apple'),true);
 assert.deepEqual(assets[0].links,[]);
 removeLinksTo(assets,'apple');
 assert.deepEqual(assets[2].links,[]);
});

test('files AI services under AI subscriptions',()=>{
 assert.equal(guessAssetType('Your ChatGPT Plus subscription renews',[]),'ai');
 assert.equal(guessAssetType('Receipt from Anthropic, PBC',[]),'ai');
 assert.equal(guessAssetType('Your Figma plan renews',[]),'subscription');
});

const {iconHost}=require('../asset-data.js');

test('suggests the website to fetch an icon from',()=>{
 assert.equal(iconHost({type:'bankcard',provider:'Wise',url:'https://www.wise.com/account'}),'wise.com');
 assert.equal(iconHost({type:'appleid',provider:'Apple'}),'apple.com');
 assert.equal(iconHost({type:'google',provider:'Google',url:'https://example.com'}),'google.com');
 assert.equal(iconHost({type:'ai',provider:'ChatGPT',name:'ChatGPT Plus'}),'chatgpt.com');
 assert.equal(iconHost({type:'bankcard',provider:'汇丰香港'}),'hsbc.com.hk');
 assert.equal(iconHost({type:'phone',provider:'某运营商'}),'');
});

const {blockDensity,setBlockDensity,ensureBlock:addBlockFor}=require('../asset-data.js');

test('reads the card style of old and new blocks',()=>{
 assert.equal(blockDensity({id:'domain',collapsed:true}),'compact');
 assert.equal(blockDensity({id:'domain',collapsed:false}),'full');
 assert.equal(blockDensity({id:'domain',density:'full',collapsed:true}),'full');
 const block={id:'domain',collapsed:true};
 setBlockDensity(block,'full');
 assert.deepEqual(block,{id:'domain',density:'full'});
 const board={blocks:[]};
 addBlockFor(board,'bankcard');
 assert.deepEqual(board.blocks,[{id:'bankcard',width:50,height:null,density:'full',folded:false}]);
});

test('display limits cap counts, rows and amber dates without touching data',()=>{
 const {formatCount,rowLimit,wholeRows,strongDateIds,DISPLAY_LIMITS}=require('../asset-data.js');
 assert.equal(formatCount(7),'7');assert.equal(formatCount(99),'99');assert.equal(formatCount(100),'99+');assert.equal(formatCount('x'),'0');
 assert.equal(rowLimit(5,4,3),5);assert.equal(rowLimit(13,4,3),12);assert.equal(rowLimit(3,0,0),1);
 assert.equal(wholeRows(3,4,2),3);assert.equal(wholeRows(6,4,2),4);assert.equal(wholeRows(6,3,2),6);assert.equal(wholeRows(12,4,2),8);assert.equal(wholeRows(6,5,2),5);
 const now=new Date(2026,9,9),day=n=>{const d=new Date(2026,9,9+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const assets=[-3,2,5,8,20,90].map((n,i)=>({id:'a'+i,type:'domain',name:'d'+i,date:day(n)})).concat({id:'h',type:'domain',name:'h',date:day(1),hiddenAt:'x'});
 const ids=strongDateIds(assets,now);
 assert.deepEqual([...ids].sort(),['a0','a1','a2','a3']);
 assert.equal(DISPLAY_LIMITS.columns,4);
});
