const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('./content.js'),M=require('./model.js'),raw=require('./数学内容包-系统核验.json');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/knowledge.js','utf8'),ctx);
test('every catalogue point has an exact matching concrete question and solution',()=>{
 const p=C.validatePack(raw);
 assert.equal(ctx.window.KNOWLEDGE.length,419);
 for(const k of ctx.window.KNOWLEDGE){
  const s=p.skills.find(s=>s.targetId===k.id);assert.ok(s,'缺少 '+k.id+' '+k.name);assert.equal(s.name,k.name);
  const items=p.items.filter(i=>i.skillId===s.id&&i.id.startsWith('full-'));assert.ok(items.length,'缺少全目录对应题 '+k.id);
  for(const i of items){assert.ok(i.text.trim());assert.ok(i.steps.length>=2);assert.ok(i.alignment&&i.contrast&&s.boundary);}
 }
});
test('solution review cannot substitute for grading a student proof or multistep answer',()=>{
 const p=C.validatePack(raw),i=p.items.find(i=>i.status==='solution-checked');assert.ok(i);
 const s=p.skills.find(s=>s.id===i.skillId),q=C.probesFor(s.targetId,[p]).find(q=>q.id.endsWith(':'+i.id));
 assert.equal(q.grading,'process');assert.ok(q.verification.answerCheck);
 assert.equal(M.evidenceEligible({...q,itemIds:[q.id],questionText:q.text,referenceAnswer:q.answer,passed:true,certainty:'sure'}),false);
 const edited=structuredClone(raw);edited.items.find(x=>x.id===i.id).answer='伪造答案';assert.throws(()=>C.validatePack(edited),/核验|匹配/);
});
test('an older saved built-in pack cannot hide newly bundled catalogue questions',()=>{
 const base=C.validatePack(raw),older=structuredClone(base);older.skills=older.skills.slice(0,12);older.items=older.items.filter(i=>older.skills.some(s=>s.id===i.skillId));
 const merged=C.mergePack(base,older);assert.equal(merged.skills.length,419);assert.equal(merged.items.length,base.items.length);
});
test('the original 24 short questions and their evidence identities remain available',()=>{
 const specs=require('./核验题目规格.json');
 assert.equal(Object.keys(specs).length,24);
 for(const [id,text] of Object.entries(specs)){
  const i=raw.items.find(i=>i.id===id);assert.ok(i,id);assert.equal(i.text,text);assert.equal(i.status,'system-checked');
  assert.equal(i.verification.checkedAt,'2026-09-13');
 }
});
test('an ungraded process answer remains null through backup restoration',()=>{
 const k=ctx.window.KNOWLEDGE[0];
 const restored=M.migrate({profile:{},reviews:[{id:'process-1',kpId:k.id,date:'2026-09-17',passed:null,source:'content-pack',itemIds:['process-1'],audit:null}]},[k]);
 assert.equal(restored.reviews[0].passed,null);assert.equal(M.evidenceEligible(restored.reviews[0]),false);
});
