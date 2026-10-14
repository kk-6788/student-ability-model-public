const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/sw.js','utf8');
function harness(failure){
 const lifecycle={},stores=new Map([['mdiag-v-old',new Map([['old','complete']])]]);let network=0,skipped=false;
 const caches={keys:async()=>[...stores.keys()],delete:async k=>stores.delete(k),open:async k=>{if(!stores.has(k))stores.set(k,new Map());const data=stores.get(k);return{put:async(k,v)=>data.set(String(k),v),match:async k=>data.get(String(k))}}};
 const ctx={URL,Set,Response,Promise,caches,fetch:async url=>{network++;if(String(url).endsWith(failure||'NEVER'))throw Error('offline');return{ok:true,version:'new',clone(){return this}}},self:{location:{href:'http://localhost/sw.js'},addEventListener:(type,fn)=>lifecycle[type]=fn,skipWaiting:async()=>{skipped=true},clients:{claim:async()=>{}}}};
 vm.runInNewContext(source+'\nself.test={SHELL,VERSION};',ctx);
 for(const file of ctx.self.test.SHELL)stores.get('mdiag-v-old').set('http://localhost/'+file,{ok:true});
 const run=async type=>{let p;lifecycle[type]({waitUntil:x=>p=x});await p};return{ctx,run,stores,get skipped(){return skipped},get network(){return network},lifecycle};
}
test('R8: every core-file failure rejects install and retains complete predecessor',async()=>{
 for(const file of harness().ctx.self.test.SHELL){const h=harness(file);await assert.rejects(h.run('install'));assert.ok(h.stores.has('mdiag-v-old'));assert.equal(h.stores.has(h.ctx.self.test.VERSION),false);assert.equal(h.skipped,false);}
});
test('R8: complete core activates without OCR and serves immutable shell offline',async()=>{
 const h=harness();h.stores.set('mdiag-v-empty-status-cache',new Map());await h.run('install');await h.run('activate');assert.ok(h.stores.has('mdiag-v-old'));assert.equal(h.stores.has('mdiag-v-empty-status-cache'),false);assert.equal(h.skipped,false);let promise;const before=h.network;
 h.lifecycle.fetch({request:{url:'http://localhost/model.js',method:'GET',headers:new Headers()},respondWith:p=>promise=p});assert.equal((await promise).version,'new');assert.equal(h.network,before);
});
