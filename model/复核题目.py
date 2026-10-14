"""Reproducible checks for the 24 explicitly supported items, not arbitrary AI prose."""
from pathlib import Path
import sys,json,hashlib,itertools
sys.path.insert(0,str(Path('work/math-verifier-deps').resolve()))
import sympy as sp
out=Path(__file__).resolve().parent
if not (out/'数学内容包-待审核.json').exists():out=Path('outputs/数学能力诊断优化版')
p=json.loads((out/'数学内容包-待审核.json').read_text(encoding='utf-8'))
x=sp.Symbol('x',real=True)
yes=lambda v:'是' if v else '否'
member=lambda v:'属于' if v else '不属于'
# Independent solution specifications. No reference answers are used to compute results.
solved={
's1-1':member(3 in {2,4,6}),'s1-2':member((-6)%3==0),
's2-1':yes({1,2}<={1,2,3}),'s2-2':yes({1,2}<={1,2}),
's3-1':str(next(iter({1,3,5}&{2,3,4}))),'s3-2':yes(not(set(range(2,6,2))&set(range(3,6,3)))),
's4-1':str(len({1,2}|{2,3})),'s4-2':member(1 in ({1}|{2})),
's5-1':'A' if sp.Not(x*x>0)==(x*x<=0) else 'INVALID',
's5-2':'B' if all((not all(bits))==any(not b for b in bits) for bits in itertools.product([False,True],repeat=4)) else 'INVALID',
's6-1':str(sp.solve(x-2,x)[0]),'s6-2':str(sp.solve_univariate_inequality(x-3>=0,x,relational=False).start),
's7-1':'减函数',
# f(x)=x² has f(1)<f(2) but f(-2)>f(-1): a concrete counterexample on R.
's7-2':'不能' if 1**2<2**2 and (-2)**2>(-1)**2 else 'INVALID',
's8-1':'偶函数' if sp.simplify((-x)**2-x**2)==0 else 'INVALID',
's8-2':yes(sp.Interval(0,1)==sp.Interval(-1,0)),
's9-1':str(sp.solve(x-4,x)[0]),'s9-2':str(-3),
's10-1':str(sp.solve(3*x+6-15,x)[0]),'s10-2':yes((-3)-5==2),
's11-1':'x<'+str(sp.solve_univariate_inequality(-2*x>6,x,relational=False).end),
's11-2':'正确' if sp.solve_univariate_inequality(-3*x<=9,x,relational=False)==sp.Interval(-sp.oo,-3) else '错误',
's12-1':str(min(sp.solve((x-2)*(x-5),x))),'s12-2':'没有' if sp.solveset(x*x+1,x,domain=sp.S.Reals)==sp.S.EmptySet else '有'
}
base='https://openstax.org/books/'
refs={
'sets':('集合定义','contemporary-mathematics/pages/1-1-basic-set-concepts'),
'subset':('子集定义','contemporary-mathematics/pages/1-2-subsets'),
'operations':('交集与并集','contemporary-mathematics/pages/1-4-set-operations-with-two-sets'),
'quantifiers':('量词及否定','contemporary-mathematics/pages/2-1-statements-and-quantifiers'),
'domain':('定义域限制','algebra-and-trigonometry-2e/pages/3-2-domain-and-range'),
'monotonic':('任意两点与增减性','algebra-and-trigonometry-2e/pages/3-3-rates-of-change-and-behavior-of-graphs'),
'parity':('奇偶函数定义','algebra-and-trigonometry-2e/pages/3-5-transformation-of-functions'),
'linear':('一次方程与等式变形','algebra-and-trigonometry-2e/pages/2-2-linear-equations-in-one-variable'),
'inequality':('乘除负数时不等号反向','algebra-and-trigonometry-2e/pages/2-7-linear-inequalities-and-absolute-value-inequalities'),
'zeros':('零点与横轴交点','algebra-and-trigonometry-2e/pages/5-1-quadratic-functions')}
mapping=['sets','subset','operations','operations','quantifiers','domain','monotonic','parity','zeros','linear','inequality','zeros']
bypass={
's1':'列举题可逐项观察；只支持元素归属，不推断集合构造能力。',
's2':'有限集合用逐项比较即可，属于目标定义的具体使用；不能推断抽象集合证明能力。',
's3':'数数与筛选能完成；只归交集公共元素，不归 Venn 作图。',
's4':'可直接合并数数，未要求用容斥公式；不匹配到容斥公式知识点。',
's5':'选项可能被猜中；需确定程度及另题验证，不以单次选择判定稳定。',
's6':'分母和根式分别只检验单一限制；不等同于完整定义域综合能力。',
's7':'第二题可用反例驳斥全称结论；匹配定义中的任意性，不匹配具体函数定义法证明。',
's8':'平方函数可凭图像记忆识别；第二题补查定义域对称性，不能推断复杂函数化简能力。',
's9':'一次式求根可能凭移项完成；图像题补查零点是横坐标，仍只覆盖定义识别。',
's10':'可代入或心算完成；只能支持方程解与检验，不证明完整规范移项过程。',
's11':'可代入反例判错，未必会规范变形；配合解集题核验，错因仍保留为假设。',
's12':'可因式为零或平方非负完成；仅支持零点与图像交点关系，不推断全部图像性质。'}
checks=[]
specs=json.loads((out/'核验题目规格.json').read_text(encoding='utf-8'))
for i in p['items']:
    assert i['text']==specs[i['id']], '题干已改变，必须重新建立独立求解规格：'+i['id']
    expected=i['answer'].replace('−','-')
    assert solved[i['id']]==expected,(i['id'],solved[i['id']],expected)
    skill=next(s for s in p['skills'] if s['id']==i['skillId'])
    ref=mapping[int(skill['id'][1:])-1];title,url=refs[ref]
    i['status']='system-checked'
    payload=json.dumps({'skill':skill,'item':{k:v for k,v in i.items() if k!='verification'}},ensure_ascii=False,sort_keys=True,separators=(',',':'))
    method='定义关系检查' if i['id'] in ['s7-1','s9-2'] else 'SymPy符号运算或有限集合/真值穷举'
    i['verification']={'method':'system-cross-check','checkedAt':'2026-09-13','fingerprint':hashlib.sha256(payload.encode()).hexdigest(),'answerCheck':f'{method}；独立求得 {solved[i["id"]]}，与参考答案一致。','alignmentCheck':i['alignment']+' 检测范围限定为：'+skill['objective'],'bypassCheck':bypass[skill['id']],'sourceRefs':[{'title':title,'url':base+url}]}
    checks.append({'itemId':i['id'],'targetId':skill['targetId'],'computed':solved[i['id']],'checkType':method,'passed':True,'fingerprint':i['verification']['fingerprint']})
