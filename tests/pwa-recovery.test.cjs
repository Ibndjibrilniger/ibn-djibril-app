const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/pwa-update.js'),'utf8');

for(const stalled of [false,true]){
  test(`manual PWA recovery navigates once with ${stalled?'stalled':'normal'} cleanup and preserves other scopes`,async()=>{
    const events={},nodes=new Map(),timers=new Map(),deleted=[],navigations=[];
    const storage=new Map([['ibn_pwa_app_version','old'],['cart','existing-cart']]);
    const button={disabled:false,textContent:''};
    nodes.set('ibn-pwa-update-btn',button);
    let unblock,ownUnregisters=0,otherUnregisters=0;
    const root={
      scope:'https://example.test/',
      update:async()=>{},
      unregister:()=>{ownUnregisters++;return stalled?new Promise(r=>{unblock=r;}):Promise.resolve(true);}
    };
    vm.runInNewContext(source,{
      navigator:{serviceWorker:{
        controller:null,addEventListener(){},
        register:async()=>root,
        getRegistrations:async()=>[root,{
          scope:'https://example.test/other-app/',
          unregister:async()=>{otherUnregisters++;}
        }]
      }},
      window:{
        caches:{},
        addEventListener:(name,handler)=>{events[name]=handler;},
        location:{
          href:'https://example.test/?keep=1#catalogue',
          replace:url=>navigations.push(url),reload:()=>assert.fail('unexpected plain reload')
        }
      },
      document:{
        addEventListener(){},
        getElementById:id=>nodes.get(id),
        createElement:()=>({}),
        body:{appendChild:node=>nodes.set(node.id,node)}
      },
      localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
      sessionStorage:{getItem:()=>null},
      caches:{keys:async()=>['ibn-djibril-old','other-app-cache'],delete:async name=>deleted.push(name)},
      fetch:async()=>({ok:true,json:async()=>({version:'new'})}),
      setInterval(){},
      setTimeout:fn=>{const id=timers.size+1;timers.set(id,fn);return id;},
      clearTimeout:id=>timers.delete(id),
      URL,console
    });
    await events.load();
    const action=button.onclick({currentTarget:button});
    if(stalled){
      await new Promise(setImmediate);
      assert.equal(typeof unblock,'function');
      timers.values().next().value();
      unblock(true);
    }
    await action;
    assert.equal(navigations.length,1);
    assert.equal(ownUnregisters,1);
    assert.equal(otherUnregisters,0);
    assert.deepEqual(deleted,['ibn-djibril-old']);
    assert.equal(storage.get('cart'),'existing-cart');
    assert.equal(storage.get('ibn_pwa_app_version'),'new');
    assert.equal(timers.size,0);
    const url=new URL(navigations[0]);
    assert.equal(url.searchParams.get('keep'),'1');
    assert.ok(url.searchParams.has('update'));
    assert.equal(url.hash,'#catalogue');
  });
}
