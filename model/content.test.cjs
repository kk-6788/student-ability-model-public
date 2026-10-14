const test=require('node:test'),assert=require('node:assert/strict');
const C=require('./content.js');
const raw=require('./数学内容包-待审核.json');
test('built-in pack contains explicit draft targets, solutions and boundaries',()=>{
 const p=C.validatePack(raw);assert.ok(p.skills.length>=12);assert.ok(p.items.length>=24);
 for(const i of p.items){assert.equal(i.status,'draft');assert.ok(i.steps.length);assert.ok(i.familyId);assert.equal(i.audit,null);}
 for(const s of p.skills){assert.ok(s.objective&&s.boundary);assert.ok(p.items.some(i=>i.skillId===s.id));}
});
test('pack rejects duplicate identifiers, unknown targets and incomplete reviews',()=>{
 for(const mutate of [p=>p.items.push(p.items[0]),p=>p.items[0].skillId='missing',p=>p.items[0].status='reviewed',p=>p.skills[0].prerequisites=['missing'],p=>p.items[0].status='magic']){
  const p=structuredClone(raw);mutate(p);assert.throws(()=>C.validatePack(p));
 }
});
test('subject mismatch never provides a math probe and external executable fields are dropped',()=>{
 const p=structuredClone(raw);p.subject='physics';p.items[0].code='alert(1)';const out=C.validatePack(p);
 assert.equal(out.items[0].code,undefined);assert.equal(C.probesFor(raw.skills[0].targetId,[out]).length,0);
});
test('reviewed item needs written answer and alignment audit and preserves family',()=>{
 const p=structuredClone(raw);p.items[0].status='reviewed';p.items[0].audit={reviewer:'测试审核人',date:'2026-09-12',answerCheck:'独立解题核对',alignment:'第二步使用交集定义'};
 const out=C.validatePack(p),probe=C.probesFor(out.skills[0].targetId,[out])[0];
 assert.equal(probe.source,'content-pack');assert.equal(probe.audit.reviewer,'测试审核人');assert.equal(probe.familyId,p.id+':'+p.items[0].familyId);
});