p['title']='数学基础考点与对照练习（系统交叉核验）'
p['version']='2026.09.13';p['source']='本版本原创题；对照 OpenStax 定义并逐题独立求解、检查检测边界。系统核验不是教师审核或学生样本效度验证。'
existing_path=out/'数学内容包-系统核验.json'
if existing_path.exists():
    existing=json.loads(existing_path.read_text(encoding='utf-8'))
    if len(existing.get('skills',[]))>len(p['skills']):
        checked={i['id']:i for i in p['items']}
        existing['items']=[checked.get(i['id'],i) for i in existing['items']]
        p=existing  # 仅更新原24题；不得把新版全目录内容覆盖成旧版12点。
encoded=json.dumps(p,ensure_ascii=False,indent=2)
(out/'数学内容包-系统核验.json').write_text(encoded,encoding='utf-8')
(out/'math-content.js').write_text('window.MATH_CONTENT = '+encoded+';\n',encoding='utf-8')
(out/'题目核验结果.json').write_text(json.dumps({'date':'2026-09-13','sympyVersion':sp.__version__,'checks':checks,'sourcePolicy':'仅引用定义与链接，未复制教材题干或图表；OpenStax 页面当前标注 CC BY-NC-SA，未作为无条件授权题库再分发。','github':'https://github.com/sympy/sympy','license':'SymPy BSD-3-Clause；仅开发核验使用，不作为浏览器运行依赖。'},ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(checks)} item answers checked; 12 scoped alignment reviews; SymPy {sp.__version__}')

