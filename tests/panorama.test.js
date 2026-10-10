const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../asset-data.js'),P=require('../panorama.js');
const day=n=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const ago=n=>new Date(Date.now()-n*86400000).toISOString();
function board(){
 const a=[
  {id:'s1',type:'server',name:'tokyo',updatedAt:ago(2),ips:['203.0.113.10','2001:db8::10'],date:day(10),dateKind:'renew'},
  {id:'s2',type:'server',name:'osaka',updatedAt:ago(9),ips:['198.51.100.24'],date:day(-1),dateKind:'renew'},
  {id:'s3',type:'server',name:'nas',updatedAt:ago(30),ips:['192.168.1.20']},
  {id:'s4',type:'server',name:'frankfurt',updatedAt:ago(5),ips:['198.51.100.9'],date:day(200),dateKind:'renew'},
  {id:'u1',type:'subscription',name:'Vultr',updatedAt:ago(1),date:day(5),dateKind:'renew'},{id:'u2',type:'subscription',name:'Hetzner',updatedAt:ago(1)},
  ...Array.from({length:6},(_,i)=>({id:'d'+i,type:'domain',name:'d'+i+'.test',updatedAt:ago(i+1)})),
  ...Array.from({length:4},(_,i)=>({id:'r'+i,type:'repository',name:'r'+i,updatedAt:ago(i+1)})),
  {id:'db',type:'database',name:'pg',updatedAt:ago(3)},{id:'li',type:'license',name:'lic',updatedAt:ago(4)},
  {id:'lone',type:'domain',name:'parked.test',updatedAt:ago(1)},{id:'lonerepo',type:'repository',name:'idea',updatedAt:ago(2)},{id:'hid',type:'domain',name:'hidden.test',hiddenAt:'2026-01-01'}
 ];
 const link=(x,y)=>D.linkRelation(a,x,y).ok||assert.fail(x+y);
 link('s1','u1');link('s4','u1');link('s2','u2');
 for(let i=0;i<6;i++)link('d'+i,'s1');
 for(let i=0;i<4;i++)link('r'+i,'s1');link('db','s1');link('li','s1');link('hid','s1');
 link('d0','s2');link('r0','s2');D.setLinkMeta(a,'d0','s2',{standby:true});D.setLinkMeta(a,'d1','s1',{proxied:true});
 return a;
}
const build=(a,extra)=>P.buildPanorama(a,extra);

