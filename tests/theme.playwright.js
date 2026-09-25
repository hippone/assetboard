async(page)=>{
 const context=await page.context().browser().newContext();
 try{
  const p=await context.newPage();await p.goto('http://127.0.0.1:4317/');
  const result=await p.evaluate(()=>{
   const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
   const blend=(fg,bg,alpha)=>fg.map((v,i)=>v*alpha+bg[i]*(1-alpha));
   const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
   let minimum=Infinity;
   for(const seed of [...themePresets.map(p=>p[1]),'#000000','#ffffff','#ff0000','#00ff00','#0000ff']){
    const palette=themePalette(seed);
    for(const value of Object.values(palette).filter(Array.isArray))if(!value.every(v=>Number.isInteger(v)&&v>=0&&v<=255))throw Error('Out of gamut');
    const canvas=blend(palette.primary,palette.canvas,.025),category=blend(palette.category,canvas,.46),card=blend(palette.card,category,.70);
    const score=Math.min(ratio(palette.muted,category),ratio(palette.muted,card),ratio(palette.ink,card),ratio([255,255,255],palette.primary));
    if(score<4.5)throw Error('Insufficient text contrast: '+seed);minimum=Math.min(minimum,score);
   }
   if(themePalette('invalid').seed!=='#5476a5')throw Error('Invalid color fallback');
   return minimum;
  });
  await p.locator('#theme').click();await p.locator('[data-theme="#b16c86"]').click();await p.locator('#close-modal').click();
  await p.waitForFunction(()=>appliedTheme==='#5476a5');
  await p.locator('#theme').click();await p.locator('#theme-color').fill('#ed7019');await p.locator('#save-theme').click();await p.reload();
  await p.waitForFunction(()=>state.theme==='#ed7019'&&appliedTheme==='#ed7019');
  return {passed:'Gamut, invalid input, 11 contrast samples, cancel, save/reload',minimum:result};
 }finally{await context.close();}
}
