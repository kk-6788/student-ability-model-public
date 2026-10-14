const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./model.js'),Migration=require('./migration.js');
const now=new Date('2026-09-26T12:00:00Z');
const review=(id,date='2026-09-01',extra={})=>({id,kpId:'a',assessmentKpId:'a',date,passed:true,certainty:'sure',source:'external',scope:'atomic',itemIds:[id],questionText:'计算 2+3',transferConfirmed:true,audit:{reviewer:'测试核对',date:'2026-09-01',alignment:'对口',answerCheck:'已核对'},...extra});
const state=(reviews=[])=>({version:2,profile:{},exams:[],diagnoses:[],reviews});
test('R4: oversized evidence is rejected explicitly, never silently truncated',()=>{
 for(const field of ['reviews','diagnoses']) {const s=state();s[field]=Array.from({length:5001},(_,i)=>field==='reviews'?review(String(i)):{id:String(i),kpId:'a'});assert.throws(()=>Migration.prepare(s),new RegExp(field));}
 for(const n of [1000,1001,3000]) {const s={...state(),studiedItemIds:Array.from({length:n},(_,i)=>'item'+i)};assert.equal(Migration.prepare(s).state.studiedItemIds.length,n);}
});
test('R4: allowed 5000 history keeps latest failure and process eligibility',()=>{
 const s=state(Array.from({length:5000},(_,i)=>review('r'+i,'2026-09-01',{passed:false})));
 const out=Migration.prepare(s).state;assert.equal(out.reviews.length,5000);assert.equal(M.mastery('a',out,now).status,M.mastery('a',s,now).status);
 const p=state([review('process','2026-09-01',{grading:'process'})]);assert.equal(M.evidenceEligible(Migration.prepare(p).state.reviews[0]),false);
});
test('R5: renamed/punctuated/original/guessed/unidentified passes cannot inflate evidence',()=>{
 for(const second of [review('b','2026-09-06'),review('b','2026-09-06',{questionText:'计算：2 + 3。'}),review('b','2026-09-06',{questionText:'计算 9+8',certainty:'guess'}),review('b','2026-09-06',{questionText:'计算 9+8',itemIds:[]})]) {
  const s=state([review('a'),second]);assert.equal(M.abilityProfile('a',s,now).verifiedEvidenceCount,1);assert.equal(M.mastery('a',s,now).evidenceCount,1);
 }
 const s=state([review('a')]);s.exams=[{date:'2026-09-01',questions:[{id:'old',text:'计算：2+3。',kpIds:['a'],correct:false}]}];assert.equal(M.abilityProfile('a',s,now).verifiedEvidenceCount,0);
});
test('R5: later repeated failure reopens state but is not independent evidence',()=>{
 const s=state([review('a'),review('b','2026-09-06',{questionText:'计算 9+8'}),review('a','2026-09-07',{passed:false})]);
 assert.equal(M.mastery('a',s,now).status,'weak');assert.equal(M.abilityProfile('a',s,now).verifiedEvidenceCount,2);assert.equal(M.abilityProfile('a',s,now).failureObservationCount,1);
});
test('R6: future events do not affect historical status, statistics or plans',()=>{
 const s=state([review('future','2030-01-01')]);s.exams=[{date:'2030-01-01',questions:[{id:'future-q',kpIds:['a'],correct:false}]}];s.diagnoses=[{kpId:'a',createdAt:'2030-01-01',confidence:'supported',probeEvidence:review('p')}];
 assert.equal(M.mastery('a',s,now).status,'untested');assert.equal(M.mastery('a',s,now).total,0);assert.equal(M.abilityProfile('a',s,now).sufficiency.level,'无证据');assert.deepEqual(M.plan(s,[{id:'a',name:'A',prerequisites:[]}],20,now),[]);
});
test('R1: exposure survives migration and excludes later passes by ID or content',()=>{
 const s=state([review('renamed','2026-09-06')]);s.exposures=[{id:'old',questionText:'计算：2 + 3。',shownAt:'2026-09-01',answerAt:'2026-09-01',attemptId:'previous'}];
 const out=Migration.prepare(s).state;assert.equal(out.exposures.length,1);assert.equal(M.mastery('a',out,now).evidenceCount,0);
});
test('R4: 5000 diagnoses restore intact and overlong critical fields are refused',()=>{
 const s=state();s.diagnoses=Array.from({length:5000},(_,i)=>({id:'d'+i,kpId:'a',createdAt:'2026-09-01',evidence:[],confidence:'preliminary'}));assert.equal(Migration.prepare(s).state.diagnoses.length,5000);
 assert.throws(()=>Migration.prepare({...state(),reviews:[review('x','2026-09-01',{questionText:'x'.repeat(6001)})]}),/questionText/);
});
test('R6: undated and invalid events remain stored but do not support current inference',()=>{
 const s=state();s.exams=[{date:'',questions:[{id:'q',kpIds:['a'],correct:false}]}];s.diagnoses=[{kpId:'a',createdAt:'invalid',confidence:'supported',probeEvidence:review('p')}];assert.equal(M.mastery('a',s,now).status,'untested');assert.equal(M.mastery('a',s,now).total,0);assert.deepEqual(M.plan(s,[{id:'a',name:'A',prerequisites:[]}],20,now),[]);
});
