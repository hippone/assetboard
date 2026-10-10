// Perceptual OKLCH roles. Surfaces stay near-neutral; the chosen hue drives the accent. Light and dark follow the system.
const themePresets=[['雾蓝','#5476a5'],['鸢尾','#8066a9'],['玫瑰','#b16c86'],['暖沙','#a17b4e'],['岩灰','#737b85'],['鼠尾草','#6c8b76']];
let appliedTheme='',appliedScheme='',themePreview=false;
const schemeQuery=window.matchMedia?.('(prefers-color-scheme: dark)');
function currentScheme(){return schemeQuery?.matches?'dark':'light';}
function themePalette(seed,scheme='light'){
 const valid=/^#[0-9a-f]{6}$/i.test(seed||'')?seed:'#5476a5';
 const [r,g,b]=[1,3,5].map(i=>{const v=parseInt(valid.slice(i,i+2),16)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 const a=1.9779984951*l-2.428592205*m+.4505937099*s,bb=.0259040371*l+.7827717662*m-.808675766*s,h=Math.atan2(bb,a),sourceChroma=Math.hypot(a,bb);
 const rgb=(lightness,chroma)=>{
  let linear;
  for(let attempt=0;attempt<24;attempt++){
   const aa=Math.cos(h)*chroma,bbb=Math.sin(h)*chroma;
   const ll=(lightness+.3963377774*aa+.2158037573*bbb)**3,mm=(lightness-.1055613458*aa-.0638541728*bbb)**3,ss=(lightness-.0894841775*aa-1.291485548*bbb)**3;
   linear=[4.0767416621*ll-3.3077115913*mm+.2309699292*ss,-1.2684380046*ll+2.6097574011*mm-.3413193965*ss,-.0041960863*ll-.7034186147*mm+1.707614701*ss];
   if(linear.every(v=>v>=0&&v<=1))break;
   chroma*=.8;
  }
  return linear.map(v=>{v=Math.max(0,Math.min(1,v));return Math.round(255*(v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055));});
 };
 const c=Math.min(sourceChroma,.10);
 if(scheme==='dark')return {seed:valid,scheme,canvas:rgb(.175,c*.06),category:rgb(.205,c*.07),card:rgb(.245,c*.07),ink:rgb(.94,c*.03),muted:rgb(.74,c*.05),primary:rgb(.72,Math.min(sourceChroma,.13))};
 return {seed:valid,scheme,canvas:rgb(.935,c*.04),category:rgb(.968,c*.03),card:rgb(.997,c*.015),ink:rgb(.22,c*.10),muted:rgb(.46,c*.10),primary:rgb(.46,Math.min(sourceChroma,.12))};
}
function applyBoardTheme(seed){
 const scheme=currentScheme(),p=themePalette(seed,scheme);if(appliedTheme===p.seed&&appliedScheme===scheme)return;appliedTheme=p.seed;appliedScheme=scheme;
 document.documentElement.dataset.scheme=scheme;
 for(const [role,value] of Object.entries(p)){if(Array.isArray(value))document.documentElement.style.setProperty('--tone-'+role,value.join(','));}
 if(window.__ASSETBOARD_NATIVE__)window.webkit.messageHandlers.assetboard.postMessage({action:'themeColor',rgb:p.canvas});
}
function themeDialog(){
 themePreview=true;
 const selected=themePalette(state.theme).seed;
 modal('画板色调',`<div class="theme-options">${themePresets.map(([name,color])=>`<button class="theme-swatch" data-theme="${color}" aria-pressed="${selected.toLowerCase()===color}" style="--swatch:${color}"><i></i>${name}</button>`).join('')}</div><label class="theme-custom">自定义主色<input id="theme-color" type="color" value="${selected}"></label><p class="form-note">主色用于按钮、选中和强调；底色保持中性，并跟随系统的浅色或深色外观。</p><button class="button primary" id="save-theme">使用这个色调</button>`);
 const picker=document.querySelector('#theme-color');
 const preview=color=>{picker.value=color;applyBoardTheme(color);document.querySelectorAll('[data-theme]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.theme===color.toLowerCase())));};
 document.querySelectorAll('[data-theme]').forEach(el=>el.onclick=()=>preview(el.dataset.theme));
 picker.oninput=()=>preview(picker.value);
 document.querySelector('#save-theme').onclick=()=>{checkpoint();state.theme=picker.value;save();themePreview=false;document.querySelector('#modal').close();};
}
document.addEventListener('DOMContentLoaded',()=>{
 const button=document.createElement('button');button.id='theme';button.className='button icon-only';button.onclick=themeDialog;document.querySelector('#add-block').before(button);if(typeof setIconButton==='function'){setIconButton(button,'palette','色调');}else{button.textContent='色调';button.title='色调';}
 document.querySelector('#modal').addEventListener('close',()=>{if(themePreview){themePreview=false;applyBoardTheme(state.theme);}});
 applyBoardTheme(state.theme);
 schemeQuery?.addEventListener?.('change',()=>applyBoardTheme(appliedTheme));
});
