const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const M=require('./model.js');
const source=fs.readFileSync(__dirname+'/app.js','utf8').replace(/\r\n/g,'\n');
function harness(){
 const values=new Map(),elements=new Map(),events={},messages=[];
 let fail=false;
 const storage={getItem:k=>values.get(k)||null,setItem(k,v){if(fail===true||(typeof fail==='function'&&fail(k)))throw Error('quota');values.set(k,String(v));},removeItem:k=>values.delete(k)};
 const ctx={console:{error(){}},crypto:require('node:crypto').webcrypto,Date,URL,Blob,fetch,setTimeout,clearTimeout,setInterval:()=>0,
  localStorage:storage,sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{querySelector:s=>elements.get(s)||null,querySelectorAll:()=>[],addEventListener:(name,fn)=>events[name]=fn},FormData:class{constructor(form){this.v=form.values;}[Symbol.iterator](){return Object.entries(this.v)[Symbol.iterator]();}},
  window:{Subjects:require('./subjects.js'),ExamFocus:{attach:k=>k},KNOWLEDGE:[{id:'a',name:'A',prerequisites:[]}],Model:M,Content:{validatePack:p=>p,probesFor:()=>[{id:'item',text:'计算 2+3',answer:'5',kpId:'a'}]},MATH_CONTENT:{skills:[],items:[]},Services:{},addEventListener(){},scrollTo(){}},messages};
 const hook=`render=()=>{};toast=x=>messages.push(x);modal=()=>{};closeModal=()=>{asyncEpoch++};putImage=async()=> 'photo';
 window.test={get data(){return data},get draft(){return draft},get view(){return view},get demo(){return demo},get probe(){return probe},get probeAnswer(){return probeAnswer},get config(){return config},set(value){if(value.data)data=value.data;if('draft' in value)draft=value.draft;if(value.exam)activeExam=value.exam;if(value.view)view=value.view},action,save,go,recordReview,saveDiagnosis,enterDemo,exitDemo,chooseProbe,processFiles,keepExposures};`;
 const tail=source.indexOf('  render();\n  if(S)');assert.ok(tail>0);
 vm.runInNewContext(source.slice(0,tail)+hook+'\n})();',ctx);
 return {api:ctx.window.test,ctx,elements,events,messages,values,fail:v=>{fail=v}};
}
const review={kpId:'a',passed:true,source:'external',itemIds:['x'],evidence:'独立',scope:'atomic',assessmentKpId:'a',audit:{reviewer:'核对',date:'2026-09-01',alignment:'对口',answerCheck:'核对'}};
test('R2: review failure retains input, does not navigate or announce success, retry is idempotent',()=>{
 const h=harness();h.api.set({view:'review'});h.fail(true);assert.equal(h.api.recordReview(review),false);assert.equal(h.api.view,'review');assert.equal(h.api.data.reviews.length,1);assert.ok(!h.messages.some(x=>x.includes('已记录')));
 h.fail(false);assert.equal(h.api.recordReview(review),true);assert.equal(h.api.data.reviews.length,1);assert.equal(JSON.parse(h.values.get('zhiyin.math.v2')).reviews.length,1);
});
test('R2: diagnosis failure stays on form and retry adds only one diagnosis',()=>{
 const h=harness(),e={id:'exam',date:'2026-09-01',questions:[{id:'q',kpIds:['a'],correct:false}]};h.api.data.exams=[e];h.api.set({exam:'exam',view:'diagnose'});h.fail(true);h.api.saveDiagnosis(true);assert.equal(h.api.view,'diagnose');assert.ok(!h.messages.some(x=>x.includes('已记录')||x.includes('已保存')));h.fail(false);h.api.saveDiagnosis(true);assert.equal(h.api.data.diagnoses.length,1);
});
test('R2: exam submit failure preserves draft and retry never duplicates the exam',async()=>{
 const h=harness(),d={id:'draft-a',name:'A',date:'2026-09-01',photos:[],questions:[{id:'q',text:'题',kpIds:['a'],correct:false}]};h.api.set({draft:d,view:'import'});h.elements.set('#review-confirm',{checked:true});h.fail(true);await h.api.action({dataset:{action:'save-exam'}});assert.equal(h.api.draft,d);assert.equal(h.api.view,'import');h.fail(false);await h.api.action({dataset:{action:'save-exam'}});assert.equal(h.api.data.exams.length,1);assert.equal(h.api.draft,null);
});
test('R2: failed storage prevents switching away from the current learning space',()=>{
 const h=harness(),original=h.api.data;h.fail(true);h.api.enterDemo();assert.equal(h.api.demo,false);assert.equal(h.api.data,original);
});
test('R2: destination-space write failure cannot switch the current data object',()=>{
 const h=harness(),original=h.api.data;h.values.set('zhiyin.math.demo.v2',JSON.stringify(original));h.fail(k=>k.includes('demo'));h.api.enterDemo();assert.equal(h.api.demo,false);assert.equal(h.api.data,original);
});
test('R2: failed settings write retains live config and form',async()=>{
 const h=harness(),original=h.api.config;h.fail(true);await h.events.submit({preventDefault(){},target:{id:'settings-form',values:{mode:'online',endpoint:'https://example.com',model:'test'}}});assert.equal(h.api.config,original);assert.ok(!h.messages.some(x=>x.includes('设置已保存')));
});
test('R1: feedback failure exposes no answer; persisted feedback survives discard, navigation and reload',async()=>{
 const h=harness();h.api.chooseProbe('a','review');h.elements.set('#probe-answer',{value:'4'});h.fail(true);await h.api.action({dataset:{action:'check-probe'}});assert.equal(h.api.probeAnswer,null);
 h.fail(false);await h.api.action({dataset:{action:'check-probe'}});assert.equal(h.api.probeAnswer.correct,false);await h.api.action({dataset:{action:'discard-probe'}});h.api.go('today');assert.equal(h.api.chooseProbe('a','review'),null);
 const restored=M.migrate(JSON.parse(h.values.get('zhiyin.math.v2')));h.api.set({data:restored});assert.equal(h.api.chooseProbe('a','review'),null);assert.equal(h.api.keepExposures({exposures:[]},restored).exposures.length,1);
});
test('R7: slow recognition cannot write into replacement draft or deleted question',async()=>{
 for(const change of ['replace','navigate','delete']){
  const h=harness(),a={id:'a',photos:[],raw:'',questions:[{id:'q',process:''}]},b={id:'b',photos:[],raw:'',questions:[]};h.api.set({draft:a});let resolve,started;const signal=new Promise(r=>started=r);h.ctx.window.Services.recognize=()=>{started();return new Promise(r=>resolve=r)};
  const promise=h.api.processFiles([{name:'test'}],change==='delete'?'process':'paper',change==='delete'?'q':'');await signal;
  if(change==='replace')h.api.set({draft:b});if(change==='navigate')h.api.go('growth');if(change==='delete')a.questions=[];
  resolve('from-A');await promise;assert.equal(b.raw,'');assert.equal(a.raw,'');
 }
});
test('R7: valid recognition appends to its bound draft and preserves existing text',async()=>{
 const h=harness(),a={id:'a',photos:[],raw:'原文',questions:[]};h.api.set({draft:a});h.ctx.window.Services.recognize=async()=> '识别';await h.api.processFiles([{name:'test'}],'paper');assert.equal(a.raw,'原文\n识别');
});
