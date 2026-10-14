(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Subjects=factory();})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const configs={
    math:{id:'math',label:'数学',textbook:'人教A版（2019）',province:''},
    physics:{id:'physics',label:'物理',textbook:'人教版高中物理（现行六册）',province:'安徽'}
  };
  function get(id){const c=configs[id]||configs.math;return {...c,store:`zhiyin.${c.id}.v2`,demo:`zhiyin.${c.id}.demo.v2`,config:`zhiyin.${c.id}.config.v2`};}
  function assertBackup(raw,subject){
    const declared=raw?.profile?.subject||raw?.subject||'math';
    if(!configs[declared]||declared!==subject)throw new Error(`这份备份属于${configs[declared]?.label||'未知学科'}，请切换到对应学科学习空间后导入。`);
    const ids=[...(raw?.profile?.learnedIds||[]),...(raw?.profile?.unlearnedIds||[]),...(raw?.diagnoses||[]).map(d=>d.kpId),...(raw?.reviews||[]).map(r=>r.kpId)];
    const exams=Array.isArray(raw?.exams)?raw.exams:Object.values(raw?.exams||{});
    for(const e of [...exams,raw?.draft].filter(Boolean))for(const q of e.questions||[])ids.push(...(q.kpIds||[]));
    if(ids.some(id=>id!=='unclassified'&&typeof id==='string'&&(subject==='physics'?!id.startsWith('P-'):id.startsWith('P-'))))throw new Error('备份包含另一学科的知识点，已停止导入以保护原记录。');
    return true;
  }
  return {get,assertBackup};
});
