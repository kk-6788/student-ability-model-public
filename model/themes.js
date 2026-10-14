(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else {root.Themes=factory(root);root.Themes.init();}
})(typeof window!=='undefined'?window:globalThis,function(host){
  'use strict';
  const key='zhiyin.appearance.v1';
  const tokens=['surface','ink','muted','accent','emphasis','note','bg','soft','line','path','hover'];
  const rows=[
    ['sage','灰绿','#e4ebe5','#283f36','#52685b','#344f41','#687e70','#f2e8d5','#f3f5f2','#edf2ee','#d8e1d9','#8a9d8e','#263e31'],
    ['mist','雾蓝','#e6edf3','#293e50','#536b7e','#3d5d76','#627d92','#eee9de','#f4f6f8','#eef3f7','#d7e1e8','#8c9fad','#2c485e'],
    ['lilac','浅藤','#eee8f1','#42374e','#6d5e79','#69527c','#887495','#eee8dd','#f7f5f8','#f1edf5','#e2dae8','#a091ac','#51405f'],
    ['rose','藕粉','#f2e7e7','#533b40','#805e64','#865e67','#96717a','#f1e9db','#f9f5f4','#f6eeee','#e7d9db','#b3979e','#6b4750'],
    ['sand','沙杏','#f0eadd','#4f4434','#776852','#7a674b','#8d795d','#e3e9df','#f8f6f1','#f4f0e7','#e4dece','#ad9e86','#5e4e37'],
    ['slate','石墨','#e8ebed','#343e46','#5a6670','#536775','#71828d','#eee8dc','#f5f6f6','#eff2f4','#d9e0e4','#9aa7b0','#3d505d']
  ];
  const options=rows.map(([id,name,...values])=>Object.freeze({id,name,...Object.fromEntries(tokens.map((t,i)=>[t,values[i]]))}));
  let selected='sage';
  const resolve=id=>options.find(t=>t.id===id)||options[0];
  function apply(id,persist=false){
    const theme=resolve(id);selected=theme.id;
    if(host?.document){
      const el=host.document.documentElement;el.dataset.theme=theme.id;
      for(const token of tokens)el.style.setProperty('--theme-'+token,theme[token]);
      host.document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.accent);
    }
    if(persist&&host){try{host.localStorage.setItem(key,theme.id);}catch(_){return false;}}
    return true;
  }
  function init(){let saved='sage';try{saved=host?.localStorage.getItem(key)||'sage';}catch(_){}apply(saved);}
  return {key,options:Object.freeze(options),resolve,apply,init,current:()=>selected};
});
