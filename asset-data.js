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

if(typeof module!=='undefined')module.exports={assetFingerprint,removeUntouchedDemo,repositoryGroups,swapRepositoryDisplay,orderAssets,moveAsset};
