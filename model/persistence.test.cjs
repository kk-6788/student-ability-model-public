const test=require('node:test'),assert=require('node:assert/strict');

// STU-02 回归测试：读取失败后不得用空默认数据覆盖原记录；save 失败必须返回 false 且调用方可感知。
// 用大括号配对从真实 app.js 源码提取 read/save 函数，在隔离 storage 上执行验证。

const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');

// 大括号配对提取完整函数体
function extractFn(name){
  const start=src.indexOf(`function ${name}(`);
  if(start<0)throw new Error(`function ${name} not found`);
  let i=src.indexOf('{',start),depth=0;
  for(let j=i;j<src.length;j++){
    if(src[j]==='{')depth++;
    else if(src[j]==='}'){depth--;if(depth===0){i=j;break;}}
  }
  return src.slice(start,i+1);
}
const readSrc=extractFn('read');
const saveSrc=extractFn('save');

function makeStorage(){
  let thrown=false;
  return {
    _d:{},
    getItem(k){if(thrown)throw new Error('quota');return this._d[k]??null;},
    setItem(k,v){if(thrown)throw new Error('quota');this._d[k]=String(v);},
    removeItem(k){if(thrown)throw new Error('quota');delete this._d[k];},
    exhaust(){thrown=true;},
  };
}

test('STU-02: 损坏 JSON 读取失败时原始字节被保留到 corrupted-backup',()=>{
  const store=makeStorage();
  const broken='{"broken json!!';
  store.setItem('store',broken);
  const fn=new Function('localStorage',`let storageError='';${readSrc}return read;`);
  const read=fn(store);
  const out=read('store',{empty:true});
  assert.ok(out.empty===true,'read 应返回 fallback');
  assert.equal(store.getItem('store'),broken,'原键原始内容必须保持不变');
  assert.equal(store.getItem('store.corrupted-backup'),broken,'原始字节必须有独立副本');
});

test('STU-02: save 写入抛错时返回 false 且不视为成功',()=>{
  const store=makeStorage();
  store.setItem('store','{"profile":{"name":"原数据"}}');
  store.exhaust();
  const fn=new Function('localStorage','data','draft','demo','DEMO','STORE','toast',`${saveSrc}return save;`);
  const save=fn(store,{profile:{name:'内存新数据'},draft:null},null,false,'demo','store',()=>{});
  assert.equal(save(),false,'配额满时 save 必须返回 false');
});

test('STU-02: save 正常写入返回 true',()=>{
  const store=makeStorage();
  const fn=new Function('localStorage','data','draft','demo','DEMO','STORE',`${saveSrc}return save;`);
  const data={profile:{name:'测试'},draft:null};
  const save=fn(store,data,null,false,'demo','store');
  assert.equal(save(),true);
  assert.equal(JSON.parse(store.getItem('store')).profile.name,'测试');
});

test('STU-02: confirm-restore 在恢复副本缺失时不得把内存记录替换为空默认',()=>{
  assert.match(src,/a==='confirm-restore'\)\{const restored=read\(\(demo\?DEMO:STORE\)\+'\.before-import',null\);if\(!restored\|\|!restored\.profile\)\{/,
    'confirm-restore 必须先验证恢复副本有效再覆盖内存数据');
  assert.match(src,/if\(!save\(\)\)\{data=previousData;draft=previousDraft;return;\}/,
    '恢复写入失败时必须回滚内存数据');
});

test('STU-02: profile-form 提交仅在 save 成功后提示成功',()=>{
  const flat=src.replace(/\s+/g,'');
  assert.match(flat,/profile-form.*?\}\;if\(save\(\)\)\{go\('today'\);toast\('档案已保存。'\);\}/,
    '成功提示必须包在 if(save()) 内');
});
