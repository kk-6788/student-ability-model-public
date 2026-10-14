const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const T=require('./themes.js');
function browser(saved,failRead=false,failWrite=false){
 const props={},meta={},dataset={},values=new Map([[T.key,saved]]);
 const host={document:{documentElement:{dataset,style:{setProperty:(k,v)=>props[k]=v}},querySelector:()=>({setAttribute:(k,v)=>meta[k]=v})},localStorage:{getItem(k){if(failRead)throw Error('blocked');return values.get(k);},setItem(k,v){if(failWrite)throw Error('quota');values.set(k,v);}}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/themes.js','utf8'),{window:host});return {host,props,meta,dataset,values};
}
test('theme initializes before app using a validated saved preference',()=>{const b=browser('lilac');assert.equal(b.dataset.theme,'lilac');assert.equal(b.props['--theme-surface'],T.resolve('lilac').surface);assert.equal(b.meta.content,T.resolve('lilac').accent);});
test('unknown or inaccessible preference falls back without breaking startup',()=>{for(const b of [browser('unexpected-css'),browser('rose',true)])assert.equal(b.dataset.theme,'sage');});
test('theme writes only appearance preference; applying never replaces learning data',()=>{const b=browser('sage');b.values.set('zhiyin.math.v2','personal');assert.equal(b.host.Themes.apply('rose',true),true);assert.equal(b.values.get('zhiyin.math.v2'),'personal');assert.equal(b.values.get(T.key),'rose');});
test('storage failure keeps current visual choice and reports it was not saved',()=>{const b=browser('sage',false,true);assert.equal(b.host.Themes.apply('mist',true),false);assert.equal(b.dataset.theme,'mist');assert.equal(b.values.get(T.key),'sage');});
function luminance(hex){return hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('six themes retain readable foregrounds and primary buttons',()=>{assert.equal(T.options.length,6);for(const t of T.options){for(const token of ['ink','muted'])assert.ok(contrast(t[token],t.surface)>=4.5,t.id+' '+token);assert.ok(contrast('#fffefa',t.accent)>=4.5,t.id+' primary');assert.ok(contrast(t.emphasis,t.surface)>=3,t.id+' large title');}});
