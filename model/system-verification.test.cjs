const test=require('node:test'),assert=require('node:assert/strict');
const C=require('./content.js'),M=require('./model.js'),pack=require('./数学内容包-系统核验.json');
test('system checked items carry sources and are distinct from human audits',()=>{
 const p=C.validatePack(pack),q=C.probesFor(p.skills[0].targetId,[p])[0];
 assert.equal(q.verification.method,'system-cross-check');assert.equal(q.audit,null);
 assert.equal(q.source,'system-pack');assert.ok(q.verification.sourceRefs.length);
 const r={...q,itemIds:[q.id],questionText:q.text,referenceAnswer:q.answer,date:'2026-09-13',passed:true,certainty:'sure'};
 assert.equal(M.evidenceEligible(r),true);
 assert.equal(M.mastery(q.kpId,{reviews:[r]},new Date('2026-09-14')).status,'preliminary');
 for(const changed of [{questionText:'替换题干'},{referenceAnswer:'错误答案'},{kpId:'other'},{verification:{...q.verification,fingerprint:'fake'}}])assert.equal(M.evidenceEligible({...r,...changed}),false);
 const restored=M.migrate({profile:{},reviews:[r]},[{id:q.kpId,name:'point'}]);assert.equal(M.evidenceEligible(restored.reviews[0]),true);
});
test('editing a system item cannot inherit the bundled verification',()=>{
 const p=structuredClone(pack);p.items[0].answer='999';
 assert.throws(()=>C.validatePack(p),/核验|匹配/);
});

