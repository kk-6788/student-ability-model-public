// 仅使用 Node 内置模块；导出当前目录的专题关联，便于检查或二次导入。
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),F=require('./exam-focus'),G=require('./study-guides');
const root=__dirname,window={};vm.runInNewContext(fs.readFileSync(path.join(root,'knowledge.js'),'utf8'),{window});
for(const [subject,title,points] of [['math','数学',window.KNOWLEDGE],['physics','物理',require('./physics-knowledge.json')]]){
  const pack=require(subject==='math'?'./数学内容包-系统核验.json':'./物理内容包-知识目录.json');
  const rows=points.map(k=>({id:k.id,name:k.name,module:k.module,chapter:k.chapter,section:k.section,topics:F.forPoint(k,subject).map(g=>({id:g.id,title:g.title,practice:g.practice,pitfalls:g.pitfalls,sourceIds:g.sourceIds})),learning:G.forPoint(k,subject,points,pack),checkedAt:F.checkedAt}));
  fs.writeFileSync(path.join(root,title+'高考复习映射.json'),JSON.stringify({subject,scope:'项目教学建议；非真题频率统计；不参与掌握评分',sources:F.sources.filter(s=>subject==='math'?s.id.startsWith('math'):s.id.startsWith('physics')),knowledge:rows},null,2)+'\n');
  const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const table=[['id','name','module','chapter','section','topics','practice','pitfalls','sourceIds','concept','formulas','conditions','method','sectionTargets','example','solution','answer','checkedAt'],...rows.map(k=>[k.id,k.name,k.module,k.chapter,k.section,k.topics.map(t=>t.title).join('；'),k.topics.map(t=>t.practice).join('；'),k.topics.map(t=>t.pitfalls).join('；'),[...new Set(k.topics.flatMap(t=>t.sourceIds))].join(';'),k.learning.concept,k.learning.formulas,k.learning.conditions,k.learning.method,k.learning.sectionTargets.join('；'),k.learning.example?.question,k.learning.example?.steps.join('；'),k.learning.example?.answer,k.checkedAt])];
  fs.writeFileSync(path.join(root,title+'高考复习映射.csv'),'\ufeff'+table.map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n');
  console.log(`${title}: ${rows.length} 个知识点`);
}
