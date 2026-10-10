// 「为全部资产获取网站图标」 with a fake native bridge standing in for the vendor sites: no network, nothing saved to disk.
async (page) => {
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const setup=async({demo=false,scheme='light'}={})=>{
  const context=await page.context().browser().newContext({colorScheme:scheme});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(({demo})=>{
   const canvasIcon=color=>{const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,32,32);return c.toDataURL('image/png');};
   // A black mark on a transparent square, like DigitalOcean's or Render's own icons.
   const black=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d');g.fillStyle='#000';g.beginPath();g.arc(16,16,9,0,Math.PI*2);g.fill();return c.toDataURL('image/png');})();
   window.__sent=[];window.__inflight=0;window.__maxInflight=0;window.__hold=false;window.__held=[];
   const answer=m=>{window.__inflight--;const h=m.host;window.assetboardIconResult(h==='bandwagonhost.com'?{requestId:m.requestId,ok:false,error:'没有在 bandwagonhost.com 找到可用的图标。有的网站会拒绝自动下载，可以在「编辑资料」里上传图标。'}:{requestId:m.requestId,ok:true,host:h,dataUrl:h==='digitalocean.com'?black:canvasIcon('#3a7')});};
   window.__release=()=>{const held=window.__held.splice(0);held.forEach(m=>setTimeout(()=>answer(m),5));};
   window.webkit={messageHandlers:{assetboard:{postMessage(m){window.__sent.push(m);
    if(m.action==='save')setTimeout(()=>window.assetboardSaved?.(m.sequence,true),5);
    if(m.action==='evidenceList')setTimeout(()=>window.assetboardEvidenceList?.([]),5);
    if(m.action==='iconFetch'){window.__inflight++;window.__maxInflight=Math.max(window.__maxInflight,window.__inflight);if(window.__hold)window.__held.push(m);else setTimeout(()=>answer(m),20+Math.random()*40);}
   }}}};
   const A=(id,type,name,provider,extra={})=>({id,type,name,provider,account:'',art:'generic',source:'manual',updatedAt:'2026-10-0'+(1+id.length%8)+'T00:00:00Z',...extra});
   window.__ASSETBOARD_NATIVE__={demo,data:{blocks:[{id:'domain',width:50,height:null},{id:'server',width:50,height:null},{id:'deployment',width:50,height:null}],assets:[
    A('d1','domain','secret-project.dev','Cloudflare',{url:'https://secret-project.dev'}),A('d2','domain','private-shop.cn','阿里云'),A('d3','domain','unknown-reg.org','某注册商'),
    A('p1','deployment','secret-pages','',{source:'cloudflare',externalId:'p1'}),
    A('s1','server','box-one','Vultr'),A('s2','server','box-two','Vultr'),A('s3','server','box-three','Hetzner',{siteIcon:black,siteIconHost:'hetzner.com'}),
    A('s4','server','box-four','DigitalOcean'),A('s5','server','box-five','搬瓦工'),A('s6','server','box-six','Linode',{hiddenAt:'2026-10-01T00:00:00Z'})]},cloudflareConnected:false,githubConnected:false,gmailConfigured:false};
  },{demo});
  await p.goto('http://127.0.0.1:4317/');await p.waitForFunction(()=>typeof iconBatchDialog==='function'&&document.querySelector('.asset-card'));
  return {p,context,errors};
 };
 // Confirm step: vendor homepages only, nothing contacted yet.
 let {p,context,errors}=await setup();
 try {
  await p.evaluate(()=>iconBatchDialog());
  const listed=await p.locator('.icon-batch-hosts li strong').allTextContents();
  check(JSON.stringify(listed.sort())===JSON.stringify(['aliyun.com','bandwagonhost.com','cloudflare.com','digitalocean.com','vultr.com']),'Confirm lists each vendor once: '+listed);
  const text=await p.locator('#icon-batch').textContent();
  for(const name of ['secret-project','private-shop','secret-pages','box-one','unknown-reg'])check(!text.includes(name),'The confirm step must not show asset names: '+name);
  check(text.includes('1 项没有识别出平台')&&text.includes('1 项已有网站图标')&&text.includes('1 项已隐藏'),'Skipped assets are counted: '+text);
  check(await p.evaluate(()=>!__sent.some(m=>m.action==='iconFetch')),'Nothing is fetched before confirmation');
  // Cancel mid-run changes nothing.
  await p.evaluate(()=>{__hold=true;});
  await p.locator('[data-action="icon-batch-start"]').click();
  check(await p.locator('#icon-batch progress').count()===1,'A quiet progress bar shows while fetching');
  check(await p.evaluate(()=>__inflight)===3,'Three requests at a time');
  await p.locator('[data-action="icon-batch-cancel"]').click();await p.evaluate(()=>{__hold=false;__release();});await p.waitForTimeout(150);
  check(await p.evaluate(()=>state.assets.filter(a=>a.siteIcon).length)===1,'Stopping keeps every asset as it was');
  check(await p.evaluate(()=>!iconBatch),'Stopping ends the run');

  // Full run: one request per vendor host, at most three in flight, failures reported, existing icon kept, one undo.
  await p.evaluate(()=>{__sent.length=0;__maxInflight=0;__inflight=0;iconBatchDialog();});
  await p.locator('[data-action="icon-batch-start"]').click();
  await p.locator('#icon-batch-done').waitFor();
  const fetched=await p.evaluate(()=>__sent.filter(m=>m.action==='iconFetch').map(m=>m.host).sort());
  check(JSON.stringify(fetched)===JSON.stringify(['aliyun.com','bandwagonhost.com','cloudflare.com','digitalocean.com','vultr.com']),'Each vendor is contacted exactly once: '+fetched);
  check(await p.evaluate(()=>__maxInflight)<=3,'Never more than three requests in flight');
  const result=await p.evaluate(()=>Object.fromEntries(state.assets.map(a=>[a.id,a.siteIconHost||''])));
  check(result.d1==='cloudflare.com'&&result.p1==='cloudflare.com'&&result.s1==='vultr.com'&&result.s2==='vultr.com'&&result.d2==='aliyun.com','Shared icons reach every asset of the vendor: '+JSON.stringify(result));
  check(result.s3==='hetzner.com'&&!result.d3&&!result.s5&&!result.s6,'Existing, unknown, failed and hidden assets are untouched');
  check((await p.locator('#icon-batch-done').textContent()).includes('bandwagonhost.com')&&(await p.locator('#icon-batch-done').textContent()).includes('官网没有可下载的图标'),'Failures are reported with a reason');
  check(await p.locator('#board [data-asset="s5"] .tile').count()===0,'A failed vendor stays without a card tile (the header carries the category icon)');
  await p.locator('#icon-batch-done [data-action="icon-batch-cancel"]').click();
  await p.locator('#toast .toast-undo').click();
  check(await p.evaluate(()=>state.assets.filter(a=>a.siteIcon).map(a=>a.id).join())==='s3','One undo removes every icon from the run');
  await p.keyboard.press('Meta+Shift+z');await p.waitForTimeout(100);
  check(await p.evaluate(()=>state.assets.filter(a=>a.siteIcon).length)===7,'Redo brings them back');

  // A new asset of a known vendor reuses the icon already on this Mac; overwriting is opt-in and fetches fresh icons.
  await p.evaluate(()=>{state.assets.push({id:'s7',type:'server',name:'box-seven',provider:'Vultr',art:'generic',source:'manual',updatedAt:'2026-10-09T00:00:00Z'});render();__sent.length=0;iconBatchDialog();});
  let hosts=await p.locator('.icon-batch-hosts li strong').allTextContents();
  check(JSON.stringify(hosts)==='["bandwagonhost.com"]'&&(await p.locator('#icon-batch').textContent()).includes('Vultr 的图标已在本机'),'Known vendor icons are reused without fetching: '+hosts);
  check(await p.locator('#icon-batch-overwrite').count()===1,'Overwriting is offered when icons exist');
  await p.locator('#icon-batch-overwrite').check();
  hosts=await p.locator('.icon-batch-hosts li strong').allTextContents();
  check(hosts.includes('hetzner.com')&&hosts.includes('vultr.com')&&hosts.length===6,'Overwrite fetches every vendor again: '+hosts);
  await p.locator('#modal').evaluate(d=>d.close());
  check(await p.evaluate(()=>!__sent.some(m=>m.action==='iconFetch')),'Closing the confirm step fetches nothing');
  check(!errors.length,'Page errors: '+errors.join(' | '));
 } finally { await context.close(); }

 // Dark mode: a black mark on transparency gets a light backing.
 ({p,context,errors}=await setup({scheme:'dark'}));
 try {
  await p.waitForFunction(()=>document.querySelector('#board [data-asset="s3"] .tile.mark-dark'));
  check(await p.locator('#board [data-asset="s3"] .tile').evaluate(e=>{const c=getComputedStyle(e).backgroundColor.match(/\d+/g).map(Number);return c[0]>200&&c[1]>200&&c[2]>200;}),'The backing is light in dark mode');
 } finally { await context.close(); }

 // Demo mode: the batch never opens and nothing is fetched.
 ({p,context,errors}=await setup({demo:true}));
 try {
  await p.evaluate(()=>iconBatchDialog());
  check(!(await p.evaluate(()=>document.querySelector('#modal').open)),'Demo mode does not open the batch');
  check((await p.locator('#toast').textContent()).includes('演示模式'),'Demo mode says why');
  check(await p.evaluate(()=>!__sent.some(m=>m.action==='iconFetch')),'Demo mode fetches nothing');
 } finally { await context.close(); }
 return 'PASS: vendor-only confirm list, no fetch before confirm, 3 in flight, stop keeps data, one request per vendor shared by its assets, existing/unknown/hidden untouched, failure reasons, category fallback, one undo and redo, opt-in overwrite with local reuse, dark backing, demo blocked';
}
