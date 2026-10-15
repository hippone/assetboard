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

 // ---- v14b treemap. Pure geometry: rectangles in px, nothing drawn here. ----
 // Squarified treemap (Bruls et al.). items: [{id,value}] ; value ≤ 0 counts as 0. Order is stable: bigger first, ties keep input order.
 function squarify(items,rect){
  const R={x:rect.x||0,y:rect.y||0,w:Math.max(0,rect.w||0),h:Math.max(0,rect.h||0)};
  const total=items.reduce((s,i)=>s+Math.max(0,+i.value||0),0);
  if(!items.length)return [];
  if(!total||!R.w||!R.h)return items.map(i=>({id:i.id,x:R.x,y:R.y,w:0,h:0}));
  const scale=R.w*R.h/total;
  const list=items.map((i,n)=>({id:i.id,n,area:Math.max(0,+i.value||0)*scale})).sort((a,b)=>b.area-a.area||a.n-b.n);
  const out=[];
  const worst=(row,side)=>{if(!row.length)return Infinity;const s=row.reduce((a,r)=>a+r.area,0);let mx=0,mn=Infinity;for(const r of row){mx=Math.max(mx,r.area);mn=Math.min(mn,r.area);}if(!mn)return Infinity;return Math.max(side*side*mx/(s*s),s*s/(side*side*mn));};
  const place=row=>{
   const s=row.reduce((a,r)=>a+r.area,0);
   if(R.w>=R.h){const cw=R.h?s/R.h:0;let cy=R.y;for(const r of row){const rh=cw?r.area/cw:0;out.push({id:r.id,n:r.n,x:R.x,y:cy,w:cw,h:rh});cy+=rh;}R.x+=cw;R.w=Math.max(0,R.w-cw);}
   else{const ch=R.w?s/R.w:0;let cx=R.x;for(const r of row){const rw=ch?r.area/ch:0;out.push({id:r.id,n:r.n,x:cx,y:R.y,w:rw,h:ch});cx+=rw;}R.y+=ch;R.h=Math.max(0,R.h-ch);}
  };
  let row=[],i=0;
  while(i<list.length){const side=Math.min(R.w,R.h),next=[...row,list[i]];if(!row.length||worst(next,side)<=worst(row,side)){row=next;i++;}else{place(row);row=[];}}
  if(row.length)place(row);
  return out.sort((a,b)=>a.n-b.n).map(({id,x,y,w,h})=>({id,x,y,w,h}));
 }
 // A monthly figure from a free-text cost like "$6/月" or "€40 / 年". Currency is ignored on purpose: it only sizes blocks.
 function monthlyCost(asset){
  const text=String(asset?.cost||''),m=/(\d+(?:[.,]\d+)?)/.exec(text);if(!m)return 0;
  const v=parseFloat(m[1].replace(',','.'));if(!(v>0))return 0;
  const cycle=/年|yr|year/i.test(text)?'yearly':/季|quarter/i.test(text)?'quarterly':/月|mo/i.test(text)?'monthly':asset.cycle||'monthly';
  return v/({monthly:1,quarterly:3,halfyearly:6,yearly:12}[cycle]||1);
 }
 // Subdomains sit inside their parent when both hang on the same server. → [{chip,kids:[chip]}]
 function nestDomains(chips){
  const names=new Map(chips.map(c=>[String(c.asset.name).toLowerCase(),c]));
  const parentOf=c=>{const parts=String(c.asset.name).toLowerCase().split('.');for(let k=1;k<parts.length-1;k++){const p=names.get(parts.slice(k).join('.'));if(p&&p!==c)return p;}return null;};
  const roots=[],kids=new Map();
  for(const c of chips){const p=parentOf(c);if(p){if(!kids.has(p.id))kids.set(p.id,[]);kids.get(p.id).push(c);}else roots.push(c);}
  return roots.map(c=>({chip:c,kids:kids.get(c.id)||[]}));
 }
 // How much a block can say. icon: glyph only; compact: glyph + name; full: name + one fact (days, port, target) + bar.
 function leafForm(w,h){return w<64||h<30?'icon':w<132||h<50?'compact':'full';}
 const TM={BAND_HEAD:28,LANE_HEAD:52,GAP:6,PAD:8,LEAF_CAP:8,SUB_HEAD:52,MIN_SHARE:.12,MIN_COUNT:.2,MIN_BAND:.14};
 // model → {bands:[{id,rect,acc}],lanes:[{id,rect,lane}],leaves:[{id,lane,rect,form,chip,kind,parent,more}],metric}
 // metric 'count' sizes by how many things a server carries, 'cost' by the server's monthly cost (servers without one get a floor so they stay findable).
 function treemapLayout(model,{width=1200,height=700,metric='count',expanded=new Set(),cap=TM.LEAF_CAP}={}){
  const bands=[],lanes=[],leaves=[];
  const costs=new Map(model.lanes.map(l=>[l.id,monthlyCost(l.server)]));
  const maxCost=Math.max(0,...costs.values()),useCost=metric==='cost'&&maxCost>0;
  const maxCount=Math.max(1,...model.lanes.map(l=>l.total+1));
  const laneValue=l=>useCost?Math.max(costs.get(l.id),maxCost*TM.MIN_SHARE):Math.max(l.total+1,maxCount*TM.MIN_COUNT);
  const accs=model.accounts.filter(a=>a.lanes.length);
  const one=accs.length===1&&!accs[0].id;
  const bandVals=accs.map(a=>a.lanes.reduce((s,l)=>s+laneValue(l),0)),bandSum=bandVals.reduce((s,v)=>s+v,0);
  // A band never shrinks below a sliver that can still carry its name.
  const bandRects=squarify(bandVals.map((v,i)=>({id:i,value:Math.max(v,bandSum*TM.MIN_BAND)})),{x:0,y:0,w:width,h:height});
  accs.forEach((acc,i)=>{
   const r=inset(bandRects[i],TM.GAP/2);bands.push({id:acc.id,rect:r,acc});
   const head=one?0:TM.BAND_HEAD,inner={x:r.x+TM.PAD/2,y:r.y+head+(one?0:0),w:r.w-TM.PAD,h:r.h-head-TM.PAD/2};
   const lr=squarify(acc.lanes.map(l=>({id:l.id,value:laneValue(l)})),inner);
   acc.lanes.forEach((lane,k)=>{
    const rect=inset(lr[k],TM.GAP/2);lanes.push({id:lane.id,rect,lane});
    const body={x:rect.x+TM.PAD,y:rect.y+TM.LANE_HEAD,w:rect.w-2*TM.PAD,h:rect.h-TM.LANE_HEAD-TM.PAD};
    if(body.w<24||body.h<20)return;
    const units=[];
    for(const g of lane.groups){
     const open=expanded.has(lane.id+':'+g.key);
     const roots=g.key==='domain'?nestDomains(g.chips):g.chips.map(c=>({chip:c,kids:[]}));
     const shown=open?roots:roots.slice(0,cap),more=roots.length-shown.length;
     for(const u of shown)units.push({id:u.chip.id,value:1+u.kids.length*.6,chip:u.chip,kids:u.kids});
     if(more>0)units.push({id:lane.id+':'+g.key,value:.8,more,group:g.key});
    }
    const ur=squarify(units,body);
    units.forEach((u,j)=>{
     const rr=inset(ur[j],TM.GAP/2);
     if(u.more){leaves.push({id:u.id,lane:lane.id,rect:rr,form:leafForm(rr.w,rr.h),kind:'more',more:u.more,group:u.group});return;}
     const room=u.kids.length&&rr.h>=TM.SUB_HEAD+26&&rr.w>=110;
     leaves.push({id:u.id,lane:lane.id,rect:rr,form:room?'full':leafForm(rr.w,rr.h),chip:u.chip,kind:u.chip.type,kids:room?0:u.kids.length,nest:room});
     if(room){const kr=squarify(u.kids.map(c=>({id:c.id,value:1})),{x:rr.x+4,y:rr.y+TM.SUB_HEAD,w:rr.w-8,h:rr.h-TM.SUB_HEAD-4});
      u.kids.forEach((c,q)=>{const kk=inset(kr[q],2);leaves.push({id:c.id,lane:lane.id,rect:kk,form:leafForm(kk.w,kk.h),chip:c,kind:c.type,parent:u.id,kids:0});});}
    });
   });
  });
  return {bands,lanes,leaves,metric:useCost?'cost':'count',costAvailable:maxCost>0};
 }
 function inset(r,d){return {x:r.x+d,y:r.y+d,w:Math.max(0,r.w-2*d),h:Math.max(0,r.h-2*d)};}

 const api={squarify,monthlyCost,nestDomains,leafForm,treemapLayout,PANORAMA_TM:TM,moveMount,PANORAMA_GROUPS:GROUPS,PANORAMA_UNMOUNTED_CAP:UNMOUNTED_CAP,PANORAMA_DOT_CAP:DOT_CAP,buildPanorama,capChips,capUnmounted,panoramaFit,laneView,panoramaOrder};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else Object.assign(window,api);
})();
