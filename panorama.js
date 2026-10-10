// Panorama (v13b): pure derivations for the read-only whole-board view. Nothing here touches the DOM, the network or storage;
// the view is built from the same `state.assets`, so it has no data of its own. "Status" is the registered status (expiry, manual stop), never a live probe.
(function(){
 const D=typeof module!=='undefined'&&module.exports?require('./asset-data.js'):window;
 // Chip groups under a server, in display order. Each caps at `cap` chips on a full lane.
 const GROUPS=[{key:'domain',types:['domain'],cap:4},{key:'repository',types:['repository'],cap:3},{key:'database',types:['database','license'],cap:2}];
 const UNMOUNTED_TYPES=['domain','repository','database'];
 const UNMOUNTED_CAP=7,DOT_CAP=24;
 const toneOf=level=>level==='overdue'?'red':level==='soon'?'amber':'';
 const orderFor=(cardOrder,types)=>types.flatMap(type=>Array.isArray(cardOrder?.[type])?cardOrder[type]:[]);
 const groupKeyOf=type=>GROUPS.find(g=>g.types.includes(type))?.key||'';

 function chipOf(assets,asset,serverId,now){
  const status=D.assetDateStatus(asset,now),meta=serverId?D.linkMetaOf(asset,serverId):{standby:false,proxied:false};
  const servers=D.serverChain(assets,asset).servers.filter(s=>!s.hiddenAt);
  return {id:asset.id,asset,type:asset.type,group:groupKeyOf(asset.type),tone:toneOf(status.level),days:status.days,stopped:!!asset.stopped,standby:meta.standby,proxied:meta.proxied,alsoOn:serverId?servers.filter(s=>s.id!==serverId).length:0};
 }

 // → {accounts, lanes, unmounted, totals, shared, hiddenLanes}
 //   accounts: [{id,asset,tone,lanes}] ; the last one has id null (servers without an account) when any exist.
 //   lane: {id,server,ip,tone,stopped,account,groups:[{key,total,chips}],total,hidden}
 function buildPanorama(assets,{cardOrder={},now=new Date()}={}){
  const visible=assets.filter(a=>!a.hiddenAt);
  const servers=D.arrangeAssets(visible.filter(a=>a.type==='server'),cardOrder.server);
  const lanes=servers.map(server=>{
   const chain=D.serverChain(assets,server),mounts=chain.mounts,shown=mounts.filter(a=>!a.hiddenAt);
   const groups=GROUPS.map(g=>{
    const list=D.arrangeAssets(shown.filter(a=>g.types.includes(a.type)),orderFor(cardOrder,g.types));
    return {key:g.key,total:list.length,chips:list.map(a=>chipOf(assets,a,server.id,now))};
   });
   const account=chain.accounts.find(a=>!a.hiddenAt)||null;
   return {id:server.id,server,ip:D.primaryIp(server),tone:toneOf(D.assetDateStatus(server,now).level),stopped:!!server.stopped,account:account?.id||null,groups,total:shown.length,hidden:mounts.length-shown.length};
  });
  const byAccount=new Map();
  for(const lane of lanes){if(!byAccount.has(lane.account))byAccount.set(lane.account,[]);byAccount.get(lane.account).push(lane);}
  const accounts=[...byAccount].filter(([id])=>id).map(([id,list])=>{const asset=assets.find(a=>a.id===id);return {id,asset,tone:toneOf(D.assetDateStatus(asset,now).level),lanes:list};})
   .sort((a,b)=>b.lanes.length-a.lanes.length||String(a.asset.name).localeCompare(String(b.asset.name)));
  if(byAccount.has(null))accounts.push({id:null,asset:null,tone:'',lanes:byAccount.get(null)});
  // Things that sit on no server at all. Quiet by design: no count of warnings, no prompt.
  const mounted=a=>D.serverChain(assets,a).servers.length>0;
  const loose=UNMOUNTED_TYPES.flatMap(type=>D.arrangeAssets(visible.filter(a=>a.type===type&&!mounted(a)),cardOrder[type]));
  const unmounted={total:loose.length,items:loose.map(a=>chipOf(assets,a,'',now))};
  const count=types=>visible.filter(a=>types.includes(a.type)).length;
  const totals={server:servers.length,domain:count(['domain']),repository:count(['repository']),database:count(['database','license'])};
  // A thing on several visible servers appears once per lane; `shared` maps its id to those server ids (hover draws the copies together).
  const shared=new Map();
  for(const lane of lanes)for(const g of lane.groups)for(const chip of g.chips){if(!shared.has(chip.id))shared.set(chip.id,[]);shared.get(chip.id).push(lane.id);}
  for(const [id,list] of [...shared])if(list.length<2)shared.delete(id);
  return {accounts,lanes,unmounted,totals,shared,hiddenLanes:assets.filter(a=>a.type==='server'&&a.hiddenAt).length};
 }

 // First `cap` chips and how many are left.
 function capChips(chips,cap){const n=Math.max(0,cap|0);return {shown:chips.slice(0,n),more:Math.max(0,chips.length-n)};}
 function capUnmounted(model,expanded=false){return expanded?{shown:model.unmounted.items,more:0}:capChips(model.unmounted.items,UNMOUNTED_CAP);}

 // Layout constants (px). Lane head = name, address, dot and counts; a row is one chip.
 const PAD=24,GAP=12,TOP=56,UNMOUNTED=64,TRAY_HEAD=34,TRAY_PAD=16,LANE_HEAD=84,ROW=26,L1_MIN_W=210,L2_W=150,L2_H=112,L3_W=120,L3_H=44,STACK_W=760,FULL_LANES=8;
 // Density from the window and the number of lanes: 1 full lane, 2 compact lane (head + one dot per mount), 3 tile (name + dot + count).
 // → {layout:'row'|'stack', level, perType:{domain,repository,database}|null, dots, columns, rows, pages}
 function panoramaFit({lanes=0,accounts=1,width=1320,height=822}={}){
  const caps={domain:GROUPS[0].cap,repository:GROUPS[1].cap,database:GROUPS[2].cap};
  if(width<=STACK_W)return {layout:'stack',level:1,perType:{domain:3,repository:2,database:2},dots:DOT_CAP,columns:1,rows:Math.max(1,lanes),pages:1};
  const inner=width-2*PAD,laneH=Math.max(0,height-TOP-UNMOUNTED-2*PAD-TRAY_HEAD-TRAY_PAD),groups=Math.max(1,accounts);
  const laneW=(inner-GAP*(lanes-1)-TRAY_PAD*groups)/Math.max(1,lanes);
  const area=Math.max(0,height-TOP-UNMOUNTED-2*PAD);
  if(lanes<=FULL_LANES&&laneW>=L1_MIN_W&&laneH>=LANE_HEAD+3*ROW){
   const perType={domain:1,repository:1,database:1};let spare=Math.floor((laneH-LANE_HEAD-8)/ROW)-3;
   for(let guard=0;spare>0&&guard<30;guard++){let moved=false;for(const key of ['domain','repository','database']){if(spare>0&&perType[key]<caps[key]){perType[key]++;spare--;moved=true;}}if(!moved)break;}
   return {layout:'row',level:1,perType,dots:DOT_CAP,columns:Math.max(1,lanes),rows:1,pages:1};
  }
  const cols2=Math.max(1,Math.floor((inner+GAP)/(L2_W+GAP))),rows2=Math.ceil(Math.max(1,lanes)/cols2);
  if(lanes<=24&&rows2*(L2_H+GAP)+TRAY_HEAD+TRAY_PAD<=area)return {layout:'row',level:2,perType:null,dots:DOT_CAP,columns:Math.min(cols2,Math.max(1,lanes)),rows:rows2,pages:1};
  const cols3=Math.max(1,Math.floor((inner+GAP)/(L3_W+GAP))),fit3=Math.max(1,Math.floor((area-TRAY_HEAD)/(L3_H+GAP))),perPage=cols3*fit3;
  return {layout:'row',level:3,perType:null,dots:0,columns:cols3,rows:Math.min(fit3,Math.ceil(Math.max(1,lanes)/cols3)),pages:Math.max(1,Math.ceil(lanes/perPage))};
 }

 // What a lane shows at a given density: capped chip groups (1), a dot per mount (2) or just the counts (3).
 function laneView(lane,fit){
  if(fit.level===1){
   return {level:1,groups:lane.groups.map(g=>({key:g.key,total:g.total,...capChips(g.chips,fit.perType?.[g.key]??GROUPS.find(x=>x.key===g.key).cap)})),hidden:lane.hidden};
  }
  const all=lane.groups.flatMap(g=>g.chips);
  if(fit.level===2){const c=capChips(all,fit.dots||DOT_CAP);return {level:2,dots:c.shown.map(x=>({id:x.id,tone:x.tone,stopped:x.stopped})),more:c.more,counts:lane.groups.map(g=>({key:g.key,total:g.total})),hidden:lane.hidden};}
  return {level:3,total:lane.total,tone:lane.tone,stopped:lane.stopped,hidden:lane.hidden};
 }

 // Flat reading order for keyboard movement: lane by lane (account groups left to right), a lane's head first, then its chips down the groups.
 function panoramaOrder(model){
  const out=[];
  for(const acc of model.accounts)for(const lane of acc.lanes){out.push({kind:'lane',id:lane.id,lane:lane.id});for(const g of lane.groups)for(const chip of g.chips)out.push({kind:'chip',id:chip.id,lane:lane.id,group:g.key});}
  for(const chip of model.unmounted.items)out.push({kind:'chip',id:chip.id,lane:null,group:'unmounted'});
  return out;
 }

 // The one write the panorama allows: re-hang a thing. `from` = the server it was dragged out of ('' when it came from the unmounted strip), `to` = the target server or null for the unmounted strip.
 //   default  = move here (the link to `from` goes, a link to `to` appears); keep = also here (the old link stays); to null = unlink from `from`.
 // → {ok, changed, kind:'move'|'also'|'detach'|'same'|'illegal'|'none', server}
 function moveMount(assets,assetId,{from='',to=null,keep=false}={}){
  const asset=assets.find(a=>a.id===assetId),target=to?assets.find(a=>a.id===to):null,origin=from?assets.find(a=>a.id===from):null;
  if(!asset||asset.type==='server'||asset.type==='subscription')return {ok:false,changed:false,kind:'illegal'};
  if(!to){if(!origin)return {ok:false,changed:false,kind:'none'};const changed=D.unlinkAssets(assets,assetId,from);return {ok:changed,changed,kind:'detach',server:origin};}
  if(!target||target.type!=='server'||!D.linkAllowed(asset,target))return {ok:false,changed:false,kind:'illegal'};
  if(from===to)return {ok:false,changed:false,kind:'same',server:target};
  const had=D.serverChain(assets,asset).servers.some(x=>x.id===to);
  let changed=false;
  if(origin&&!keep)changed=D.unlinkAssets(assets,assetId,from)||changed;
  if(!had)changed=D.linkRelation(assets,assetId,to).ok||changed;
  return {ok:changed,changed,kind:keep||!origin?'also':'move',server:target};
 }

 const api={moveMount,PANORAMA_GROUPS:GROUPS,PANORAMA_UNMOUNTED_CAP:UNMOUNTED_CAP,PANORAMA_DOT_CAP:DOT_CAP,buildPanorama,capChips,capUnmounted,panoramaFit,laneView,panoramaOrder};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else Object.assign(window,api);
})();
