"""只检查目录覆盖及复审记录完整性，不把结构通过冒称数学证明。"""
import hashlib
import json
from pathlib import Path

root=Path(__file__).resolve().parent
def read(name):return json.loads((root/name).read_text(encoding='utf-8'))
text=(root/'knowledge.js').read_text(encoding='utf-8')
catalog=json.loads(text[text.index('['):].strip().removesuffix(';'))
pack=read('数学内容包-系统核验.json')
records=read('全知识点核验清单.json')['records']
source=read('核验材料/batch-1.json')+read('核验材料/batch-2.json')+read('核验材料/batch-3.json')
reviews=read('核验材料/review-1.json')+read('核验材料/review-2.json')+read('核验材料/review-3.json')
assert len(catalog)==len(source)==len(records)==len(reviews)==419
assert {k['id'] for k in catalog}=={r['targetId'] for r in source}
assert len({r['targetId'] for r in source})==419
for r in source:
    target=r['targetId']
    fingerprint=hashlib.sha256(json.dumps(r,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    review=next(x for x in reviews if x['targetId']==target)
    assert review['verdict']=='pass' and review['fingerprint']==fingerprint,target
    item=next(i for i in pack['items'] if i['id']=='full-'+target.lower())
    assert item['verification']['fingerprint']==fingerprint,target
    assert all(item[f]==r[f] for f in ['text','answer','steps','alignment','contrast']),target
    assert all(item['assessment'][f]==r[f] for f in ['objective','boundary','prerequisiteSkills']),target
    skill=next(s for s in pack['skills'] if s['id']==item['skillId'])
    assert skill['targetId']==target and skill['name']==r['name'],target
for id,text in read('核验题目规格.json').items():
    assert next(i for i in pack['items'] if i['id']==id)['text']==text,id
assert len(pack['items'])==443
print('PASS: 419 exact catalogue targets, 419 unchanged review records, 443 items, original 24 stems retained.')
print('This is an integrity check. Mathematical recomputation results are supplied separately.')

