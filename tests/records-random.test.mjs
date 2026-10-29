import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { normalizeRecordInput } from '../shared/record-schema.mjs';
import { verifiedRandomProvenance, randomSourceLabel } from '../shared/random-provenance.mjs';
import { createRecordsHandler } from '../server/records/service.mjs';
const randomness = { source:'anu',requestId:randomUUID(),batchId:randomUUID(),fetchedAt:'2026-10-29T00:00:00.000Z',consumed:155 };
const input = () => ({schemaVersion:1,id:randomUUID(),startedAt:'2026-10-29T00:00:00.000Z',spread:{type:'free'},cards:[{physicalId:0,sourceCardId:'major-00',faceUp:true,reversed:false,x:0,z:0,drawOrder:1,zIndex:1}],randomness:structuredClone(randomness)});
const operation = () => ({id:randomness.requestId,action:'draw',status:'completed',deck:{order:Array.from({length:78},(_,i)=>i),reversed:Array(78).fill(false),randomness:structuredClone(randomness)}});
test('legacy records remain source-unknown; local does not carry quantum claims',()=>{
 const old=input(); delete old.randomness;
 assert.equal(normalizeRecordInput(old).randomness,undefined);
 assert.equal(randomSourceLabel(undefined),'来源未记录');
 assert.deepEqual(normalizeRecordInput({...old,randomness:{source:'local'}}).randomness,{source:'local'});
 assert.throws(()=>normalizeRecordInput({...old,randomness:{source:'local',batchId:randomness.batchId}}));
});
test('quantum provenance validates bounded counts, IDs, dates and unknown fields',()=>{
 assert.deepEqual(normalizeRecordInput(input()).randomness,randomness);
 for(const patch of [{consumed:154},{consumed:1025},{consumed:155.5},{requestId:'bad'},{fetchedAt:'tomorrow'},{secret:'bad'}])
 assert.throws(()=>normalizeRecordInput({...input(),randomness:{...randomness,...patch}}));
});
test('saved quantum source must match completed backend allocation and orientations',()=>{
 assert.deepEqual(verifiedRandomProvenance(input(),operation()),randomness);
 for(const patch of [{status:'pending'},{id:randomUUID()},{action:'collect'}]) assert.throws(()=>verifiedRandomProvenance(input(),{...operation(),...patch}));
 const wrong=input();wrong.cards[0].reversed=true;
 assert.throws(()=>verifiedRandomProvenance(wrong,operation()));
 const replaced=input();replaced.randomness.batchId=randomUUID();assert.throws(()=>verifiedRandomProvenance(replaced,operation()));
 assert.throws(()=>verifiedRandomProvenance(input(),null));
});
test('HTTP record handler verifies quantum allocation before any save',async()=>{
 let stored=null,writes=0;const store={getRandomDraw:async()=>operation(),create:async(record,hash)=>{writes++;stored=record;return {record,hash,inserted:true};}};
 const handler=createRecordsHandler({accessGuard:async()=>new Response(null,{headers:{'x-middleware-next':'1'}}),getStore:async()=>store});
 const jwt=['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({sub:'local-synthetic-user'})).toString('base64url'),''].join('.');
 const send=body=>handler(new Request('https://example.test/api/records',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json','cf-access-jwt-assertion':jwt},body:JSON.stringify(body)}));
 const forged=input();forged.cards[0].reversed=true;
 assert.equal((await send(forged)).status,400);assert.equal(writes,0);
 assert.equal((await send(input())).status,201);assert.equal(writes,1);assert.deepEqual(stored.randomness,randomness);
});
