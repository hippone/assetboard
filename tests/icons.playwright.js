// Run with the browser tool's filename option. Stubs the Swift bridge, so no network or disk is used.
async (page) => {
 const p=await page.context().newPage();
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const errors=[];p.on('pageerror',error=>errors.push(error.message));
 await p.addInitScript(()=>{
  window.__sent=[];
  const png=()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const context=canvas.getContext('2d');context.fillStyle='#2f9e44';context.fillRect(0,0,32,32);return canvas.toDataURL('image/png');};
  const replies={
   save:m=>assetboardSaved(m.sequence,true),
   evidenceList:()=>assetboardEvidenceList([]),
   iconFetch:m=>setTimeout(()=>assetboardIconResult(m.host==='blocked.example'?{requestId:m.requestId,ok:false,error:'没有在 blocked.example 找到可用的图标。'}:{requestId:m.requestId,ok:true,host:m.host,dataUrl:png()}),m.host==='slow.example'?300:5)
  };
  window.webkit={messageHandlers:{assetboard:{postMessage(message){window.__sent.push(message);if(replies[message.action])setTimeout(()=>replies[message.action](message),5);}}}};
  window.__ASSETBOARD_NATIVE__={data:{blocks:[{id:'bankcard',width:50,collapsed:false,height:null},{id:'domain',width:50,collapsed:false,height:null}],assets:[
   {id:'wise',type:'bankcard',name:'Wise 美元卡',provider:'Wise',account:'',region:'US',last4:'0917',network:'Mastercard',art:'generic',source:'manual',links:['site']},
   {id:'site',type:'domain',name:'site.dev',provider:'Registrar',account:'',art:'generic',source:'manual',links:['wise']}]},cloudflareConnected:false,githubConnected:false,gmailConfigured:false};
 });
 try {
  await p.goto('http://127.0.0.1:4317/');
  await p.locator('[data-asset="wise"] .card-open').click();
  await p.locator('#detail [data-action="icon-dialog"]').click();
  check(await p.locator('#icon-form [name="host"]').inputValue()==='wise.com','The dialog suggests the service website');

  // Fetch, preview, then apply: nothing is saved before the confirmation.
  await p.locator('#icon-form [type="submit"]').click();
  await p.locator('#icon-preview img').waitFor();
  check(await p.evaluate(()=>__sent.some(m=>m.action==='iconFetch'&&m.host==='wise.com')),'The fetch goes through the native bridge');
  check(await p.evaluate(()=>!state.assets.find(a=>a.id==='wise').siteIcon),'Preview must not save');
  await p.locator('[data-action="icon-apply"]').click();
  check(await p.evaluate(()=>{const a=state.assets.find(a=>a.id==='wise');return a.siteIcon?.startsWith('data:image/png;base64,')&&a.siteIconHost==='wise.com';}),'Apply stores the icon and its host');
  check(await p.locator('[data-asset="wise"] .art image').count()===1,'A bank card shows the icon as a badge on its drawn art');
  check(await p.locator('[data-asset="site"] .link-chip .site-mark').count()===1,'Link chips show the icon');
  await p.locator('#toast .toast-undo').click();
  check(await p.evaluate(()=>!state.assets.find(a=>a.id==='wise').siteIcon),'Undo removes the icon');

  // Errors keep the apply button disabled; a late reply to an older request is ignored.
  await p.keyboard.press('Escape');
  await p.locator('[data-asset="site"] .card-open').click();
  await p.locator('#detail [data-action="icon-dialog"]').click();
  await p.locator('#icon-form [name="host"]').fill('blocked.example');
  await p.locator('#icon-form [type="submit"]').click();
  await p.waitForFunction(()=>document.querySelector('#icon-status')?.textContent.includes('没有在'));
  check(await p.locator('[data-action="icon-apply"]').isDisabled(),'Apply stays disabled after an error');
  await p.locator('#icon-form [name="host"]').fill('slow.example');
  await p.locator('#icon-form [type="submit"]').click();
  await p.locator('#icon-form [name="host"]').fill('site.dev');
  await p.evaluate(()=>{document.querySelector('#icon-form [type="submit"]').disabled=false;});
  await p.locator('#icon-form [type="submit"]').click();
  await p.waitForTimeout(500);
  check((await p.locator('#icon-status').textContent()).includes('site.dev'),'Only the latest request may fill the preview');
  await p.locator('[data-action="icon-apply"]').click();
  check(await p.locator('[data-asset="site"] .site-art img').count()===1,'An ordinary category uses the icon as its art');

  // Remove.
  await p.locator('#detail [data-action="icon-dialog"]').click();
  await p.locator('[data-action="icon-remove"]').click();
  check(await p.evaluate(()=>!state.assets.find(a=>a.id==='site').siteIcon)&&await p.locator('[data-asset="site"] .site-art').count()===0,'Remove clears the icon');
  check(!errors.length,'Page errors: '+errors.join(' | '));
  return 'PASS: suggested host, bridge fetch, preview before save, badge on drawn art, link chip mark, undo, error state, stale reply ignored, site art, remove';
 } finally { await p.close(); }
}
