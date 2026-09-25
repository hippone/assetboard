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

if(typeof module!=='undefined')module.exports={assetFingerprint,removeUntouchedDemo};