test('panorama groups lanes under accounts, accounts by size then name, unaccounted last',()=>{
 const m=build(board());
 assert.deepEqual(m.accounts.map(x=>x.id),['u1','u2',null],'Vultr has two servers, Hetzner one, the NAS has no account');
 assert.deepEqual(m.accounts[0].lanes.map(l=>l.id),['s1','s4'],'servers inside an account follow recency');
 assert.deepEqual(m.accounts[2].lanes.map(l=>l.id),['s3']);
 assert.equal(m.accounts[0].tone,'amber','the account carries its own expiry colour');assert.equal(m.accounts[2].asset,null);
 assert.deepEqual(m.lanes.map(l=>[l.id,l.tone]),[['s1','amber'],['s4',''],['s2','red'],['s3','']].sort((x,y)=>m.lanes.findIndex(l=>l.id===x[0])-m.lanes.findIndex(l=>l.id===y[0])),'lane tone is the server\'s own date state');
 assert.deepEqual(m.totals,{server:4,domain:7,repository:5,database:2});
});
test('lanes: address, grouped mounts in recency order, real totals, hidden count, standby and proxied marks',()=>{
 const m=build(board()),lane=id=>m.lanes.find(l=>l.id===id);
 const s1=lane('s1');
 assert.equal(s1.ip.ip,'203.0.113.10');assert.equal(s1.ip.more,'v6');assert.equal(lane('s3').ip.inner,true);
 assert.deepEqual(s1.groups.map(g=>[g.key,g.total]),[['domain',6],['repository',4],['database',2]],'licences ride with databases');
 assert.deepEqual(s1.groups[0].chips.map(c=>c.id),['d0','d1','d2','d3','d4','d5'],'newest update first');
 assert.equal(s1.total,12);assert.equal(s1.hidden,1,'hidden mounts are counted, not drawn');
 assert.ok(!s1.groups[0].chips.some(c=>c.id==='hid'));
 const d1=s1.groups[0].chips[1];assert.equal(d1.proxied,true);assert.equal(d1.standby,false);
 const osaka=lane('s2').groups[0].chips[0];assert.deepEqual([osaka.id,osaka.standby,osaka.alsoOn],['d0',true,1],'the copy on the other server knows about its sibling');
 assert.equal(s1.groups[0].chips[0].alsoOn,1);assert.equal(s1.groups[0].chips[2].alsoOn,0);
 assert.deepEqual([...m.shared].map(([id,l])=>id+':'+l.join('+')).sort(),['d0:s1+s2','r0:s1+s2']);
});
test('manual order wins inside a lane, then recency',()=>{
 const m=build(board(),{cardOrder:{domain:['d5','d3']}});
 assert.deepEqual(m.lanes.find(l=>l.id==='s1').groups[0].chips.map(c=>c.id),['d5','d3','d0','d1','d2','d4']);
});
test('unmounted holds only things on no server, quietly, and caps at seven',()=>{
 let a=board();const m=build(a);
 assert.deepEqual(m.unmounted.items.map(c=>c.id),['lone','lonerepo']);assert.equal(m.unmounted.total,2);
 assert.ok(!m.unmounted.items.some(c=>c.id==='hid'),'hidden things are not listed');
 a.push(...Array.from({length:9},(_,i)=>({id:'x'+i,type:'domain',name:'x'+i,updatedAt:ago(20+i)})));
 const big=build(a),capped=P.capUnmounted(big);
 assert.equal(capped.shown.length,7);assert.equal(capped.more,4);assert.equal(P.capUnmounted(big,true).shown.length,11);
 assert.ok(!big.unmounted.items.some(c=>['db','li','d0'].includes(c.id)));
 // A thing whose only server is hidden is neither on a lane nor loose.
 a=board();a.find(x=>x.id==='s3').hiddenAt='2026-01-01';D.linkRelation(a,'lone','s3');
 const m2=build(a);assert.ok(!m2.unmounted.items.some(c=>c.id==='lone'));assert.equal(m2.hiddenLanes,1);assert.ok(!m2.lanes.some(l=>l.id==='s3'));
});
test('stopped marks and empty boards',()=>{
 const a=board();a.find(x=>x.id==='d2').stopped=true;a.find(x=>x.id==='s4').stopped=true;
 const m=build(a);assert.equal(m.lanes.find(l=>l.id==='s1').groups[0].chips.find(c=>c.id==='d2').stopped,true);assert.equal(m.lanes.find(l=>l.id==='s4').stopped,true);
 const empty=build([]);assert.deepEqual([empty.accounts.length,empty.lanes.length,empty.unmounted.total,empty.totals.server],[0,0,0,0]);
 const only=build([{id:'s',type:'server',name:'solo'}]);assert.equal(only.lanes.length,1);assert.deepEqual(only.accounts.map(x=>x.id),[null]);
 assert.equal(build([{id:'s',type:'server',name:'solo'}]).lanes[0].ip,null);
});
test('capChips and per-type caps on a full lane',()=>{
 assert.deepEqual(P.capChips([1,2,3,4,5],3),{shown:[1,2,3],more:2});assert.deepEqual(P.capChips([1],0),{shown:[],more:1});assert.deepEqual(P.capChips([],4),{shown:[],more:0});
 const m=build(board()),lane=m.lanes.find(l=>l.id==='s1'),full={level:1,perType:{domain:4,repository:3,database:2}};
 const v=P.laneView(lane,full);
 assert.deepEqual(v.groups.map(g=>[g.key,g.shown.length,g.more,g.total]),[['domain',4,2,6],['repository',3,1,4],['database',2,0,2]]);
 assert.equal(v.hidden,1);
});
test('density: full lanes while there is room, compact then tiles as it gets crowded, stacked when narrow',()=>{
 const f=(lanes,width,height,accounts=1)=>P.panoramaFit({lanes,accounts,width,height});
 let r=f(3,1320,822,2);assert.deepEqual([r.layout,r.level],['row',1]);assert.deepEqual(r.perType,{domain:4,repository:3,database:2},'a tall window gets the full caps');
 r=f(3,1320,420,2);assert.equal(r.level,1);assert.ok(r.perType.domain>=1&&r.perType.repository>=1&&r.perType.database>=1);assert.ok(r.perType.domain+r.perType.repository+r.perType.database<9,'less height, fewer rows');
 assert.equal(f(3,1320,360,2).level,2,'too short for a head and a row each');assert.equal(f(3,1320,300,2).level,3,'barely any height: tiles');
 assert.equal(f(4,900,822,2).level,2,'lanes under 210px');
 r=f(12,1320,822,3);assert.equal(r.level,2);assert.ok(r.columns>=4&&r.rows>=2&&r.pages===1);
 r=f(40,1320,822,6);assert.equal(r.level,3);assert.ok(r.pages>=1&&r.columns>=8);
 r=f(40,1320,300,6);assert.equal(r.level,3);assert.ok(r.pages>1,'a small window pages instead of scrolling');
 r=f(3,390,800,2);assert.deepEqual([r.layout,r.level],['stack',1]);
 r=f(0,1320,822,0);assert.equal(r.level,1);
 // Caps never exceed the lane caps and never drop below one row each.
 for(const h of [260,320,400,500,640,900,1400]){const x=f(2,1320,h,1);if(x.level===1)for(const [k,cap] of [['domain',4],['repository',3],['database',2]]){assert.ok(x.perType[k]>=1&&x.perType[k]<=cap,k+' at '+h);}}
 // Growing the window never lowers the density level.
 let last=3;for(const w of [500,700,900,1100,1320,1600,2000]){const x=f(10,w,900,2);if(x.layout==='row'){assert.ok(x.level<=last,'w='+w);last=x.level;}}
});
test('compact and tile views count every mount',()=>{
 const m=build(board()),lane=m.lanes.find(l=>l.id==='s1');
 const c=P.laneView(lane,{level:2,dots:5});
 assert.equal(c.dots.length,5);assert.equal(c.more,7);assert.deepEqual(c.counts.map(x=>x.total),[6,4,2]);assert.deepEqual(c.dots[1],{id:'d1',tone:'',stopped:false});
 const full=P.laneView(lane,{level:2,dots:24});assert.equal(full.dots.length,12);assert.equal(full.more,0);
 const t=P.laneView(lane,{level:3});assert.deepEqual([t.total,t.tone,t.hidden],[12,'amber',1]);
});
test('keyboard order walks accounts, lanes, then each lane\'s chips, then the unmounted strip',()=>{
 const m=build(board()),order=P.panoramaOrder(m);
 assert.deepEqual(order.slice(0,3).map(x=>x.kind+':'+x.id),['lane:s1','chip:d0','chip:d1']);
 const laneIds=order.filter(x=>x.kind==='lane').map(x=>x.id);assert.deepEqual(laneIds,['s1','s4','s2','s3']);
 assert.deepEqual(order.slice(-2).map(x=>x.id+'@'+x.group),['lone@unmounted','lonerepo@unmounted']);
});
