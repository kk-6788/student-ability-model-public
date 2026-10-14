const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('./content'),M=require('./model'),S=require('./subjects'),F=require('./exam-focus'),Migration=require('./migration');
const P=require('./physics-knowledge.json'),sections=require('./physics-sections.json'),pack=require('./物理内容包-知识目录.json');
const w={};vm.runInNewContext(fs.readFileSync(__dirname+'/knowledge.js','utf8'),{window:w});const K=w.KNOWLEDGE;
test('physics catalogue covers all six books and 125 sections with a valid prerequisite DAG',()=>{
  assert.equal(P.length,443);assert.equal(sections.length,125);assert.equal(new Set(P.map(k=>k.id)).size,P.length);
  assert.equal(new Set(sections.map(s=>s.book+':'+s.chapter)).size,27);
  assert.deepEqual([...new Set(sections.map(s=>s.book))],['B1','B2','B3','S1','S2','S3']);
  assert.equal(C.validatePack(pack).skills.length,P.length);
  for(const s of sections)assert.ok(P.some(k=>k.id.startsWith(s.id+'-')));
  for(const k of P){assert.equal(k.subject,'physics');assert.match(k.sourceUrl,/^https:\/\/book\.pep\.com\.cn\//);assert.ok(k.objective&&k.boundary);assert.ok(k.prerequisites.every(id=>P.some(x=>x.id===id)));}
});
test('physics JS, JSON and content pack have identical points; no fake verified physics questions',()=>{
  const window={};for(const file of ['physics-knowledge.js','physics-content.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/'+file,'utf8'),{window});
  assert.equal(JSON.stringify(window.PHYSICS_KNOWLEDGE),JSON.stringify(P));assert.equal(JSON.stringify(window.PHYSICS_CONTENT),JSON.stringify(pack));
  assert.equal(pack.items.length,0);assert.deepEqual(pack.skills.map(k=>[k.targetId,k.name]),P.map(k=>[k.id,k.name]));
  for(const k of P)assert.equal(M.makeProbe(k.id,P),null);
});
test('math storage keys remain compatible; physics storage and backup subjects stay separate',()=>{
  assert.equal(S.get('math').store,'zhiyin.math.v2');assert.equal(S.get('math').demo,'zhiyin.math.demo.v2');assert.equal(S.get('unknown').id,'math');
  for(const key of ['store','demo','config'])assert.notEqual(S.get('math')[key],S.get('physics')[key]);
  assert.equal(S.assertBackup({version:2,exams:[]},'math'),true);
  assert.throws(()=>S.assertBackup({version:2,exams:[]},'physics'),/切换/);
  assert.throws(()=>S.assertBackup({profile:{subject:'physics'},exams:[]},'math'),/切换/);
  assert.throws(()=>S.assertBackup({profile:{subject:'physics'},draft:{questions:[{kpIds:['M1-1-1-01']}]}},'physics'),/另一学科/);
});
test('physics backup roundtrip retains subject, questions, draft and learning boundaries',()=>{
  const raw={version:2,profile:{subject:'physics',province:'安徽',learnedIds:[P[0].id],unlearnedIds:[P[1].id]},exams:[{id:'p1',date:'2026-09-20',questions:[{id:'q1',kpIds:[P[0].id],text:'物理测试',correct:false}]}],draft:{id:'draft',questions:[{id:'d1',text:'待核对',kpIds:[P[2].id],correct:null}]}};
  S.assertBackup(raw,'physics');const out=Migration.prepare(raw,P).state;assert.equal(out.profile.subject,'physics');assert.deepEqual(out.profile.learnedIds,[P[0].id]);assert.equal(out.exams[0].questions[0].kpIds[0],P[0].id);assert.equal(out.draft.questions[0].kpIds[0],P[2].id);
});
test('physics reviewed content is selected only for its subject',()=>{
  const sample=C.validatePack({...pack,id:'physics-sample',items:[{id:'q',skillId:P[0].id,text:'测试题干',answer:'答案',steps:['核对步骤'],familyId:'f',status:'draft',alignment:'仅用于测试',contrast:'对比',source:'测试原创'}]});
  assert.equal(C.probesFor(P[0].id,[sample]).length,0);assert.equal(C.probesFor(P[0].id,[sample],'physics').length,1);
  assert.equal(M.evidenceEligible(C.probesFor(P[0].id,[sample],'physics')[0]),false);
});
test('recent exam guidance covers both catalogues without mutating IDs or unobserved ability',()=>{
  for(const [subject,ks] of [['math',K],['physics',P]]){
    const decorated=F.attach(ks,subject);assert.equal(decorated.length,ks.length);
    for(let i=0;i<ks.length;i++){assert.equal(decorated[i].id,ks[i].id);assert.equal(decorated[i].name,ks[i].name);assert.ok(decorated[i].examFocus.length,ks[i].chapter);assert.equal(ks[i].examFocus,undefined);}
    assert.deepEqual(M.plan({profile:{},exams:[],diagnoses:[],reviews:[]},decorated),[]);
    for(const g of F.groups(subject))for(const id of g.sourceIds)assert.ok(F.sources.some(s=>s.id===id));
  }
  assert.deepEqual(F.forPoint(K.find(k=>/三角函数/.test(k.chapter))).map(g=>g.id),['m-trig']);
});
test('physics diagnosis, plan and external delayed review follow the original evidence gate',()=>{
  const id=P[0].id,state={profile:{subject:'physics',learnedIds:[],unlearnedIds:[]},exams:[{date:'2026-09-01',questions:[{id:'original',text:'原始情境',correct:false,kpIds:[id]}]}],diagnoses:[],reviews:[]};
  const d=M.diagnose(state.exams[0].questions[0],{reason:'concept'},P);assert.equal(d.confidence,'preliminary');assert.ok(M.plan(state,P,20,new Date('2026-09-10')).some(t=>t.kpId===id));
  const review=(date,n)=>({id:n,kpId:id,assessmentKpId:id,date,passed:true,source:'external',scope:'atomic',certainty:'sure',itemIds:[n],transferConfirmed:true,audit:{reviewer:'测试核对人',date:'2026-09-01',alignment:'测试：目标对应',answerCheck:'测试：独立核对'}});
  state.reviews=[review('2026-09-03','new1')];assert.equal(M.mastery(id,state,new Date('2026-09-10')).status,'preliminary');
  state.reviews.push(review('2026-09-07','new2'));assert.equal(M.mastery(id,state,new Date('2026-09-10')).status,'stable');
  state.reviews=state.reviews.map(r=>({...r,audit:null}));assert.notEqual(M.mastery(id,state,new Date('2026-09-10')).status,'stable');
});
test('every new browser dependency is served and included in offline shell',()=>{
  for(const f of ['subjects.js','exam-focus.js','physics-knowledge.js','physics-content.js','study-guides.js'])for(const entry of ['index.html','sw.js','services.js','server.cjs'])assert.ok(fs.readFileSync(__dirname+'/'+entry,'utf8').includes(f),entry+':'+f);
});
test('detailed guides cover every point with conditions, methods and transparently scoped examples',()=>{
  const G=require('./study-guides'),mathPack=require('./数学内容包-系统核验.json');
  assert.equal(Object.keys(G.physics).length,27);
  for(const [subject,ks,content] of [['math',K,mathPack],['physics',P,pack]])for(const k of ks){
    const g=G.forPoint(k,subject,ks,content);assert.ok(g,k.id);assert.equal(g.target,k.name);assert.ok(g.sectionTargets.includes(k.name));
    for(const field of ['concept','formulas','conditions','method','mistakes'])assert.ok(g[field].length>15,k.id+':'+field);
    assert.ok(g.example.question&&g.example.answer&&g.example.steps.length);
    if(subject==='math')assert.ok(content.items.some(i=>'pack:'+content.id+':'+i.id===g.example.itemId&&content.skills.find(s=>s.id===i.skillId).targetId===k.id));
    else assert.equal(g.example.itemId,undefined);
  }
});
test('viewed study examples survive backup so they cannot become fresh assessment items',()=>{
  const id='pack:sample:example',state={version:2,profile:{subject:'math'},exams:[],studiedItemIds:[id]};
  assert.deepEqual(Migration.prepare(state,K).state.studiedItemIds,[id]);
  // Exercise actual chooseProbe code with a bank containing a viewed item and a genuinely new item.
  const src=fs.readFileSync(__dirname+'/app.js','utf8'),body=src.slice(src.indexOf('  function chooseProbe('),src.indexOf('  function contentManager('));
  const run=new Function('data','C','allPacks','M','K','subject',`let probe,probePurpose,probeAnswer;const rememberExposure=()=>true;${body};return chooseProbe('k','review');`);
  const chosen=run({...state,reviews:[],diagnoses:[]},{probesFor:()=>[{id,text:'seen'},{id:'fresh',text:'new'}]},()=>[],{sameQuestion:()=>false},[],{id:'math'});
  assert.equal(chosen.id,'fresh');
});
