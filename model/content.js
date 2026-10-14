(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(root);else root.Content=factory(root);})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  function text(v,label,max=6000){if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(label+'缺失或过长');return v.trim();}
  function list(v,label,max=1000){if(!Array.isArray(v)||v.length>max)throw new Error(label+'必须为有效数组');return v;}
  function unique(v,label){if(new Set(v).size!==v.length)throw new Error(label+'编号重复');}
  function audit(v){
    if(!v||typeof v!=='object')throw new Error('已审核题目缺少审核资料');
    const date=text(v.date,'审核日期',10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>new Date().toISOString().slice(0,10))throw new Error('审核日期无效或在未来');
    return {reviewer:text(v.reviewer,'核对人',200),date,alignment:text(v.alignment,'考点核对依据',2000),answerCheck:text(v.answerCheck,'答案核对依据',2000)};
  }
  function builtIn(){return typeof module==='object'&&module.exports?require('./数学内容包-系统核验.json'):root.MATH_CONTENT;}
  function same(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}
  function requiresProcess(r){
    const p=builtIn();
    return !!(p&&Array.isArray(r?.itemIds)&&p.items.some(i=>i.status==='solution-checked'&&r.itemIds.includes('pack:'+p.id+':'+i.id)));
  }
  function systemRecord(r){
    const p=builtIn();if(!p||r?.source!=='system-pack'||r.scope!=='atomic'||r.assessmentKpId!==r.kpId||r.itemIds?.length!==1)return false;
    const i=p.items.find(i=>'pack:'+p.id+':'+i.id===r.itemIds[0]);
    return !!(i&&i.status==='system-checked'&&p.skills.find(s=>s.id===i.skillId)?.targetId===r.kpId&&r.questionText===i.text&&r.referenceAnswer===i.answer&&same(r.verification,i.verification)&&r.familyId===p.id+':'+i.familyId&&(!r.date||r.date.slice(0,10)>=i.verification.checkedAt));
  }
  function validatePack(raw){
    if(!raw||raw.schemaVersion!==1)throw new Error('不是受支持的学科内容包（schemaVersion 应为 1）');
    const p={schemaVersion:1,id:text(raw.id,'内容包编号',100),version:text(raw.version,'版本',50),subject:text(raw.subject,'学科',50),title:text(raw.title,'名称',200),grade:text(raw.grade,'年级',100),textbook:text(raw.textbook,'教材',200),source:text(raw.source,'来源与使用依据',1000)};
    if(!/^[a-z][a-z0-9._-]*$/.test(p.id))throw new Error('内容包编号只能使用小写字母、数字、点、下划线和连字符');
    p.skills=list(raw.skills,'知识点').map(s=>({id:text(s.id,'知识点编号',100),targetId:text(s.targetId,'对应目录编号',100),name:text(s.name,'知识点名称',200),objective:text(s.objective,'能力目标',2000),boundary:text(s.boundary,'检测边界',2000),prerequisites:list(s.prerequisites,'前置知识').map(id=>text(id,'前置编号',100)),prerequisiteSkills:text(s.prerequisiteSkills,'前置技能说明',1000)}));
    if(!p.skills.length)throw new Error('内容包至少需要一个知识点');
    unique(p.skills.map(s=>s.id),'知识点');unique(p.skills.map(s=>s.targetId),'目录关联');
    const ids=new Set(p.skills.map(s=>s.id));
    for(const s of p.skills)for(const id of s.prerequisites)if(!ids.has(id)||id===s.id)throw new Error('前置知识关联无效：'+id);
    const visiting=new Set(),done=new Set();
    function visit(s){if(visiting.has(s.id))throw new Error('前置知识存在循环');if(done.has(s.id))return;visiting.add(s.id);for(const id of s.prerequisites)visit(p.skills.find(k=>k.id===id));visiting.delete(s.id);done.add(s.id);}
    p.skills.forEach(visit);
    p.items=list(raw.items,'题目',3000).map(i=>{
      if(!ids.has(i.skillId))throw new Error('题目关联了不存在的知识点');
      if(!['draft','reviewed','system-checked','solution-checked'].includes(i.status))throw new Error('题目审核状态无效');
      const steps=list(i.steps,'解题步骤',30).map(s=>text(s,'解题步骤',2000));if(!steps.length)throw new Error('题目缺少解题步骤');
      const item={id:text(i.id,'题目编号',100),skillId:i.skillId,familyId:text(i.familyId,'题型编号',100),text:text(i.text,'题目'),answer:text(i.answer,'答案',1000),steps,alignment:text(i.alignment,'步骤与考点对应',2000),contrast:text(i.contrast,'对照追问',2000),source:text(i.source,'题目来源',1000),status:i.status,audit:i.status==='reviewed'?audit(i.audit):null};
      if(i.assessment)item.assessment={objective:text(i.assessment.objective,'本题目标',2000),boundary:text(i.assessment.boundary,'本题边界',2000),prerequisiteSkills:text(i.assessment.prerequisiteSkills,'本题前置技能',1000)};
      if(['system-checked','solution-checked'].includes(i.status)){
        const canonical=builtIn(),original=canonical?.items.find(x=>x.id===item.id),skill=p.skills.find(s=>s.id===item.skillId);
        if(p.id!==canonical?.id||p.subject!=='math'||!original||!same(skill,canonical.skills.find(s=>s.id===original.skillId))||!same(item,Object.fromEntries(Object.entries(original).filter(([k])=>k!=='verification')))||!same(i.verification,original.verification))throw new Error('系统核验与题目内容不匹配；改题后应恢复 draft 状态重新核验');
        item.verification=JSON.parse(JSON.stringify(original.verification));
      }
      return item;
    });
    unique(p.items.map(i=>i.id),'题目');return p;
  }
  function probesFor(targetId,packs,subject='math'){
    return packs.filter(p=>p.subject===subject).flatMap(p=>p.items.filter(i=>p.skills.find(s=>s.id===i.skillId)?.targetId===targetId).map(i=>{
      const skill=i.assessment||p.skills.find(s=>s.id===i.skillId);
      return {id:'pack:'+p.id+':'+i.id,kpId:targetId,assessmentKpId:targetId,text:i.text,answer:i.answer,explanation:i.steps.join('\n'),familyId:p.id+':'+i.familyId,source:i.status==='system-checked'?'system-pack':'content-pack',grading:(i.status==='solution-checked'||requiresProcess({itemIds:['pack:'+p.id+':'+i.id]}))?'process':'short',verification:i.verification,scope:'atomic',audit:i.audit,objective:skill.objective,boundary:skill.boundary,prerequisiteSkills:skill.prerequisiteSkills,alignment:i.alignment,contrast:i.contrast,origin:i.source,scopeLabel:i.status==='solution-checked'?'参考解答已复核 · 多步骤作答需逐步核对；保存练习不自动改变掌握状态。':i.status==='system-checked'?'系统交叉核验 · 仅适用于所列检测范围；不是教师审核或全知识点掌握证明。':i.status==='reviewed'?'已填写人工核对记录；仅用于所列能力范围，审核内容仍需使用者确认。':'原创题目草稿 · 未核验；仅保存练习，不改变掌握状态。'};
    }));
  }
  function mergePack(base,saved){
    if(base.id!==saved.id)throw new Error('只合并同编号内容包');
    const merge=(a,b)=>{const m=new Map(a.map(x=>[x.id,x]));b.forEach(x=>m.set(x.id,x));return [...m.values()];};
    return validatePack({...base,skills:merge(base.skills,saved.skills),items:merge(base.items,saved.items)});
  }
  return {validatePack,probesFor,systemRecord,mergePack,requiresProcess};
});
