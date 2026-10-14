const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const M=require('./model.js');
const source=fs.readFileSync(__dirname+'/app.js','utf8').replace(/\r\n/g,'\n');
function harness(){
 const values=new Map(),elements=new Map(),events={},messages=[];
 let fail=false;
 const storage={getItem:k=>values.get(k)||null,setItem(k,v){if(fail===true||(typeof fail==='function'&&fail(k)))throw Error('quota');values.set(k,String(v));},removeItem:k=>values.delete(k)};
 const ctx={console:{error(){}},crypto:require('node:crypto').webcrypto,Date,URL,Blob,fetch,setTimeout,clearTimeout,setInterval:()=>0,
  localStorage:storage,sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{querySelector:s=>elements.get(s)||null,querySelectorAll:()=>[],addEventListener:(name,fn)=>events[name]=fn},FormData:class{constructor(form){this.v=form.values;}[Symbol.iterator](){return Object.entries(this.v)[Symbol.iterator]();}},
  window:{Subjects:require('./subjects.js'),ExamFocus:{attach:k=>k},KNOWLEDGE:[{id:'a',name:'A',prerequisites:[]},{id:'b',name:'B',prerequisites:[]}],Model:M,Content:{validatePack:p=>p,probesFor:()=>[{id:'item',text:'计算 2+3',answer:'5',kpId:'a'}]},MATH_CONTENT:{skills:[],items:[]},Services:{},addEventListener(){},scrollTo(){}},messages};
 const hook=`render=()=>{};toast=x=>messages.push(x);modal=()=>{};closeModal=()=>{asyncEpoch++};putImage=async()=> 'photo';
 window.test={get data(){return data},get draft(){return draft},get view(){return view},get demo(){return demo},get probe(){return probe},get probeAnswer(){return probeAnswer},get config(){return config},set(value){if(value.data)data=value.data;if('draft' in value)draft=value.draft;if(value.exam)activeExam=value.exam;if(value.view)view=value.view},aiReview,action,save,go,recordReview,saveDiagnosis,enterDemo,exitDemo,chooseProbe,processFiles,keepExposures};`;
 const tail=source.indexOf('  render();\n  if(S)');assert.ok(tail>0);
 vm.runInNewContext(source.slice(0,tail)+hook+'\n})();',ctx);
 return {api:ctx.window.test,ctx,elements,events,messages,values,fail:v=>{fail=v}};
}
const {execFileSync}=require('node:child_process');
const record={id:'review-a',kpId:'a',assessmentKpId:'a',source:'external',scope:'atomic',passed:true,certainty:'sure',itemIds:['external:a'],date:'2026-10-09T16:30:00.000Z',audit:{reviewer:'核对',date:'2026-10-10',alignment:'对口',answerCheck:'独立核对'}};
for(const tz of ['UTC','Asia/Shanghai','America/New_York']){
 test(`STU-R1: persisted timezone survives reload and current timezone ${tz}`,()=>{
  const input={...record,dateTimezoneOffset:-480};
  const code=`const assert=require('node:assert/strict'),M=require('./model.js');const r=${JSON.stringify(input)};assert.equal(M.evidenceEligible(r),true);const restored=M.migrate({profile:{},reviews:[r]},[{id:'a'}]).reviews[0];assert.equal(restored.dateTimezoneOffset,-480);assert.equal(M.evidenceEligible(restored),true);assert.equal(M.evidenceEligible({...r,audit:{...r.audit,date:'2026-10-11'}}),false);`;
  execFileSync(process.execPath,['-e',code],{cwd:__dirname,env:{...process.env,TZ:tz}});
 });
}
test('STU-R1: legacy local-calendar records recover in Shanghai without changing their timestamp',()=>{
 const code=`const assert=require('node:assert/strict'),M=require('./model.js');const r=${JSON.stringify(record)};assert.equal(M.evidenceEligible(r),true);const restored=M.migrate({profile:{},reviews:[r]},[{id:'a'}]).reviews[0];assert.equal(restored.date,r.date);assert.equal(M.evidenceEligible(restored),true);`;
 execFileSync(process.execPath,['-e',code],{cwd:__dirname,env:{...process.env,TZ:'Asia/Shanghai'}});
});
test('STU-R1: new review retains actual timezone offset',()=>{
 const h=harness();h.api.recordReview(record);const saved=h.api.data.reviews[0];assert.equal(saved.dateTimezoneOffset,new Date(saved.date).getTimezoneOffset());
});
test('STU-R1: date-only imports preserve their calendar day in western timezones',()=>{
 const code=`const assert=require('node:assert/strict'),M=require('./model.js');const r=${JSON.stringify({...record,date:'2026-10-10'})};assert.equal(M.evidenceEligible(r),true);assert.equal(M.evidenceEligible(M.migrate({profile:{},reviews:[r]},[{id:'a'}]).reviews[0]),true);`;
 execFileSync(process.execPath,['-e',code],{cwd:__dirname,env:{...process.env,TZ:'America/New_York'}});
});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
const answer=title=>JSON.stringify({text:title,answer:'5',explanation:'解答',scopeLabel:'练习'});
async function start(h){h.elements.set('#review-status',{textContent:''});await h.api.action({dataset:{action:'review-kp',id:'a'}});const d=deferred();h.ctx.window.Services.askAI=()=>d.promise;return d;}
for(const change of ['navigate','switch','local','discard','mode','data']){
 test(`STU-R2: late response cannot overwrite after ${change}`,async()=>{
  const h=harness(),d=await start(h),pending=h.api.aiReview();
  if(change==='navigate')h.api.go('growth');
  if(change==='switch')await h.api.action({dataset:{action:'review-kp',id:'b'}});
  if(change==='local')await h.api.action({dataset:{action:'make-review'}});
  if(change==='discard')await h.api.action({dataset:{action:'discard-probe'}});
  if(change==='mode')await h.api.action({dataset:{action:'review-mode',mode:'external'}});
  if(change==='data')h.api.set({data:{...h.api.data}});
  const previous=h.api.probe;d.resolve(answer('only A'));await pending;assert.equal(h.api.probe,previous);
 });
}
test('STU-R2: latest AI request wins, remains a practice-only A question',async()=>{
 const h=harness(),first=await start(h),one=h.api.aiReview(),second=deferred();h.ctx.window.Services.askAI=()=>second.promise;const two=h.api.aiReview();second.resolve(answer('second A'));await two;first.resolve(answer('first A'));await one;assert.equal(h.api.probe.text,'second A');assert.equal(h.api.probe.kpId,'a');assert.equal(h.api.probe.scope,'practice');assert.equal(M.evidenceEligible(h.api.probe),false);
});
test('STU-R2: stale error cannot replace a newer request status',async()=>{
 const h=harness(),old=await start(h),one=h.api.aiReview();const fresh=deferred();h.ctx.window.Services.askAI=()=>fresh.promise;const two=h.api.aiReview();old.reject(Error('old failure'));await one;assert.equal(h.elements.get('#review-status').textContent,'正在生成针对性新题…');fresh.resolve(answer('current'));await two;assert.equal(h.api.probe.text,'current');
});
