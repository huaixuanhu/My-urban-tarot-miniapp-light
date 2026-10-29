import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandomClient, createRandomSession, validateRandomDeck, RANDOM_MODE_KEY, RANDOM_OPERATION_KEY } from '../client/src/reading-random-data.mjs';

const id = '10000000-0000-4000-8000-000000000001';
const batch = '20000000-0000-4000-8000-000000000001';
const fetchedAt = '2026-10-29T01:00:00.000Z';
const pool = {batchId:batch,fetchedAt,total:1024,remaining:869,collecting:false};
const deck = () => ({order:Array.from({length:78},(_,i)=>i),reversed:Array(78).fill(false),randomness:{source:'anu',requestId:id,batchId:batch,fetchedAt,consumed:155}});
const result = (action='draw',status='completed') => ({pool,operation:{id,action,status,...(action==='draw'&&status==='completed'?{deck:deck()}:{}),...(status==='failed'?{message:'库存不足'}:{})}});
const storage = () => {const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
const deferred = () => {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};

test('construction, preference changes and metadata reads never mutate pool or call provider', async()=>{
 const calls=[];const preferences=storage(); const session=createRandomSession({storage:preferences,newId:()=>id,client:{metadata:async()=>{calls.push('metadata');return {pool}},run:async()=>{throw Error('forbidden')}}});
 assert.equal(session.state.mode,'quantum');assert.deepEqual(calls,[]);
 session.setMode('local');assert.equal(preferences.getItem(RANDOM_MODE_KEY),'local');
 await session.refresh();assert.deepEqual(calls,['metadata']);assert.equal(session.state.pool.remaining,869);
 assert.equal(createRandomSession({storage:preferences}).state.mode,'local');
});

test('ordinary mode creates a full local deck without touching quantum requests', async()=>{
 const session=createRandomSession({newId:()=>id,localDeck:()=>({...deck(),consumed:155}),client:{run:()=>{throw Error('forbidden')}}});
 session.setMode('local'); const local=await session.prepareDeck();assert.deepEqual(local.randomness,{source:'local'});assert.equal(local.order.length,78);assert.equal(session.state.pool,null);
});

test('two rapid draws make one POST; switching next mode does not change in-flight deck provenance',async()=>{
 const gate=deferred();let calls=0;const session=createRandomSession({newId:()=>id,client:{run:async()=>{calls++;return gate.promise}}});
 const first=session.prepareDeck();await assert.rejects(session.prepareDeck(),/正在处理/);session.setMode('local');gate.resolve(result());
 const resolved=await first;assert.equal(calls,1);assert.equal(resolved.randomness.source,'anu');assert.equal(session.state.mode,'local');assert.equal(session.state.pending,null);
});

test('unknown draw is persisted; recovery is GET only; recovered deck consumed once without another POST',async()=>{
 const handles=storage();let posts=0,gets=0;const client={run:async()=>{posts++;throw Error('network')},operation:async lookup=>{gets++;assert.equal(lookup,id);return result()}};
 const session=createRandomSession({operationStorage:handles,client,newId:()=>id});await assert.rejects(session.prepareDeck());
 assert.equal(JSON.parse(handles.getItem(RANDOM_OPERATION_KEY)).id,id);
 await assert.rejects(session.prepareDeck(),/先查询/);assert.equal(posts,1);
 const resumed=createRandomSession({operationStorage:handles,client,newId:()=>id});await resumed.recover();assert.equal(gets,1);assert.equal(resumed.state.prepared,true);
 const recovered=await resumed.prepareDeck();assert.deepEqual(recovered,deck());assert.equal(posts,1);assert.equal(handles.getItem(RANDOM_OPERATION_KEY),null);
});

test('failed collect keeps prior metadata and leaves current round independent',async()=>{
 const session=createRandomSession({newId:()=>id,client:{metadata:async()=>({pool}),run:async()=>result('collect','failed')}});
 await session.refresh();await assert.rejects(session.collect(),/库存不足/);assert.equal(session.state.pool.remaining,869);assert.equal(session.state.pool.fetchedAt,fetchedAt);assert.equal(session.state.pending,null);
});

test('a pending collection blocks another POST but still permits local demonstration',async()=>{
 let posts=0;const session=createRandomSession({newId:()=>id,client:{run:async()=>{posts++;return result('collect','pending')}},localDeck:deck});
 await assert.rejects(session.collect(),/尚未确认/);await assert.rejects(session.collect(),/先查询/);session.setMode('local');assert.equal((await session.prepareDeck()).randomness.source,'local');assert.equal(posts,1);assert.equal(session.state.pending.action,'collect');
});

test('late metadata response cannot restore a stale remaining count after allocation',async()=>{
 const gate=deferred();const session=createRandomSession({newId:()=>id,client:{metadata:()=>gate.promise,run:async()=>result()}});
 const refreshing=session.refresh();await session.prepareDeck();gate.resolve({pool:{...pool,remaining:1024}});await refreshing;assert.equal(session.state.pool.remaining,869);
});

test('late response after disposal never hands a deck to the closed table',async()=>{
 const gate=deferred();let publishes=0;const session=createRandomSession({newId:()=>id,client:{run:()=>gate.promise},onChange:()=>publishes++});const pending=session.prepareDeck();session.dispose();const before=publishes;gate.resolve(result());assert.equal(await pending,null);assert.equal(publishes,before);
});

test('invalid or mismatched result retains recovery handle instead of accepting a different deck',async()=>{
 const invalid=result();invalid.operation.deck.order[1]=0;const session=createRandomSession({newId:()=>id,client:{run:async()=>invalid}});await assert.rejects(session.prepareDeck(),/不完整/);assert.equal(session.state.pending.id,id);assert.equal(session.state.pending.status,'unknown');
 assert.throws(()=>validateRandomDeck({...deck(),randomness:{...deck().randomness,source:'local'}}));
});

test('GET 404 after uncertain POST does not clear uncertainty or authorize another POST',async()=>{
 let posts=0;
 const session=createRandomSession({newId:()=>id,client:{run:async()=>{posts++;throw Error('lost')},operation:async()=>{throw Object.assign(Error('not found'),{definite:true,status:404,code:'NOT_FOUND'})}}});await assert.rejects(session.prepareDeck());await assert.rejects(session.recover());assert.equal(session.state.pending.id,id);assert.equal(session.state.pending.canResume,true);await assert.rejects(session.prepareDeck(),/先查询/);assert.equal(posts,1);
});

test('transport uses same-origin private POST and never retries on invalid JSON',async()=>{
 const calls=[];const client=createRandomClient(async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>{throw Error('not JSON')}}});await assert.rejects(client.run('draw',id),/无法确认/);assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/random');assert.equal(calls[0].options.credentials,'same-origin');assert.equal(calls[0].options.cache,'no-store');assert.deepEqual(JSON.parse(calls[0].options.body),{action:'draw',id});
});


