const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('./model.js');
const c={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/knowledge.js','utf8'),c);const K=c.window.KNOWLEDGE;
const kid='J-ALG-03';
test('full backup preserves profile, image links and diagnosis linkage',()=>{
 const s={profile:{name:'测试',ready:true,grade:'高一',province:'浙江',textbook:'人教A版（2019）',progress:'函数',materials:'教辅',examDate:'2026-09-20'},exams:[{id:'e',name:'试卷',date:'2026-09-08',photos:['p'],questions:[{id:'q',num:'1',text:'2x>4',correct:false,kpIds:[kid],photoIds:['p2']}]}],diagnoses:[{id:'d',kpId:kid,examId:'e',questionIds:['q'],detail:'自述',reason:'method',aiNote:'补充',evidence:[],createdAt:'2026-09-08'}],reviews:[{id:'r',kpId:kid,date:'2026-09-09',passed:true,source:'external',itemIds:['new'],photoIds:['p3'],certainty:'sure'}],minutes:15,taskLog:[{id:'t',date:'2026-09-09'}],draft:{id:'draft',name:'草稿',date:'2026-09-09',questions:[],photos:['p4']},apiKey:'must-not-copy'};
 const out=M.migrate(s,K);assert.equal(out.profile.ready,true);assert.equal(out.profile.name,'测试');assert.deepEqual(out.exams[0].photos,['p']);assert.deepEqual(out.exams[0].questions[0].photoIds,['p2']);assert.equal(out.diagnoses[0].examId,'e');assert.equal(out.diagnoses[0].detail,'自述');assert.deepEqual(out.reviews[0].photoIds,['p3']);assert.equal(out.minutes,15);assert.equal(out.draft.id,'draft');assert.equal(out.profile.examDate,'2026-09-20');assert.equal(out.apiKey,undefined);
});
test('new dated exam failure reopens stable mastery',()=>{const s={profile:{},exams:[{id:'e',date:'2026-09-08',questions:[{id:'q',kpIds:[kid],correct:false,certainty:'sure'}]}],reviews:[{kpId:kid,date:'2026-09-01',passed:true,certainty:'sure',itemIds:['a'],source:'external'},{kpId:kid,date:'2026-09-05',passed:true,certainty:'sure',itemIds:['b'],source:'external'}]};assert.equal(M.mastery(kid,s,new Date('2026-09-09')).status,'weak');});
test('no weakness plan is invented from progress alone',()=>{assert.equal(M.plan({profile:{progress:'函数'},exams:[],reviews:[],diagnoses:[]},K,15).length,0);});
test('sure correct answers alone do not create extra diagnostic learning tasks',()=>{assert.equal(M.plan({profile:{progress:'不等式'},exams:[{questions:[{id:'sure',kpIds:[kid],correct:true,certainty:'sure'}]}]},K,15).length,0);});
test('specific basic inequality template remains an unreviewed targeted practice',()=>{const p=M.makeProbe(kid,K,0);assert.equal(p.scope,'atomic');assert.equal(M.evidenceEligible({...p,assessmentKpId:kid}),false);assert.ok(p.text.includes('负数')||p.text.includes('−')||p.text.includes('-'));});
test('multiple knowledge points remain reachable in diagnostic groups',()=>{const gs=M.groupQuestions([{id:'q',kpIds:['a','b'],correct:false}],15);assert.deepEqual(gs.map(g=>g.kpId).sort(),['a','b']);});

test('student and parent views expose the evidence-based ability dimensions',()=>{
 const app=fs.readFileSync(__dirname+'/app.js','utf8');
 assert.match(app,/M\.abilityProfile\(/);
 for(const label of ['知识理解','独立完成','题型迁移','保持稳定','证据充分度'])assert.match(app,new RegExp(label));
 assert.match(app,/不输出能力百分数/);
});
