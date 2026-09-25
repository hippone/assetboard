const test=require('node:test');
const assert=require('node:assert/strict');
const {removeUntouchedDemo}=require('../asset-data.js');

const sample={id:'a1',type:'domain',name:'halfnote.studio',provider:'Cloudflare',account:'个人账号',purpose:'写作工具',event:'12 天后到期',date:'2026-10-06',cost:'¥ 89 / 年',warn:true,art:'note',url:'https://example.com',notes:'主站域名，记录每一个从想法到作品的瞬间。'};

test('removes only untouched legacy demo records',()=>{
 const edited={...sample,purpose:'我的项目'};
 const manual={id:'asset-1',type:'domain',name:'my.dev',source:'manual'};
 const blocks=[{id:'domain',width:55},{id:'repository',width:45}];
 const result=removeUntouchedDemo({blocks,assets:[sample,edited,manual]});
 assert.equal(result.removed,1);
 assert.deepEqual(result.board.assets,[edited,manual]);
 assert.deepEqual(result.board.blocks,blocks);
});

test('leaves an already migrated board unchanged',()=>{
 const board={blocks:[],assets:[{id:'asset-1',type:'repository',name:'owner/repo',source:'github'}]};
 const result=removeUntouchedDemo(board);
 assert.equal(result.removed,0);
 assert.deepEqual(result.board,board);
});

test('removes the untouched sample layout and preserves a later custom block',()=>{
 const original=[['domain',60],['server',40],['subscription',40],['database',60]].map(([id,width])=>({id,width,collapsed:false,height:null}));
 const custom={id:'license',width:50,collapsed:false,height:null};
 const result=removeUntouchedDemo({blocks:[...original,custom],assets:[]});
 assert.equal(result.removedBlocks,4);
 assert.deepEqual(result.board.blocks,[custom]);
});
