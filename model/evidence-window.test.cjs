const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./model.js');

// 构造一条通过 evidenceEligible 的外部正式复测记录（字段满足 cleanAudit + scope atomic 等）
function validReview(kpId,dateStr,itemIds=['ext-1']){
  return {kpId,date:dateStr,source:'external',scope:'atomic',assessmentKpId:kpId,grading:'answer',
    itemIds,questionText:'变式题：求 f(x)=x² 在 [1,2] 上的单调性',passed:true,certainty:'sure',transferConfirmed:true,
    audit:{reviewer:'王老师',date:dateStr.slice(0,10),alignment:'仅考查函数单调性定义',answerCheck:'对照教材答案核对'}};
}
const state=(reviews)=>({profile:{},exams:[],diagnoses:[],reviews});

test('STU-03: 未来日期的正式复测不计入当前有效证据',()=>{
  const now=new Date('2026-09-24T12:00:00Z');
  const s=state([validReview('g1','2030-01-01')]);
  const m=M.mastery('g1',s,now);
  const a=M.abilityProfile('g1',s,now);
  assert.equal(m.evidenceCount,0,'mastery 排除未来记录');
  assert.equal(a.verifiedEvidenceCount,0,'abilityProfile 必须同样排除未来记录（修复前为 1）');
  assert.ok(a.sufficiency.detail.includes('晚于当前时间')||a.sufficiency.level==='无证据','排除理由应可见');
});

test('STU-03: 同一题目的重复导入只计一次有效证据',()=>{
  const now=new Date('2026-09-24T12:00:00Z');
  const r1=validReview('g1','2026-06-01');
  const r2={...validReview('g1','2026-06-02')}; // 相同 itemIds + 相同题干 = 重复
  const s=state([r1,r2]);
  const a=M.abilityProfile('g1',s,now);
  assert.equal(a.verifiedEvidenceCount,1,'重复题目记录去重后只计 1 条');
});

test('STU-03: 不同题目的两条正式复测都计入',()=>{
  const now=new Date('2026-09-24T12:00:00Z');
  const r1=validReview('g1','2026-06-01',['ext-a']);
  const r2={...validReview('g1','2026-06-10',['ext-b']),questionText:'比较指数函数在不同区间的变化'};
  const s=state([r1,r2]);
  const a=M.abilityProfile('g1',s,now);
  assert.equal(a.verifiedEvidenceCount,2);
  assert.equal(a.sufficiency.level,'较充分');
});

test('STU-03: 导入与页面判定使用同一时间基准（两函数结果不矛盾）',()=>{
  const now=new Date('2026-09-24T12:00:00Z');
  const s=state([validReview('g1','2030-01-01')]);
  const m=M.mastery('g1',s,now);
  const a=M.abilityProfile('g1',s,now);
  // mastery 判定证据为 0 时，abilityProfile 不得声称证据较充分
  assert.equal(m.evidenceCount,0);
  assert.notEqual(a.sufficiency.level,'较充分');
});

test('STU-03: 正常历史记录不受影响',()=>{
  const now=new Date('2026-09-24T12:00:00Z');
  const s=state([validReview('g1','2026-06-01')]);
  const a=M.abilityProfile('g1',s,now);
  assert.equal(a.verifiedEvidenceCount,1);
  assert.ok(a.sufficiency.detail.includes('1 条可计入状态的正式证据'));
});
