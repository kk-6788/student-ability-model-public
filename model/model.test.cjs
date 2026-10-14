const test = require('node:test');
const assert = require('node:assert/strict');
let M = {}; try { M = require('./model.js'); } catch(e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
const K=[{id:'a',name:'集合交集',module:'集合',chapter:'第一章',prerequisites:[]},{id:'b',name:'函数单调性',module:'函数',chapter:'第二章',prerequisites:['a']},{id:'c',name:'导数',module:'导数',chapter:'第三章',prerequisites:['b']}];
const q=(id,correct,certainty='sure',kpIds=['a'])=>({id,correct,certainty,kpIds,text:'题目',answer:'2'});
const base=()=>({profile:{learnedIds:[],unlearnedIds:[],progress:'函数',materials:'教材及自备练习册'},exams:[],diagnoses:[],reviews:[],tasks:[]});
const review=(date,passed,itemIds=['r1'],source='external')=>({id:date,kpId:'a',date,passed,itemIds,source,scope:'atomic',assessmentKpId:'a',transferConfirmed:true,audit:{reviewer:'测试核对人',date:'2026-09-01',alignment:'测试考点核对',answerCheck:'测试独立解题'},certainty:'sure',evidence:'独立完成'});
test('all required pure function APIs exist',()=>{for(const f of ['diagnose','groupQuestions','mastery','plan','makeProbe','checkAnswer','migrate'])assert.equal(typeof M[f],'function');});
test('wrong answer alone and self-report alone remain preliminary',()=>{assert.equal(M.diagnose(q('1',false),{}).cause,'unknown');assert.equal(M.diagnose(q('1',false),{reason:'concept'}).confidence,'preliminary');});
test('self-report with targeted failure supports concept cause; passing probe does not',()=>{assert.equal(M.diagnose(q('1',false),{reason:'concept',probeCorrect:false,probeScope:'atomic',probeEvidence:review('2026-09-01',false)}).confidence,'supported');assert.equal(M.diagnose(q('1',false),{reason:'concept',probeCorrect:true}).confidence,'preliminary');});
test('diagnosis retains student process and does not blame every tagged point',()=>{const d=M.diagnose(q('1',false,'sure',['b','c']),{reason:'method',process:'只套了公式，未检查适用条件'},K);assert.ok(d.evidence.length);assert.equal(d.confidence,'preliminary');assert.match(d.prerequisiteHint,/前置|核验/);});
test('grouping merges wrong and uncertain right, all candidate tags reachable, and fits budget',()=>{const qs=[q('1',false),q('2',true,'guess'),q('3',true),q('4',false,'sure',['b','c']),...Array.from({length:10},(_,i)=>q('x'+i,false,'sure',['x'+i]))];const g=M.groupQuestions(qs,12);assert.equal(g[0].questions.length,2);assert.ok(g.reduce((a,x)=>a+x.estimatedMinutes,0)<=12);assert.equal(g.flatMap(x=>x.questions).filter(x=>x.id==='4').length,2);assert.ok(!g.flatMap(x=>x.questions).some(x=>x.id==='3'));});
test('unlearned and untested states do not classify weakness',()=>{let s=base();assert.equal(M.mastery('a',s).status,'untested');s.profile.unlearnedIds=['a'];s.exams=[{date:'2026-09-01',questions:[q('1',false)]}];assert.equal(M.mastery('a',s).status,'unlearned');});
test('guessed correct response remains uncertain and raw accuracy is retained',()=>{const s=base();s.exams=[{date:'2026-09-01',questions:[q('1',true,'guess')]}];const m=M.mastery('a',s);assert.equal(m.status,'uncertain');assert.equal(m.accuracy,1);});
test('multi-tag failure without point evidence does not mark all points weak',()=>{const s=base();s.exams=[{date:'2026-09-01',questions:[q('1',false,'sure',['a','b'])]}];assert.equal(M.mastery('a',s).status,'uncertain');});
test('same-day independent pass gives preliminary; distinct pass after 3 days stable',()=>{const s=base();s.reviews=[review('2026-09-01T10:00:00Z',true)];assert.equal(M.mastery('a',s,new Date('2026-09-01T11:00:00Z')).status,'preliminary');s.reviews.push(review('2026-09-04T10:00:00Z',true,['r2']));assert.equal(M.mastery('a',s,new Date('2026-09-04T11:00:00Z')).status,'stable');});
test('same question repeated and anonymous external exercises cannot certify stability',()=>{const s=base();s.reviews=[review('2026-09-01T10:00:00Z',true),review('2026-09-05T10:00:00Z',true)];assert.equal(M.mastery('a',s,new Date('2026-09-06')).status,'preliminary');s.reviews=[review('2026-09-01T10:00:00Z',true,[],'external'),review('2026-09-05T10:00:00Z',true,[],'external')];assert.equal(M.mastery('a',s,new Date('2026-09-06')).status,'uncertain');});
test('guessing on review cannot establish mastery; later failure downgrades',()=>{const s=base();s.reviews=[{...review('2026-09-01T10:00:00Z',true),certainty:'guess'}];assert.equal(M.mastery('a',s,new Date('2026-09-06')).status,'uncertain');s.reviews=[review('2026-09-01T10:00:00Z',true),review('2026-09-04T10:00:00Z',true,['r2']),review('2026-09-05T10:00:00Z',false,['r3'])];assert.equal(M.mastery('a',s,new Date('2026-09-06')).status,'weak');});
test('plan respects budget and inserts prerequisite weakness before current progress',()=>{const s=base();s.exams=[{date:'2026-09-01',questions:[q('1',false),q('2',false,'sure',['b'])]}];const p=M.plan(s,K,20,new Date('2026-09-08'));assert.ok(p.reduce((n,t)=>n+t.minutes,0)<=20);assert.equal(p[0].kpId,'a');assert.ok(p.some(t=>t.kpId==='b'));assert.ok(p.every(t=>t.material.includes('自备练习册')&&!/第\d+页/.test(t.material)));assert.deepEqual(M.plan(s,K,0),[]);});
test('nearby exam scope takes priority over ordinary progress',()=>{const s=base();s.profile.examDate='2026-09-12';s.profile.examScope='导数';s.exams=[{date:'2026-09-01',questions:[q('current',false,'sure',['a']),q('exam',false,'sure',['c'])]}];const p=M.plan(s,K,20,new Date('2026-09-08'));assert.equal(p[0].kpId,'c');});
test('answer comparison normalizes simple numbers and unicode, never evaluates code',()=>{assert.ok(M.checkAnswer('１／２','0.5'));assert.ok(M.checkAnswer(' x = 3 ','3'));assert.ok(M.checkAnswer('−2','-2'));assert.ok(!M.checkAnswer('Math.sqrt(4)','2'));assert.ok(!M.checkAnswer('',''));assert.ok(!M.checkAnswer('1+1','2'));});
test('local bank covers 15 high-school areas and junior foundations with distinct variants',()=>{const names=['集合','命题与逻辑','一元二次不等式','函数单调性','指数函数','对数函数','三角函数','平面向量','解三角形','复数','立体几何','直线与圆','椭圆','等差数列','导数','概率','统计','排列组合','二项式定理','初中一元一次方程','初中有理数'];for(const name of names){const k={id:name,name,module:name};const p=M.makeProbe(name,[k],0),p2=M.makeProbe(name,[k],1);assert.ok(p,name);assert.equal(p.scope,'module-basic');assert.notEqual(p.id,p2.id,name);assert.notEqual(p.text,p2.text,name);assert.ok(M.checkAnswer(p.answer,p.answer),name);assert.ok(p.explanation,name);}assert.equal(M.makeProbe('z',[{id:'z',name:'超出题库范围',module:'未知'}]),null);});
test('migration supports old object exams and knowledge names; refuses arbitrary JSON',()=>{const s=M.migrate({exams:{old:{name:'月考',questions:[{num:1,kp:'集合交集',correct:false}]}}},K);assert.equal(s.exams.length,1);assert.deepEqual(s.exams[0].questions[0].kpIds,['a']);assert.deepEqual(s.reviews,[]);assert.throws(()=>M.migrate({hello:1}),/备份|数据/);assert.throws(()=>M.migrate({exams:'oops'}),/考试|exams|格式/);});
test('migration rejects oversized strings, preserves boolean null semantics and strips secrets',()=>{assert.throws(()=>M.migrate({profile:{materials:'x'.repeat(30000)}}),/materials/);const s=M.migrate({profile:{materials:'教材',apiKey:'secret'},exams:[{questions:[{text:'ok',correct:'false',kpIds:['a'],certainty:'weird'}]}]},K);assert.ok(s.profile.materials.length<=10000);assert.equal(s.exams[0].questions[0].correct,null);assert.equal(s.exams[0].questions[0].certainty,'unsure');assert.ok(!JSON.stringify(s).includes('secret'));});
test('module-basic bank passes never certify a whole atomic knowledge point',()=>{const s=base();s.reviews=[review('2026-09-01T10:00:00Z',true,['local-bank:set:0']),review('2026-09-05T10:00:00Z',true,['local-bank:set:1'])];assert.equal(M.mastery('a',s,new Date('2026-09-06')).status,'untested');});
test('reusing an original question is not independent; repeating an earlier review is not delayed new evidence',()=>{const s=base();s.exams=[{date:'2026-09-01',questions:[q('r1',false)]}];s.reviews=[review('2026-09-01T10:00:00Z',true)];assert.equal(M.mastery('a',s,new Date('2026-09-06')).status,'weak');s.exams=[];s.reviews=[review('2026-09-01T10:00:00Z',true),review('2026-09-02T10:00:00Z',true,['r2']),review('2026-09-05T10:00:00Z',true,['r2'])];assert.equal(M.mastery('a',s,new Date('2026-09-06')).status,'preliminary');});
test('module-only probe failure does not establish an atomic concept diagnosis',()=>{assert.equal(M.diagnose(q('1',false),{reason:'concept',probeCorrect:false,probeScope:'module-basic'}).confidence,'preliminary');});
test('plain familiar power and logarithm variants keep new numerical questions after 20 variants',()=>{for(const name of ['指数函数','对数函数']){const k=[{id:'k',name}];assert.notEqual(M.makeProbe('k',k,21).text,M.makeProbe('k',k,22).text);}});

test('ability profile separates understanding independence transfer stability and evidence sufficiency',()=>{
 const s=base();
 let p=M.abilityProfile('a',s,new Date('2026-09-09'));
 assert.deepEqual(p.dimensions.map(x=>[x.id,x.level]),[['understanding','未检测'],['independence','未检测'],['transfer','未检测'],['stability','未检测']]);
 assert.equal(p.sufficiency.level,'无证据');
 s.reviews=[review('2026-09-01T10:00:00Z',true)];
 p=M.abilityProfile('a',s,new Date('2026-09-02'));
 assert.deepEqual(p.dimensions.map(x=>x.level),['初步通过','独立完成一次','待变式验证','待延迟验证']);
 assert.equal(p.sufficiency.level,'有限');
 s.reviews.push(review('2026-09-05T10:00:00Z',true,['r2']));
 p=M.abilityProfile('a',s,new Date('2026-09-06'));
 assert.deepEqual(p.dimensions.map(x=>x.level),['已有支持','已有支持','已有支持','已有支持']);
 assert.equal(p.sufficiency.level,'较充分');
});

test('practice process answers increase activity context but never ability evidence',()=>{
 const s=base();s.reviews=[{kpId:'a',date:'2026-09-05',passed:null,grading:'process',source:'content-pack',scope:'atomic',assessmentKpId:'a',itemIds:['pack:math-full:item'],evidence:'保存了解题过程'}];
 const p=M.abilityProfile('a',s,new Date('2026-09-06'));
 assert.equal(p.sufficiency.level,'无证据');
 assert.equal(p.practiceCount,1);
 assert.ok(p.nextStep.includes('核对'));
});

test('a later verified failure resets supported dimensions without erasing history',()=>{
 const s=base();s.reviews=[review('2026-09-01T10:00:00Z',true),review('2026-09-05T10:00:00Z',true,['r2']),review('2026-09-06T10:00:00Z',false,['r3'])];
 const p=M.abilityProfile('a',s,new Date('2026-09-07'));
 assert.equal(p.status,'weak');
 assert.deepEqual(p.dimensions.map(x=>x.level),['需要加强','尚未独立通过','待重新验证','待重新验证']);
 assert.equal(p.sufficiency.level,'较充分');
 assert.equal(p.verifiedEvidenceCount,3);
});

