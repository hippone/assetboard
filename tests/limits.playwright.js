// Run with the browser tool's filename option. Display limits and demo mode; never saves.
async (page) => {
 const p=await page.context().newPage();
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const errors=[];p.on('pageerror',error=>errors.push(error.message));
 try {
  await p.setViewportSize({width:1440,height:900});
  await p.goto('http://127.0.0.1:4317/');
  await p.evaluate(()=>{save=()=>{};const asset=(id,type,name,extra={})=>({id,type,name,provider:'Test',account:'',purpose:'Limit test',event:'',date:'',cost:'',art:'generic',url:'',source:'manual',...extra});
   const day=n=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
   state={blocks:[{id:'domain',width:100,height:null,density:'full',folded:false},{id:'repository',width:100,height:null,density:'full',folded:false}],assets:[
    ...Array.from({length:120},(_,i)=>asset('d'+i,'domain','limit-'+i+'.test',i<6?{date:day(i+1),dateKind:'expire'}:{})),
    ...Array.from({length:30},(_,i)=>asset('r'+i,'repository','org/repo-'+i,{source:'github',externalId:'x'+i,updatedAt:new Date(Date.now()-i*9e7).toISOString()}))],deletedExternalIds:[]};render();});
  await p.waitForTimeout(300);
  const domain=await p.evaluate(()=>{const block=document.querySelector('.block.domain'),grid=block.querySelector('.cards'),cards=[...grid.querySelectorAll(':scope > .asset-card')],shown=cards.filter(el=>el.style.display!=='none');return {cols:getComputedStyle(grid).gridTemplateColumns.split(' ').length,shown:shown.length,total:cards.length,count:block.querySelector('.asset-count').textContent,all:block.querySelector('[data-action="all"]').hidden?'':block.querySelector('[data-action="all"]').textContent+'|'+block.querySelector('[data-action="all"]').getAttribute('aria-label'),strong:block.querySelectorAll('.card-event.warn').length};});
  check(domain.cols===4,'At most 4 columns, got '+domain.cols);
  check(domain.shown===12&&domain.total===120,`Auto height shows 3 rows: ${domain.shown}/${domain.total}`);
  check(domain.count==='99+','Count caps at 99+: '+domain.count);
  check(domain.all==='全部 ›|查看全部域名，另 99+ 项','Hidden cards offer 查看全部: '+domain.all);
  check(domain.strong<=3,'At most 3 amber dates per block: '+domain.strong);
  const repo=await p.evaluate(()=>{const block=document.querySelector('.block.repository'),grid=block.querySelector('.cards'),featured=[...grid.querySelectorAll(':scope > .asset-card')].filter(el=>el.style.display!=='none').length,tiles=[...block.querySelectorAll('.compact-repo')].filter(el=>el.style.display!=='none').length;return {featured,tiles,cols:getComputedStyle(grid).gridTemplateColumns.split(' ').length,title:block.querySelector('.compact-repositories-title').getAttribute('aria-label'),listCols:getComputedStyle(block.querySelector('.compact-repositories-grid')).gridTemplateColumns.split(' ').length};});
  check(repo.featured%repo.cols===0,`Featured repositories fill whole rows: ${repo.featured} in ${repo.cols} columns`);
  check(repo.title==='其余 26 个仓库','Spilled featured cards move to the list: '+repo.title);
  check(repo.tiles===repo.listCols*2,`List shows 2 rows: ${repo.tiles} in ${repo.listCols} columns`);
  await p.click('.block.domain [data-action="all"]');await p.waitForTimeout(300);
  check(await p.evaluate(()=>[...document.querySelectorAll('.block.domain .asset-card')].filter(el=>el.style.display!=='none').length)===120,'查看全部 shows every card');
  await p.click('[data-action="back"]');await p.waitForTimeout(200);
  await p.fill('#search','limit-11');await p.waitForTimeout(250);
  check(await p.evaluate(()=>document.querySelectorAll('.block.domain .asset-card').length>=1&&!document.querySelector('.block.limited')),'Search is never limited');
  await p.fill('#search','');
  await p.evaluate(()=>{document.querySelector('.block.domain').scrollIntoView();});
  await p.setViewportSize({width:900,height:900});await p.waitForTimeout(250);
  check(await p.evaluate(()=>[...document.querySelectorAll('.block.domain .cards > .asset-card')].filter(el=>el.style.display!=='none').length%getComputedStyle(document.querySelector('.block.domain .cards')).gridTemplateColumns.split(' ').length===0),'Window resize re-applies row limits');
  // Demo mode: fictional board, nothing written.
  const before=await p.evaluate(()=>localStorage.getItem('assetboard-prototype-v1'));
  await p.goto('http://127.0.0.1:4317/?demo');await p.waitForTimeout(300);
  const demo=await p.evaluate(()=>({demo:document.documentElement.classList.contains('demo-mode'),badge:!!document.querySelector('.demo-badge'),assets:state.assets.length,ids:state.assets.every(a=>a.id.startsWith('demo-'))}));
  check(demo.demo&&demo.badge&&demo.assets>10&&demo.ids,'Demo board loads with its note');
  await p.click('.block.domain .asset-card [data-action="detail"]');await p.click('#detail [data-action="hide-asset"]');await p.waitForTimeout(150);
  check(await p.evaluate(()=>localStorage.getItem('assetboard-prototype-v1'))===before,'Demo mode never saves');
  check(!errors.length,'Page errors: '+errors.join(' | '));
  return 'PASS: 4-column cap, 3-row auto height with 查看全部, 99+ count, amber date cap, featured repositories in whole rows with spill to the list, 2-row list, full view and search unlimited, resize, demo board never saves';
 } finally { await p.close(); }
}
