const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('./model.js');
const audit={reviewer:'测试教师',date:'2026-09-01',alignment:'解题第二步必须使用负数变号',answerCheck:'代入两侧验证边界与解集'};
const r=(extra={})=>({id:'r',kpId:'a',assessmentKpId:'a',scope:'atomic',source:'external',transferConfirmed:true,audit,date:'2026-09-01',passed:true,certainty:'sure',itemIds:['external:a:1'],...extra});
const state=reviews=>({profile:{},exams:[],diagnoses:[],reviews});
test('unreviewed and legacy AI answers never promote or demote mastery',()=>{
 for(const passed of [true,false]){
  const s=state([r({source:'generated',itemIds:['ai-old'],audit:undefined,passed})]);
  assert.equal(M.mastery('a',s,new Date('2026-09-09')).evidenceCount,0);
  assert.equal(M.mastery('a',s,new Date('2026-09-09')).status,'untested');
 }
 const s=state([r(),r({id:'r2',date:'2026-09-05',itemIds:['external:a:2']}),r({date:'2026-09-06',source:'generated',itemIds:['ai-bad'],passed:false})]);
 assert.equal(M.mastery('a',s,new Date('2026-09-09')).status,'stable');
});
test('missing audit, wrong target or module scope cannot become evidence',()=>{
 for(const extra of [{audit:null},{assessmentKpId:'b'},{scope:'module-basic'},{audit:{...audit,alignment:''}},{source:'generated'}])
 assert.equal(M.mastery('a',state([r(extra)]),new Date('2026-09-09')).evidenceCount,0);
});
test('changing numbers in the same family is not transfer evidence',()=>{
 const s=state([r({familyId:'equation-1'}),r({date:'2026-09-05',itemIds:['external:a:2'],familyId:'equation-1'})]);
 assert.equal(M.mastery('a',s,new Date('2026-09-09')).status,'preliminary');
});
test('backup preserves audit without making old AI records eligible',()=>{
 const out=M.migrate({profile:{},reviews:[r(),r({id:'ai',source:'generated',audit:null,itemIds:['ai-old']})]},[{id:'a',name:'A'}]);
 assert.deepEqual(out.reviews[0].audit,audit);
 assert.equal(M.mastery('a',state([out.reviews[1]]),new Date('2026-09-09')).evidenceCount,0);
});
test('unreviewed diagnostic failure stays a hypothesis',()=>{
 assert.equal(M.diagnose({correct:false,kpIds:['a']},{reason:'concept',probeCorrect:false,probeScope:'atomic'}).confidence,'preliminary');
});
test('original questions cannot become fresh by changing punctuation or spacing',()=>{
 assert.equal(M.sameQuestion('解不等式 −2x>6。用 x 和不等号表示解集。','解不等式：−2x > 6。'),true);
 assert.equal(M.sameQuestion('解不等式 −2x>8。','解不等式：−2x > 6。'),false);
});
test('model rejects a renamed review of an original question as independent evidence',()=>{
 const s=state([r({questionText:'解不等式 −2x>6。'})]);
 s.exams=[{date:'2026-09-01',questions:[{id:'old',kpIds:['a'],text:'解不等式：−2x > 6。',correct:false}]}];
 assert.equal(M.mastery('a',s,new Date('2026-09-09')).status,'weak');
});
