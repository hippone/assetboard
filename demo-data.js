// Fictional demo board for `--demo` (Mac app) and `?demo` (browser). No real assets, accounts or tokens; never saved.
window.assetboardDemoBoard=function(){
 const pad=n=>String(n).padStart(2,'0'),day=offset=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
 const base={account:'demo',source:'manual',art:'generic',cost:'未知',url:'',notes:'演示数据'};
 const repos=['atlas-ui','notes-api','pixel-kit','studio-site','ledger-cli','orbit-bot','paper-docs','glass-theme','tiny-queue','sample-ml','mock-store','field-guide','plain-auth','zen-timer'];
 const ago=days=>new Date(Date.now()-days*86400000).toISOString();
 const assets=[
  {...base,id:'demo-d1',updatedAt:ago(3),type:'domain',name:'example-studio.com',provider:'示例注册商',purpose:'工作室主站',date:day(12),dateKind:'expire',cycle:'yearly'},
  {...base,id:'demo-d2',updatedAt:ago(1),type:'domain',name:'demo-notes.dev',provider:'示例注册商',purpose:'笔记站点',date:day(160),dateKind:'expire',cycle:'yearly'},
  {...base,id:'demo-d3',updatedAt:ago(20),type:'domain',name:'sample-shop.cn',provider:'示例 DNS',purpose:'电商试验',date:day(-2),dateKind:'expire'},
  {...base,id:'demo-d4',updatedAt:ago(40),type:'domain',name:'old-landing.io',provider:'示例注册商',purpose:'旧落地页',hiddenAt:'2026-01-01T00:00:00Z'},
  {...base,id:'demo-s1',updatedAt:ago(2),type:'server',name:'示例 VPS · 东京',provider:'示例云',purpose:'API 服务',host:'203.0.113.10',sshUser:'deploy',date:day(26),dateKind:'renew',cycle:'monthly',cost:'$6/月'},
  {...base,id:'demo-s2',updatedAt:ago(9),type:'server',name:'示例 VPS · 法兰克福',provider:'示例云',purpose:'备份节点',host:'198.51.100.24',sshPort:'2222',date:day(90),dateKind:'renew',cycle:'yearly'},
  {...base,id:'demo-s3',updatedAt:ago(30),type:'server',name:'家用 NAS（示例）',provider:'自建',purpose:'照片备份'},
  {...base,id:'demo-u1',updatedAt:ago(6),type:'subscription',name:'示例笔记工具',provider:'示例公司',purpose:'写作',date:day(5),dateKind:'renew',cycle:'monthly',cost:'$8/月'},
  {...base,id:'demo-u2',updatedAt:ago(15),type:'subscription',name:'示例设计工具',provider:'示例公司',purpose:'界面设计',date:day(48),dateKind:'renew',cycle:'yearly'},
  {...base,id:'demo-a1',updatedAt:ago(4),type:'ai',name:'示例 AI Pro',provider:'示例 AI',account:'someone@example.net',date:day(9),dateKind:'renew',cycle:'monthly',cost:'$20/月'},
  {...base,id:'demo-db1',updatedAt:ago(12),type:'database',name:'demo-postgres',provider:'示例数据库云',purpose:'主库',date:day(70),dateKind:'renew',cycle:'yearly'},
  ...repos.map((name,i)=>({...base,id:'demo-r'+i,type:'repository',name:'demo-org/'+name,provider:'GitHub',account:'demo-org',purpose:'示例仓库',source:'github',externalId:'demo-'+i,syncStatus:i%3?'私有仓库':'公开仓库',event:i%3?'私有仓库':'公开仓库',updatedAt:new Date(Date.now()-i*86400000*3).toISOString()}))
 ];
 const block=(id,width,extra={})=>({id,width,height:null,density:'full',folded:false,...extra});
 return {blocks:[block('domain',50),block('server',50),block('repository',70),block('subscription',30),block('ai',30,{density:'compact'}),block('database',35),block('license',35,{folded:true})],assets,deletedExternalIds:[],cardOrder:{},featuredRepositoryIds:[],evidenceDecisions:{}};
};
