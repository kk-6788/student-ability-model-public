/* 研究来源与编辑推导分开；复习建议不参与掌握评分，不表示未来命中率。 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ExamFocus=factory();})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const sources=[
    {id:'math-2024',year:2024,title:'2024年高考数学全国卷试题评析',publisher:'教育部教育考试院（河南高考信息网转载）',url:'https://gaokao.haedu.cn/lnzt/2024/0608/135002.html',scope:'数学全国卷；非安徽逐题频次表',summary:'关注基础理解和思维过程，增加探究空间。'},
    {id:'math-2025',year:2025,title:'2025年高考数学全国卷试题评析',publisher:'中国教育报微信公众号（新华网转载）',url:'https://www.xinhuanet.com/edu/20250607/8c18a78606ae43e1affc28552a08154c/c.html',scope:'数学全国卷；跨模块联系与核心内容',summary:'基础概念与主线内容兼顾，要求在情境中综合运用知识。'},
    {id:'math-2026',year:2026,title:'2026年高考数学全国卷试题评析',publisher:'教育部教育考试院（中山日报转载）',url:'https://zsrbapp.zsnews.cn/home/content/newsContent/0/727125',scope:'数学全国卷；考后评析',summary:'从基本原理出发，重视多路径探究、严谨论证和现场思考。'},
    {id:'physics-anhui-2425',year:2026,title:'物理：把握基础，加强“一题多解”训练',publisher:'安庆晚报，安庆一中教师周运访谈，2026-04-28',url:'https://aqdzb.aqnews.com.cn/epaper/read.do?eid=153389&idate=2_2026-04-28_A04&iid=12887&m=i&sid=712477',scope:'教师回顾2024—2025安徽物理；非官方考点统计，未作为2026考后证据',summary:'训练情境建模、跨模块过程分析和实验探究。本文仅取可用的教学方向，不采纳难度预测或固定题型断言。'}
  ];
  const math=[
    ['m-foundation','基础概念与逻辑','集合|逻辑|不等式','明确集合范围、量词及等价变形条件，用反例检查结论；把实际限制写成不等式。','忽略定义域；必要与充分混淆；等号条件缺失。'],
    ['m-function','函数与导数','函数|导数','先核对定义域，再联合图像、单调性、零点与参数分类解释结论；保留关键推理过程。','仅报答案；把局部性质推广到全域；遗漏参数边界。'],
    ['m-trig','三角函数与解三角形','三角','从图形或周期情境提取条件，选择恒等式或正余弦定理，并检验角的取值范围。','角度与弧度混用；漏解；面积和边角关系缺少条件。'],
    ['m-vector','向量与复数','向量|复数','说明代数运算对应的几何意义；比较坐标法和几何法，解释采用该方法的理由。','模与数量积混淆；忽略方向；只套坐标公式。'],
    ['m-solid','立体几何','立体几何|空间','先写线面位置关系的证明依据，再选择几何法或空间向量法计算角度与距离。','把图中看似垂直当成条件；向量夹角与所求角混淆。'],
    ['m-conic','直线、圆与圆锥曲线','直线|圆|圆锥','从定义建立方程，比较几何关系与代数联立两条路径，检查交点存在和参数范围。','忽略斜率不存在；无实交点仍计算；未检查增根。'],
    ['m-sequence','数列与递推探索','数列','从前几项提出猜想，再用递推或等差等比结构论证；核对首项和求和范围。','由少量样本直接宣称通项；遗漏首项或特殊情形。'],
    ['m-data','概率、统计与计数','概率|统计|随机|计数|排列|组合','先定义事件和抽样模型，区分独立性与互斥性；解释统计量、分布及现实含义。','只给数值不说明模型；条件概率样本空间错误；相关等同因果。']
  ].map(([id,title,pattern,practice,pitfalls])=>({id,title,pattern,practice,pitfalls,sourceIds:['math-2024','math-2025','math-2026']}));
  const physics=[
    ['p-motion','运动与相互作用','运动的描述|匀变速直线运动|相互作用|牛顿运动定律|运动和力的关系|抛体运动|圆周运动|万有引力','画受力图，分阶段确定运动规律；联合图像、方向和单位核验结果。','运动方向等同加速度方向；对象和过程混淆；漏受力。'],
    ['p-conservation','能量与动量','机械能|动量','先选研究系统和过程，核对守恒或定理适用条件，再分阶段列式并连接边界状态。','有碰撞就认为机械能守恒；冲量只看大小；系统选取不清。'],
    ['p-field','电场、磁场与电磁感应','静电场|安培力|洛伦兹力|电磁感应','把情境转成场与运动模型，区分力、电势能和电势变化；用方向判定与能量核对相互检验。','电场线与等势面混淆；磁力做功判断错误；感应方向只背口诀。'],
    ['p-circuit','电路、交流电与传感器','电路|电能|交变电流|传感器','标出电路结构与电表连接，分析总量和局部量的变化，检查能量转化及器件适用条件。','端电压等于电动势；有效值与峰值混用；错误使用理想变压器条件。'],
    ['p-wave','振动、波与光','振动|机械波|光$|电磁振荡|电磁波','分清质点振动与传播，结合图像和时间变化判方向；说明干涉、衍射等现象的条件。','振动图像当成波形；传播速度当成质点速度；忽略光路和条件。'],
    ['p-thermal','热学与能量转换','分子动理论|气体|固体|液体|热力学','区分微观解释与宏观状态量，画过程图，结合气体规律和热力学第一定律核对符号。','温度不换算；内能等同热量；混用功和热量的正负约定。'],
    ['p-modern','原子物理与物质结构','原子结构|波粒二象性|原子核','依据实验现象说明模型适用范围，用能量与守恒量解释跃迁、光电效应和核反应。','光强与频率作用混淆；单个原子衰变按半衰期机械计算。']
  ].map(([id,title,pattern,practice,pitfalls])=>({id,title,pattern,practice,pitfalls,sourceIds:['physics-anhui-2425']}));
  const experiment={id:'p-experiment',title:'实验探究与数据处理',practice:'写出测量原理、控制变量、仪器读数与数据处理方法；分析误差方向，说明改进方案及证据。',pitfalls:'只记实验结论；图像坐标和单位缺失；用重复测量掩盖系统误差。',sourceIds:['physics-anhui-2425']};
  const bridge={id:'m-bridge',title:'初中基础回溯',practice:'用一道基础题定位运算或概念障碍，再回到关联的高中任务。',pitfalls:'基础回溯节点不能当作高中综合能力证据。',sourceIds:[]};
  function groups(subject){return subject==='physics'?[...physics,experiment]:[...math,bridge];}
  function forPoint(k,subject='math'){
    if(subject==='math'&&k.id.startsWith('J-'))return [bridge];
    const text=k.chapter||k.name;
    let matches=(subject==='physics'?physics:math).filter(g=>new RegExp(g.pattern).test(text));
    // 空间向量归入立体几何；三角函数归三角专题，避免普通函数标签覆盖。
    if(subject==='math'&&/三角/.test(text))matches=matches.filter(g=>g.id!=='m-function');
    if(subject==='math'&&/空间/.test(text))matches=matches.filter(g=>g.id!=='m-vector');
    if(subject==='physics'&&/实验|测量|测定|误差|传感器/.test(k.section+' '+k.name))matches=[...matches,experiment];
    return matches;
  }
  function attach(knowledge,subject){return knowledge.map(k=>({...k,examFocus:forPoint(k,subject)}));}
  return {sources,groups,forPoint,attach,checkedAt:'2026-09-26'};
});
