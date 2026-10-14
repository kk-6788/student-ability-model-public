const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const pack=structuredClone(require('./数学内容包-系统核验.json'));
 // Synthetic process item used only inside this isolated test context.
 const i=pack.items[0];i.status='solution-checked';i.assessment={objective:'说明两个步骤',boundary:'要求过程',prerequisiteSkills:'基础运算'};
 const ctx={window:{MATH_CONTENT:pack}};vm.createContext(ctx);
 for(const file of ['content.js','model.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),ctx);
 return {C:ctx.window.Content,M:ctx.window.Model,pack};
}
test('deleting a verified item scope must invalidate its verification',()=>{
 // Keep the canonical fixture separate from the imported edited copy.
 const original=fixture(),edited=structuredClone(original.pack);delete edited.items[0].assessment;
 assert.throws(()=>original.C.validatePack(edited),/核验|匹配/);
});
test('changing review status cannot turn a bundled process question into automatic mastery evidence',()=>{
 const {C,M,pack}=fixture(),edited=structuredClone(pack),i=edited.items[0];
 i.status='reviewed';i.audit={reviewer:'测试核对人',date:'2026-09-13',alignment:'测试步骤匹配',answerCheck:'测试答案核对'};
 const p=C.validatePack(edited),q=C.probesFor(p.skills.find(s=>s.id===i.skillId).targetId,[p])[0];
 assert.equal(q.grading,'process');
 assert.equal(M.evidenceEligible({...q,itemIds:[q.id],passed:true,certainty:'sure',questionText:q.text,referenceAnswer:q.answer,date:'2026-09-17'}),false);
 for(const passed of [true,false,null]){
  const record={...q,id:'saved-process',itemIds:[q.id],passed,certainty:'sure',date:'2026-09-17'};delete record.grading;
  assert.equal(M.evidenceEligible(record),false);
  const restored=M.migrate({profile:{},reviews:[record]},[{id:q.kpId,name:'测试知识点'}]);
  assert.equal(M.evidenceEligible(restored.reviews[0]),false);
  assert.equal(M.mastery(q.kpId,{reviews:restored.reviews},new Date('2026-09-18')).status,'untested');
 }
});
test('diagnostic ungraded answers survive backup as unknown rather than wrong',()=>{
 const {M,pack}=fixture(),k=pack.skills[0];
 const out=M.migrate({profile:{},diagnoses:[{id:'d1',kpId:k.targetId,probe:{id:'p1',answer:'写了过程',correct:null}}]},[{id:k.targetId,name:k.name}]);
 assert.equal(out.diagnoses[0].probe.correct,null);
});
