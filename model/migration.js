(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'));else root.Migration=factory(root.Model);})(typeof window!=='undefined'?window:globalThis,function(Model){
  'use strict';
  const arr=x=>Array.isArray(x)?x:[];
  const text=(s,max=10000)=>String(s??'').slice(0,max);
  const norm=s=>text(s).normalize('NFKC').replace(/[\s（）()—-]/g,'').toLowerCase();
  function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
  function fingerprint(e){return JSON.stringify({name:e.importOriginalName||e.name,date:(e.date||'').slice(0,10),partial:!!e.partial,questions:arr(e.questions).map(q=>({num:q.num,text:q.text,answer:q.answer,studentAnswer:q.studentAnswer,correct:q.correct,knowledge:q.legacyKp||q.kpIds,explanation:q.explanation||''}))});}
  function prepare(raw,knowledge=[]){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('请选择原版导出的 JSON 数据文件。HTML 程序文件不包含其他浏览器的学习记录。');
    let source,normalized=raw,partial=false;
    if(raw.exportType==='wrongQuestions'&&Array.isArray(raw.wrongQuestions)){
      source='legacy-wrong';partial=true;const groups=new Map();
      for(const q of raw.wrongQuestions){if(!q||typeof q!=='object')throw new Error('错题记录格式错误');const key=JSON.stringify([q.examName||'旧版错题',q.examDate||'']);if(!groups.has(key))groups.set(key,{id:'legacy-wrong-'+hash(key),name:text(q.examName||'旧版错题')+'（仅导入错题）',date:q.examDate,partial:true,questions:[]});groups.get(key).questions.push({...q,correct:false});}
      normalized={exams:[...groups.values()]};
    }else if(typeof raw.examName==='string'&&Array.isArray(raw.questions)){
      source='legacy-single';normalized={exams:[{...raw,id:raw.id||'legacy-single-'+hash(JSON.stringify(raw)),name:raw.examName}]};
    }else if(raw.version===2&&Array.isArray(raw.exams))source='v2';
    else if(raw.exams&&typeof raw.exams==='object')source='legacy-all';
    else throw new Error('无法识别此文件。请在原版“整合报告”中导出“全部数据(JSON)”，也支持错题集和单份试卷 JSON。');
    const originals=Array.isArray(normalized.exams)?normalized.exams:Object.entries(normalized.exams).map(([id,e])=>({...e,id:e.id||id}));
    if(originals.length>200||originals.some(e=>arr(e.questions).length>500))throw new Error('单次最多导入200份考试，每份最多500题，请拆分文件后导入，避免截断数据。');
    const state=Model.migrate(normalized,knowledge);
    if(source==='v2'){
      for(const field of ['reviews','diagnoses','tasks','taskLog','exposures'])if(arr(normalized[field]).length!==arr(state[field]).length)throw new Error('备份 '+field+' 含无法完整恢复的记录；未导入，请核对编号、日期和学科。');
      if(new Set(arr(normalized.studiedItemIds)).size!==state.studiedItemIds.length)throw new Error('已见题集合无法完整恢复');
      const now=new Date(),targets=new Set([...arr(normalized.reviews),...arr(normalized.diagnoses)].map(x=>x.kpId));
      for(const id of targets){const before=Model.mastery(id,normalized,now),after=Model.mastery(id,state,now);if(before.status!==after.status||before.evidenceCount!==after.evidenceCount)throw new Error('备份知识点 '+id+' 恢复前后证据不一致；未导入，请保留原文件。');}
    }
    let unmapped=0,missingText=0,mapped=0;
    const normMap=new Map();for(const k of knowledge){const key=norm(k.name);if(normMap.has(key))normMap.set(key,null);else normMap.set(key,k.id);}
    for(let i=0;i<state.exams.length;i++){
      const e=state.exams[i],original=originals[i];e.partial=original.partial===true||partial;e.origin=source==='v2'?text(original.origin,100):'原版导入';
      for(let j=0;j<e.questions.length;j++){
        const q=e.questions[j],o=original.questions[j];q.legacyKp=text(o.legacyKp||(Array.isArray(o.kp)?o.kp.join('、'):o.kp)||'',2000);q.explanation=text(o.explanation,12000);
        if(q.kpIds.includes('unclassified')&&q.legacyKp){const exact=normMap.get(norm(q.legacyKp));if(exact)q.kpIds=[exact];}
        if(!q.kpIds.length||q.kpIds.includes('unclassified')){q.kpIds=['unclassified'];unmapped++;}else mapped++;
        if(!q.text.trim())missingText++;
      }
    }
    return {state,report:{source,label:{'legacy-all':'原版全部考试数据','legacy-wrong':'原版错题集（不含正确题）','legacy-single':'原版单份试卷','v2':'新版完整备份'}[source],partial,examCount:state.exams.length,questionCount:state.exams.reduce((n,e)=>n+e.questions.length,0),unmapped,mapped,missingText}};
  }
  function merge(current,incoming){
    const state=JSON.parse(JSON.stringify(current));state.exams=arr(state.exams);
    const fingerprints=new Set(state.exams.map(fingerprint));const usedExamIds=new Set(state.exams.map(e=>e.id));const usedQuestionIds=new Set(state.exams.flatMap(e=>e.questions.map(q=>q.id)));
    let duplicates=0,conflicts=0,added=0;
    for(const original of arr(incoming.exams)){
      const key=fingerprint(original);if(fingerprints.has(key)){duplicates++;continue;}
      const e=JSON.parse(JSON.stringify(original));
      if(usedExamIds.has(e.id)){conflicts++;e.id=e.id+'-import-'+hash(key);let n=2;while(usedExamIds.has(e.id))e.id=original.id+'-import-'+hash(key)+'-'+n++;e.importOriginalName=e.name;e.name=e.name+'（导入版本）';}
      for(const q of e.questions){if(usedQuestionIds.has(q.id))q.id=e.id+'-q-'+hash(JSON.stringify(q));usedQuestionIds.add(q.id);}
      state.exams.push(e);usedExamIds.add(e.id);fingerprints.add(key);added++;
    }
    return {state,report:{added,duplicates,conflicts}};
  }
  return {prepare,merge};
});