test('a definitive failed operation recovered with GET releases the handle',async()=>{
 const handles=storage();const session=createRandomSession({operationStorage:handles,newId:()=>id,client:{run:async()=>{throw Error('lost')},operation:async()=>result('draw','failed')}});
 await assert.rejects(session.prepareDeck());await assert.rejects(session.recover(),/库存不足/);
 assert.equal(session.state.pending,null);assert.equal(handles.getItem(RANDOM_OPERATION_KEY),null);
});

test('terminal unknown collection releases the fenced handle without automatically collecting again',async()=>{
 const handles=storage();let posts=0;
 const session=createRandomSession({operationStorage:handles,newId:()=>id,client:{run:async()=>{posts++;return result('collect','pending')},operation:async()=>({...result('collect','unknown'),operation:{id,action:'collect',status:'unknown',terminal:true,message:'采集未完成，旧库存已保留。'}})}});
 await assert.rejects(session.collect());await assert.rejects(session.recover(),/旧库存已保留/);
 assert.equal(posts,1);assert.equal(session.state.pending,null);assert.equal(handles.getItem(RANDOM_OPERATION_KEY),null);assert.equal(session.state.pool.remaining,869);
 await assert.rejects(session.collect());assert.equal(posts,2);
});

test('nonterminal unknown operation keeps its handle and cannot be resumed as a missing operation',async()=>{
 const session=createRandomSession({newId:()=>id,client:{run:async()=>result('draw','unknown')}});
 await assert.rejects(session.prepareDeck());await assert.rejects(session.resume(),/先查询/);assert.equal(session.state.pending.id,id);
});

test('explicit resume after missing-ID lookup reuses one ID and prepares a recovered deck without automatic table change',async()=>{
 const gate=deferred(),calls=[];let ids=0;
 const session=createRandomSession({newId:()=>{ids++;return id},client:{run:async(action,requestId)=>{calls.push({action,id:requestId});if(calls.length===1)throw Error('lost');return gate.promise},operation:async()=>{throw Object.assign(Error('missing'),{status:404,code:'NOT_FOUND'})}}});
 await assert.rejects(session.prepareDeck());await assert.rejects(session.resume(),/先查询/);await assert.rejects(session.recover());
 const resumed=session.resume();await assert.rejects(session.resume(),/正在处理/);session.setMode('local');gate.resolve(result());await resumed;
 assert.equal(ids,1);assert.deepEqual(calls,[{action:'draw',id},{action:'draw',id}]);assert.equal(session.state.prepared,true);assert.equal(session.state.mode,'local');
 session.setMode('quantum');assert.deepEqual(await session.prepareDeck(),deck());assert.equal(calls.length,2);assert.equal(session.state.prepared,false);
});

test('a generic access 404 does not authorize explicit same-ID resume',async()=>{
 const session=createRandomSession({newId:()=>id,client:{run:async()=>{throw Error('lost')},operation:async()=>{throw Object.assign(Error('access denied'),{status:404,code:'ACCESS_REQUIRED'})}}});
 await assert.rejects(session.prepareDeck());await assert.rejects(session.recover());assert.equal(session.state.pending.canResume,false);await assert.rejects(session.resume(),/先查询/);
});

test('unconfigured service refuses before claiming and clears the initial operation handle',async()=>{
 const handles=storage();let calls=0;
 const client=createRandomClient(async()=>{calls++;return {ok:false,status:503,json:async()=>({error:{code:'RANDOM_NOT_CONFIGURED',message:'尚未配置随机服务'}})}});
 const session=createRandomSession({operationStorage:handles,newId:()=>id,client});await assert.rejects(session.prepareDeck(),/尚未配置/);
 assert.equal(calls,1);assert.equal(session.state.pending,null);assert.equal(handles.getItem(RANDOM_OPERATION_KEY),null);
});
