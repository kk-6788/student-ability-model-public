(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./content.js'));else root.Model=factory(root.Content);})(typeof window!=='undefined'?window:globalThis,function(C){
  'use strict';
  const DAY=86400000;
  const labels={unlearned:'未学习',untested:'未检测',weak:'待加强',uncertain:'待确认',preliminary:'初步掌握',stable:'较稳定掌握'};
  const causes={concept:'概念理解待核验',method:'解题方法待核验',calculation:'运算执行待核验',reading:'审题理解待核验',unknown:'解题路径尚不清楚（初步判断）'};
  const arr=x=>Array.isArray(x)?x:[];
  const str=(x,n=10000)=>typeof x==='string'?x.slice(0,n):typeof x==='number'?String(x):'';
  const ids=x=>[...new Set(arr(x).map(v=>str(v,200)).filter(Boolean))];
  const date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():'';
  const validTime=x=>Number.isFinite(new Date(x).getTime());
  const certainty=x=>['sure','unsure','guess'].includes(x)?x:'unsure';

  function cleanAudit(a){
    if(!a||typeof a!=='object')return null;
    return {reviewer:str(a.reviewer,200).trim(),date:date(a.date).slice(0,10),alignment:str(a.alignment,2000).trim(),answerCheck:str(a.answerCheck,2000).trim()};
  }
  function evidenceEligible(r){
    if(r?.grading==='process'||C.requiresProcess(r))return false;
    if(r?.source==='system-pack')return C.systemRecord(r);
    const a=cleanAudit(r?.audit);
    return !!(r&&['external','content-pack','system-pack'].includes(r.source)&&r.scope==='atomic'&&r.assessmentKpId===r.kpId&&a&&a.reviewer&&a.date&&a.alignment&&a.answerCheck&&(!date(r.date)||a.date<=date(r.date).slice(0,10))&&!arr(r.itemIds).some(id=>/^ai-|^local-bank:/.test(id)));
  }
  function diagnose(question,answers={},knowledge=[]){
    const q=question||{}, reason=Object.hasOwn(causes,answers.reason)?answers.reason:'unknown';
    const evidence=[];
    if(typeof q.correct==='boolean')evidence.push(q.correct?'原题作答正确':'原题作答错误');
    if(q.certainty&&q.certainty!=='sure')evidence.push(q.certainty==='guess'?'学生标记猜测作答':'学生标记答案存疑');
    if(reason!=='unknown')evidence.push('学生自述：'+causes[reason].replace('待核验',''));
    if(typeof answers.probeCorrect==='boolean')evidence.push('针对性追问题：'+(answers.probeCorrect?'通过':'未通过'));
    const process=str(answers.process||q.process,3000).trim();
    if(process)evidence.push('学生提供的解题过程：'+process);
    // A prose self-report is not independently verified causal evidence.
    const supported=reason==='concept'&&answers.probeCorrect===false&&answers.probeScope==='atomic'&&evidenceEligible(answers.probeEvidence);
    const nodes=arr(knowledge).filter(k=>arr(q.kpIds).includes(k.id));
    const pre=[...new Set(nodes.flatMap(k=>arr(k.prerequisites)))].map(id=>knowledge.find(k=>k.id===id)?.name||id);
    return {cause:reason,label:causes[reason],confidence:supported?'supported':'preliminary',evidence,
      prerequisiteHint:pre.length?'必要时核验前置知识：'+pre.join('、'):'先核验题目涉及的单个知识点；一道综合题不能证明所有关联知识点薄弱'};
  }

  function groupQuestions(questions,maxMinutes=15,excludeKpIds=[]){
    const budget=Math.max(0,Math.min(15,Number(maxMinutes)||0));
    const groups=new Map();
    for(const q of arr(questions)){
      if(q.correct!==false&&!(q.correct===true&&q.certainty!=='sure'))continue;
      for(const key of (arr(q.kpIds).length?ids(q.kpIds):['unclassified'])){
        if(excludeKpIds.includes(key))continue;
        if(!groups.has(key))groups.set(key,{kpId:key,questions:[],estimatedMinutes:0});
        groups.get(key).questions.push(q);
      }
    }
    let used=0;const result=[];
    for(const g of [...groups.values()].sort((a,b)=>b.questions.filter(q=>q.correct===false).length-a.questions.filter(q=>q.correct===false).length)){
      g.estimatedMinutes=Math.min(5,2+g.questions.length);
      if(used+g.estimatedMinutes>budget)continue;
      used+=g.estimatedMinutes;result.push(g);
    }
    return result;
  }

  // Missing/invalid dates remain visible in history, but cannot support a time-based inference.
  function atTime(value,now){return !!date(value)&&Date.parse(value)<=+new Date(now);}
  function currentState(state,now){return {...state,
    exams:arr(state.exams).filter(e=>atTime(e.date,now)),
    diagnoses:arr(state.diagnoses).filter(d=>atTime(d.createdAt,now)&&(!d.examId||arr(state.exams).some(e=>e.id===d.examId&&atTime(e.date,now)))),
    reviews:arr(state.reviews).filter(r=>atTime(r.date,now))};}
  function questionKey(value){return str(value).normalize('NFKC').replace(/[−–]/g,'-').replace(/[\s:：,，;；?？!！。]/g,'').replace(/^\d+[.、)）]/,'');}
  function evidenceView(kpId,state,now){
    const current=currentState(state,now),qs=current.exams.flatMap(e=>arr(e.questions)).filter(q=>arr(q.kpIds).includes(kpId));
    const usedIds=new Set(qs.map(q=>q.id).filter(Boolean)),texts=qs.map(q=>q.text).filter(Boolean);
    const history=current.reviews.filter(r=>r.kpId===kpId).slice().sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
    const entries=history.map(record=>{
      const itemIds=ids(record.itemIds),eligible=evidenceEligible(record)&&itemIds.length>0;
      const exposed=arr(state.exposures).some(x=>x.answerAt&&atTime(x.answerAt,record.date)&&!(record.attemptId&&record.attemptId===x.attemptId)&&(itemIds.includes(x.id)||sameQuestion(x.questionText,record.questionText)));
      const independent=eligible&&!exposed&&itemIds.every(id=>!usedIds.has(id))&&!texts.some(t=>sameQuestion(t,record.questionText));
      itemIds.forEach(id=>usedIds.add(id));if(record.questionText)texts.push(record.questionText);
      const accepted=independent&&(record.passed===false||(record.passed===true&&record.certainty==='sure'));
      return {record,eligible,independent,accepted,exposed,reason:!eligible?'unverified':exposed?'answer-seen':!independent?'repeated':!accepted?'uncertain-answer':'accepted'};
    });
    return {current,qs,history,entries};
  }
  function mastery(kpId,state={},now=new Date()){
    const nowMs=validTime(now)?new Date(now).getTime():Date.now();
    const evidence=evidenceView(kpId,state,nowMs),qs=evidence.qs;
    const graded=qs.filter(q=>typeof q.correct==='boolean'),correct=graded.filter(q=>q.correct).length;
    const diagnoses=evidence.current.diagnoses.filter(d=>d.kpId===kpId);
    const allHistory=evidence.history,history=evidence.entries.filter(x=>x.eligible).map(x=>x.record);
    let status='untested', nextReviewAt=null,firstPass=null,stable=false;
    if(qs.length||allHistory.some(evidenceEligible)||diagnoses.length)status='uncertain';
    if(graded.some(q=>!q.correct&&arr(q.kpIds).length===1)||diagnoses.some(d=>d.confidence==='supported'&&evidenceEligible(d.probeEvidence)))status='weak';
    let evidenceCount=0;
    const usedItems=new Set(qs.map(q=>q.id).filter(Boolean));
    const usedTexts=qs.map(q=>q.text).filter(Boolean);
    const examEvents=evidence.current.exams.flatMap(e=>date(e.date)?arr(e.questions).filter(q=>arr(q.kpIds).includes(kpId)&&((q.correct===false&&q.kpIds.length===1)||(q.correct===true&&q.certainty!=='sure'))).map(q=>({examEvent:true,passed:false,date:e.date,uncertain:q.correct===true})):[]).filter(r=>Date.parse(r.date)<=nowMs);
    const events=[...history,...examEvents].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
    for(const r of events){
      if(r.examEvent){status=r.uncertain?'uncertain':'weak';firstPass=null;stable=false;nextReviewAt=null;continue;}
      const rIds=ids(r.itemIds),entry=evidence.entries.find(x=>x.record===r);
      if(!entry?.eligible)continue;
      if(r.passed===false){status='weak';firstPass=null;stable=false;nextReviewAt=new Date(Date.parse(r.date)+DAY).toISOString();if(entry.accepted)evidenceCount++;continue;}
      if(!entry.accepted)continue;
      evidenceCount++;
      if(!firstPass){firstPass=r;status='preliminary';nextReviewAt=new Date(Date.parse(r.date)+3*DAY).toISOString();}
      else if((r.source!=='external'||r.transferConfirmed===true)&&(!r.familyId||r.familyId!==firstPass.familyId)&&Date.parse(r.date)-Date.parse(firstPass.date)>=3*DAY&&rIds.every(id=>!ids(firstPass.itemIds).includes(id))){stable=true;status='stable';nextReviewAt=new Date(Date.parse(r.date)+7*DAY).toISOString();}
      else if(!stable)status='preliminary';
    }
    if(arr(state.profile?.unlearnedIds).includes(kpId)){status='unlearned';nextReviewAt=null;}
    return {status,label:labels[status],correct,total:graded.length,accuracy:graded.length?correct/graded.length:null,
      confidence:status==='stable'?'supported':status==='untested'||status==='unlearned'?'none':'preliminary',
      evidenceCount,nextReviewAt,history:allHistory.map(r=>({...r,itemIds:ids(r.itemIds)}))};
  }

  function abilityProfile(kpId,state={},now=new Date()){
    const m=mastery(kpId,state,now);
    const nowMs=validTime(now)?new Date(now).getTime():Date.now();
    const pipeline=evidenceView(kpId,state,nowMs);
    const uploaded=arr(state.reviews).filter(r=>r.kpId===kpId);
    const verified=pipeline.entries.filter(e=>e.accepted);
    const futureCount=uploaded.length-pipeline.history.length;
    const practiceCount=uploaded.length-verified.length;
    const failureObservationCount=pipeline.entries.filter(e=>e.eligible&&e.record.passed===false).length;
    const atomicGraded=pipeline.qs.filter(q=>arr(q.kpIds).length===1&&typeof q.correct==='boolean').length;
    const dimension=(id,label,level,evidence)=>({id,label,level,evidence});
    let levels;
    if(m.status==='unlearned')levels=['尚未学习','尚未验证','尚未验证','尚未验证'];
    else if(m.status==='untested')levels=['未检测','未检测','未检测','未检测'];
    else if(m.status==='weak')levels=['需要加强','尚未独立通过','待重新验证','待重新验证'];
    else if(m.status==='uncertain')levels=['待确认','待确认','待变式验证','待延迟验证'];
    else if(m.status==='preliminary')levels=['初步通过','独立完成一次','待变式验证','待延迟验证'];
    else levels=['已有支持','已有支持','已有支持','已有支持'];
    const dimensions=[
      dimension('understanding','知识理解',levels[0],m.status==='weak'?'已有单知识点错误或正式复测失败':m.status==='stable'?'已通过两次相互独立的对口核验':m.status==='preliminary'?'已通过一次对口核验':'尚需对口作答确认'),
      dimension('independence','独立完成',levels[1],m.status==='stable'||m.status==='preliminary'?'通过记录为确定作答，且题目标识可区分':'猜测、提示或未核对过程不算独立通过'),
      dimension('transfer','题型迁移',levels[2],m.status==='stable'?'延迟核验使用不同题目标识与题型；外部题需明确确认变式':'需要不同形式的新题再次核验'),
      dimension('stability','保持稳定',levels[3],m.status==='stable'?'首次通过至少 3 天后再次通过，后续仍会安排复测':'需要经过时间间隔后的新题复测')
    ];
    const sufficiency=verified.length>=2?{level:'较充分',detail:`有 ${verified.length} 条可计入状态的正式证据${futureCount?`；另有 ${futureCount} 条记录日期晚于当前时间，未计入`:''}`}:verified.length===1?{level:'有限',detail:`有 1 条可计入状态的正式证据${futureCount?`；另有 ${futureCount} 条记录日期晚于当前时间，未计入`:''}`}:atomicGraded?{level:'有限',detail:`有 ${atomicGraded} 条单知识点原始作答，尚无正式复测证据`}:{level:'无证据',detail:'尚无可计入掌握状态的正式证据'};
    const nextStep=m.status==='unlearned'?'学到该内容后再开始检测':m.status==='weak'?'先核对错因和前置知识，再做一题对口新题':m.status==='preliminary'?'到期后用不同形式的新题做延迟复测':m.status==='stable'?'按到期时间复测；新错误会重新打开问题':practiceCount?'先核对已保存的解题过程，再记录人工批改结果':'完成一题对口新题，保留作答与批改依据';
    return {...m,dimensions,sufficiency,verifiedEvidenceCount:verified.length,failureObservationCount,practiceCount,nextStep};
  }

  function plan(state={},knowledge=[],minutes=20,now=new Date()){
    state=currentState(state,now);
    const budget=Math.max(0,Math.min(180,Math.floor(Number(minutes)||0)));if(budget<3)return [];
    const p=state.profile||{},nowMs=new Date(now).getTime();
    const examMs=Date.parse(p.examDate),examSoon=Number.isFinite(examMs)&&examMs>=nowMs-DAY&&examMs<=nowMs+21*DAY;
    const scope=examSoon?str(p.examScope):str(p.progress);
    const terms=scope.split(/[、，,；;\n]/).map(s=>s.trim()).filter(Boolean);
    const learned=ids(p.learnedIds),unlearned=ids(p.unlearnedIds);
    const matches=k=>terms.some(t=>[k.id,k.name,k.module,k.chapter,k.section].some(s=>String(s||'').includes(t)));
    const measured=new Map(knowledge.map(k=>[k.id,mastery(k.id,state,now)]));
    const observed=new Set([...arr(state.exams).flatMap(e=>arr(e.questions).filter(q=>q.correct===false||(q.correct===true&&q.certainty!=='sure')).flatMap(q=>arr(q.kpIds))),...arr(state.diagnoses).map(d=>d.kpId),...arr(state.reviews).filter(evidenceEligible).map(r=>r.kpId)]);
    const scored=knowledge.filter(k=>!unlearned.includes(k.id)&&observed.has(k.id)).map((k,i)=>{
      const m=measured.get(k.id);let score=matches(k)?100:0;
      if(['stable','preliminary'].includes(m.status)&&(!m.nextReviewAt||Date.parse(m.nextReviewAt)>nowMs))return {k,score:0,i};
      if(m.status==='weak')score+=45;
      if(m.status==='uncertain')score+=20;
      if(m.nextReviewAt&&Date.parse(m.nextReviewAt)<=nowMs)score+=60;
      if(learned.includes(k.id))score+=5;
      return {k,score,i};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i);
    const tasks=[],seen=new Set();let used=0;
    const materialText=str(p.materials)||[str(p.textbook), '自备教材或教辅'].filter(Boolean).join('；');
    function add(k,prerequisite=false){
      if(!k||seen.has(k.id)||used>=budget)return;
      seen.add(k.id);
      for(const id of arr(k.prerequisites)){
        if(measured.get(id)?.status==='weak')add(knowledge.find(n=>n.id===id),true);
      }
      const m=measured.get(k.id),due=m?.nextReviewAt&&Date.parse(m.nextReviewAt)<=nowMs;
      const isReview=due||m?.status==='preliminary'||m?.status==='stable';
      const duration=Math.min(isReview?5:8,budget-used);if(duration<3)return;
      used+=duration;
      tasks.push({id:'task:'+k.id+':'+new Date(now).toISOString().slice(0,10),kpId:k.id,title:(isReview?'独立复测：':'学习与练习：')+k.name,minutes:duration,
        reason:prerequisite?'当前学习需要的前置知识存在薄弱证据':due?'已到延迟复测时间':matches(k)?(examSoon?'优先覆盖已确认考试范围':'衔接已确认学习进度'):m?.status==='weak'?'原题或复测显示需要加强':'补充独立证据',
        material:materialText+'；请在其中查找 '+[k.chapter,k.section,k.name].filter(Boolean).join(' / ')+' 对应内容（具体页码和题号需自行核对）',
        completion:isReview?'不看答案独立完成对口的新题，记录题目标识、解题过程、批改结果与把握程度':'阅读定义和例题，说明关键条件，再独立完成 1–2 道对口练习并批改',kind:isReview?'review':'study'});
    }
    for(const x of scored)add(x.k);
    return tasks;
  }

  function normalizeAnswer(x){return str(x,1000).normalize('NFKC').trim().replace(/[−–]/g,'-').replace(/\s+/g,'').replace(/^[a-zA-Z]=/,'').replace(/[。.]$/,'').toLowerCase();}
  function numberValue(s){
    if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))return Number(s);
    const m=s.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\/([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);
    return m&&Number(m[2])!==0?Number(m[1])/Number(m[2]):NaN;
  }
  function checkAnswer(input,expected){const a=normalizeAnswer(input),b=normalizeAnswer(expected);if(!a||!b)return false;if(a===b)return true;const x=numberValue(a),y=numberValue(b);return Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<1e-10*Math.max(1,Math.abs(y));}
  function sameQuestion(a,b){const key=s=>str(s).normalize('NFKC').split(/[。\n]/)[0].replace(/[−–]/g,'-').replace(/[\s:：,，;；?？!！]/g,'').replace(/^\d+[.、)）]/,'');const x=key(a),y=key(b);return !!(x&&y&&(x===y||(Math.min(x.length,y.length)>=5&&(x.includes(y)||y.includes(x)))));}

  // These draft templates sample module fundamentals, not every atomic skill.
  function makeProbe(kpId,knowledge,variant=0){
    const k=arr(knowledge).find(x=>x.id===kpId);if(!k||k.subject==='physics'||k.id.startsWith('P-'))return null;
    const topic=[k.name,k.section,k.chapter,k.module].filter(Boolean).join(' ');
    const v=Math.max(0,Math.floor(Number(variant)||0))%1000,n=v+2;
    let type,text,answer,explanation;
    const exact=(t,q,a,e)=>({id:'atomic-bank:'+kpId+':'+v,kpId,text:q,answer:String(a),explanation:e,source:'local-bank',scope:'atomic',familyId:'legacy:'+t,audit:null,scopeLabel:'本题针对：'+k.name+'。模板尚未经教师审核，仅作练习，不改变掌握状态。'});
    if(kpId==='J-ALG-03')return exact('sign',`解不等式：−${n}x > ${n*(n+1)}。（用 x 与不等号表示解集）`,`x<-${n+1}`,`两边除以负数 −${n}，不等号方向改变，得 x < −${n+1}。`);
    if(kpId==='J-ALG-01')return exact('equation',`解方程 3x + ${n} = ${4*n}，求 x。`,n,`移项得3x=${3*n}，所以x=${n}。`);
    if(kpId==='J-ALG-05')return exact('zero',`函数 y=(x−${n})(x−${n+2}) 的图像与 x 轴相交。较小交点的横坐标是多少？`,n,`x轴上y=0，解得x=${n}或${n+2}，较小者为${n}。`);
    if(/函数零点的定义|函数零点的概念/.test(k.name))return exact('zero-definition',`已知 f(x)=x−${n}。它的零点是多少？`,n,`零点是使f(x)=0的自变量的值，故x=${n}。`);
    if(/单调性的定义/.test(k.name))return exact('monotonic',`函数 f(x)=−${n}x+1 在实数范围内是增函数还是减函数？（填写：增函数/减函数）`,'减函数',`x₁<x₂时，乘负数后−${n}x₁>−${n}x₂，故f(x₁)>f(x₂)，为减函数。`);
    function set(t,q,a,e){type=t;text=q;answer=String(a);explanation=e;}
    if(/初中.*(有理数|实数)|有理数运算/.test(topic))set('rational',`计算：${n} + (−${n+3})。`,-3,'异号相加，取绝对值较大数的符号，绝对值相减。');
    else if(/初中.*(一元|方程)|一元一次方程/.test(topic))set('linear-equation',`解方程：2x + ${n} = ${3*n}，填写 x 的值。`,n,`两边减去 ${n}，再除以 2，得 x = ${n}。`);
    else if(/初中.*(勾股|几何)|勾股定理/.test(topic))set('pythagoras',`直角三角形两直角边为 ${3*n} 和 ${4*n}，斜边长是多少？`,5*n,'由勾股定理，斜边平方等于两直角边平方之和。');
    else if(/初中.*(因式|整式)|因式分解/.test(topic))set('factor',`若 x² − ${n*n} = 0 且 x > 0，求 x。`,n,`平方差分解得 (x−${n})(x+${n})=0，结合 x>0。`);
    else if(/二项式/.test(topic))set('binomial',`(1+x)^${n+2} 展开式中 x 的系数是多少？`,n+2,`一次项系数为 C(${n+2},1) = ${n+2}。`);
    else if(/排列|组合|计数原理/.test(topic))set('counting',`从 ${n+2} 名学生中选出 2 名（不区分顺序），有多少种选法？`,(n+2)*(n+1)/2,'从 m 人中无序选两人为 C(m,2)=m(m−1)/2。');
    else if(/概率|随机变量|分布列/.test(topic))set('probability',`袋中有 1 个红球和 ${n-1} 个白球，除颜色外相同，随机摸一个球，摸到红球的概率是多少？`,`1/${n}`,`共 ${n} 个等可能结果，红球对应 1 个结果，概率为 1/${n}。`);
    else if(/统计|平均数|方差|抽样|回归/.test(topic))set('statistics',`数据 ${n}、${n+2}、${n+4} 的算术平均数是多少？`,n+2,'三个数相加再除以 3。');
    else if(/导数|导函数|微积分/.test(topic))set('derivative',`函数 f(x)=x²，求 f′(${n})。`,2*n,`f′(x)=2x，代入 x=${n}。`);
    else if(/数列/.test(topic))set('sequence',`等差数列首项为 ${n}，公差为 3，第 4 项是多少？`,n+9,'等差数列 a₄=a₁+3d。');
    else if(/椭圆|双曲线|抛物线|圆锥曲线/.test(topic))set('conic',`椭圆 x²/${(n+1)**2} + y²/${n**2} = 1 的长半轴长是多少？`,n+1,`较大分母为 a²=${(n+1)**2}，长半轴 a=${n+1}。`);
    else if(/直线与圆|圆的|直线的|斜率|解析几何/.test(topic))set('coordinate',`直线经过点 (0,1) 和 (2,${2*n+1})，斜率是多少？`,n,'斜率为纵坐标之差除以横坐标之差。');
    else if(/立体几何|空间|棱柱|棱锥|体积/.test(topic))set('solid',`一个长方体长 ${n}、宽 3、高 4，体积是多少？`,12*n,'长方体体积等于长×宽×高。');
    else if(/复数|虚数/.test(topic))set('complex',`设 i²=−1，复数 (${n}+2i)+(3−2i) 等于多少？`,n+3,'实部相加，虚部相加；虚部抵消。');
    else if(/解三角形|正弦定理|余弦定理/.test(topic))set('triangle',`三角形两边长分别为 ${n} 和 ${n+1}，夹角为 90°，第三边的平方是多少？`,n*n+(n+1)**2,'余弦定理中 cos90°=0，第三边平方等于两边平方和。');
    else if(/向量/.test(topic))set('vector',`向量 a=(${n},1)，b=(2,3)，求数量积 a·b。`,2*n+3,'数量积等于对应坐标乘积之和。');
    else if(/三角|弧度|诱导公式|正弦|余弦|正切/.test(topic))set('trigonometry',`已知 sin α = 1/2，求 ${2*n} sin α。`,n,`${2*n} × 1/2 = ${n}。`);
    else if(/对数/.test(topic))set('logarithm',`求以 ${n} 为底、${n*n} 为真数的对数。`,2,`${n}²=${n*n}，因此对数等于 2。`);
    else if(/指数|幂函数/.test(topic))set('exponential',`已知 f(x)=${n}^x，求 f(3)。`,n**3,'把 x=3 代入指数函数，即求底数的三次方。');
    else if(/不等式|一元二次/.test(topic))set('inequality',`不等式 (x−${n})(x−${n+2}) < 0 的解集是？（填写开区间）`,`(${n},${n+2})`,'二次项系数为正，两根之间的函数值小于零，端点不取。');
    else if(/命题|逻辑|量词|条件/.test(topic))set('logic',`命题 p：“${n} > ${n+1}”为假，其否定命题为真还是假？（填写：真/假）`,'真','一个命题与其否定的真假相反。');
    else if(/集合|交集|并集|子集|德摩根|Venn/.test(topic))set('set',`集合 A={${n},${n+1}}，B={${n+1},${n+2}}，A∩B 中唯一的元素是什么？`,n+1,'交集包含同时属于两个集合的元素。');
    else if(/函数|映射|定义域|值域|单调|奇偶/.test(topic))set('function',`已知 f(x)=2x+1，求 f(${n})。`,2*n+1,'把给定自变量代入函数解析式。');
    if(!type)return null;
    return {id:'local-bank:'+type+':'+v,kpId,text,answer,explanation,source:'local-bank',scope:'module-basic',scopeLabel:'模块基础抽查：仅检验本题所示基础，不代表该原子知识点已掌握；请用对口的外部新题完成正式复测'};
  }

  function validateBackup(raw){
    const quotas={exams:200,questions:500,reviews:5000,diagnoses:5000,tasks:1000,taskLog:2000,studiedItemIds:3000,exposures:10000,evidence:30};
    const limits={id:200,kpId:200,assessmentKpId:200,familyId:200,name:200,title:500,reason:1000,label:500,num:30,source:500,origin:100,importOriginalName:200,legacyKp:2000,explanation:12000,detail:3000,aiNote:6000,prerequisiteHint:3000,questionText:6000,referenceAnswer:1000,reviewer:200,alignment:2000,answerCheck:2000,raw:100000,answerRaw:30000};
    function walk(v,path='',field=''){
      if(Array.isArray(v)){const limit=quotas[field]||1000;if(v.length>limit)throw new Error(`备份 ${path} 共 ${v.length} 项，超过上限 ${limit}；未导入、未截断，请保留完整备份。`);v.forEach((x,i)=>walk(x,`${path}[${i}]`,field==='evidence'?'evidenceText':field));}
      else if(v&&typeof v==='object'){for(const [k,x] of Object.entries(v))if(k!=='images')walk(x,path?path+'.'+k:k,k);}
      else if(typeof v==='string'){const limit=/\.probe\.answer$/.test(path)?1000:path==='profile.name'?30:field.endsWith('Ids')?200:field==='evidenceText'?3000:limits[field]||10000;if(v.length>limit)throw new Error(`备份 ${path} 长度 ${v.length} 超过上限 ${limit}；未导入、未截断。`);}
    }
    walk(raw);
  }
  function migrate(raw,knowledge=[]){
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||(!Object.hasOwn(raw,'exams')&&!Object.hasOwn(raw,'profile')))throw new Error('不是有效的学习数据备份：需要 exams 或 profile');
    if(raw.exams!==undefined&&(raw.exams===null||typeof raw.exams!=='object'))throw new Error('考试 exams 格式错误');
    if(raw.profile!==undefined&&(!raw.profile||typeof raw.profile!=='object'||Array.isArray(raw.profile)))throw new Error('学生档案 profile 格式错误');
    validateBackup(raw);
    const known=new Map(knowledge.flatMap(k=>[[k.id,k.id],[k.name,k.id]]));
    const kpIds=x=>ids(x).map(k=>known.get(k)||k).filter(k=>k==='unclassified'||!knowledge.length||known.has(k));
    const p=raw.profile||{},profile={subject:p.subject==='physics'?'physics':'math'};
    for(const key of ['grade','province','textbook','progress','materials','examScope'])profile[key]=str(p[key]);
    profile.name=str(p.name,30);profile.ready=p.ready===true;
    profile.examDate=date(p.examDate).slice(0,10);profile.learnedIds=kpIds(p.learnedIds);profile.unlearnedIds=kpIds(p.unlearnedIds);
    const examsRaw=Array.isArray(raw.exams)?raw.exams:Object.entries(raw.exams||{}).map(([id,e])=>({...e,id:e?.id||id}));
    const exams=examsRaw.map((e,i)=>{
      if(!e||typeof e!=='object'||!Array.isArray(e.questions))throw new Error('考试必须含 questions 数组');
      return {id:str(e.id,200)||'exam-'+i,name:str(e.name||e.title,200)||'导入考试',date:date(e.date),photos:ids(e.photos),partial:e.partial===true,importOriginalName:str(e.importOriginalName,200),origin:str(e.origin,100),createdAt:Number(e.createdAt)||Date.parse(e.date)||0,questions:e.questions.map((q,j)=>{
        if(!q||typeof q!=='object'||Array.isArray(q))throw new Error('试题格式错误');
        const old=Array.isArray(q.kp)?q.kp:typeof q.kp==='string'?q.kp.split(/[、,;；]/):[];
        const mapped=kpIds(q.kpIds||old);
        return {id:str(q.id,200)||'exam-'+i+'-q-'+j,num:str(q.num,30)||String(j+1),text:str(q.text||q.content),answer:str(q.answer),studentAnswer:str(q.studentAnswer),correct:typeof q.correct==='boolean'?q.correct:null,certainty:certainty(q.certainty),kpIds:mapped.length?mapped:['unclassified'],process:str(q.process),source:str(q.source,500),photoIds:ids(q.photoIds),legacyKp:str(q.legacyKp,2000),explanation:str(q.explanation,12000)};
      })};
    });
    const diagnoses=arr(raw.diagnoses).filter(d=>d&&typeof d==='object').map((d,i)=>({id:str(d.id,200)||'diagnosis-'+i,kpId:kpIds([d.kpId])[0]||'',questionIds:ids(d.questionIds),cause:Object.hasOwn(causes,d.cause)?d.cause:'unknown',label:str(d.label,500),confidence:d.confidence==='supported'?'supported':'preliminary',evidence:arr(d.evidence).slice(0,30).map(v=>str(v,3000)),createdAt:date(d.createdAt)})).filter(d=>d.kpId);
    const reviews=arr(raw.reviews).filter(r=>r&&typeof r==='object').map((r,i)=>({id:str(r.id,200)||'review-'+i,kpId:kpIds([r.kpId])[0]||'',date:date(r.date),passed:typeof r.passed==='boolean'?r.passed:null,source:['external','content-pack','system-pack'].includes(r.source)?r.source:'generated',itemIds:ids(r.itemIds),evidence:str(r.evidence),certainty:certainty(r.certainty),scope:['atomic','module-basic'].includes(r.scope)?r.scope:'practice',audit:cleanAudit(r.audit),familyId:str(r.familyId,200),transferConfirmed:r.transferConfirmed===true})).filter(r=>r.kpId&&r.date);
    const tasks=arr(raw.tasks).filter(t=>t&&typeof t==='object').map((t,i)=>({id:str(t.id,200)||'task-'+i,kpId:kpIds([t.kpId])[0]||'',title:str(t.title,500),minutes:Math.max(0,Math.min(180,Number(t.minutes)||0)),reason:str(t.reason,1000),material:str(t.material),completion:str(t.completion),kind:t.kind==='review'?'review':'study',completed:t.completed===true}));
    for(const d of diagnoses){const original=arr(raw.diagnoses).find(x=>x?.id===d.id)||{};d.examId=str(original.examId,200);d.reason=Object.hasOwn(causes,original.reason)?original.reason:'unknown';d.detail=str(original.detail,3000);d.aiNote=str(original.aiNote,6000);d.prerequisiteHint=str(original.prerequisiteHint,3000);d.probeEvidence=original.probeEvidence&&typeof original.probeEvidence==='object'?{kpId:d.kpId,assessmentKpId:str(original.probeEvidence.assessmentKpId,200),scope:original.probeEvidence.scope==='atomic'?'atomic':'practice',source:['external','content-pack','system-pack'].includes(original.probeEvidence.source)?original.probeEvidence.source:'generated',audit:cleanAudit(original.probeEvidence.audit),itemIds:ids(original.probeEvidence.itemIds),questionText:str(original.probeEvidence.questionText,6000),referenceAnswer:str(original.probeEvidence.referenceAnswer,1000),familyId:str(original.probeEvidence.familyId,200),verification:original.probeEvidence.verification,date:date(original.probeEvidence.date),grading:original.probeEvidence.grading,attemptId:str(original.probeEvidence.attemptId,200)}:null;if(!evidenceEligible(d.probeEvidence))d.confidence='preliminary';if(original.probe&&typeof original.probe==='object')d.probe={id:str(original.probe.id,200),answer:str(original.probe.answer,1000),correct:typeof original.probe.correct==='boolean'?original.probe.correct:null};}
    for(const r of reviews){const original=arr(raw.reviews).find(x=>x?.id===r.id)||{};r.grading=original.grading;r.attemptId=str(original.attemptId,200);r.photoIds=ids(original.photoIds);r.questionText=str(original.questionText,6000);r.assessmentKpId=str(original.assessmentKpId,200);r.referenceAnswer=str(original.referenceAnswer,1000);if(original.verification&&typeof original.verification==='object')r.verification=JSON.parse(JSON.stringify(original.verification));}
    let draft=null;
    if(raw.draft&&typeof raw.draft==='object'&&Array.isArray(raw.draft.questions)){
      const d=raw.draft, cleaned=migrate({exams:[d]},knowledge).exams[0];draft={...cleaned,date:cleaned.date.slice(0,10),raw:str(d.raw,100000),answerRaw:str(d.answerRaw,30000)};
    }
    return {version:2,profile,exams,diagnoses,reviews,tasks,draft,studiedItemIds:ids(raw.studiedItemIds),exposures:arr(raw.exposures).map(x=>({id:str(x.id,200),questionText:str(x.questionText,6000),fingerprint:str(x.fingerprint),shownAt:date(x.shownAt),answerAt:date(x.answerAt),attemptId:str(x.attemptId,200)})),minutes:Math.max(5,Math.min(120,Number(raw.minutes)||20)),taskLog:arr(raw.taskLog).filter(x=>x&&typeof x==='object').map(x=>({id:str(x.id,200),date:date(x.date).slice(0,10)}))};
  }
  return {currentState,evidenceView,questionKey,validateBackup,sameQuestion,evidenceEligible,cleanAudit,diagnose,groupQuestions,mastery,abilityProfile,plan,makeProbe,checkAnswer,migrate};
});
