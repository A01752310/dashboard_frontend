import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalize,merge,initial,success,failure,label,age} from '../src/core.js';
import {createTelemetryClient} from '../src/api.js';
const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/telemetry-INTEGRACION-001.json',import.meta.url)));
const [two,one]=normalize(fixture);
test('authoritative fixture: two samples, exact types and transition',()=>{
 assert.deepEqual(fixture.map(r=>r.seq),[2,1]);
 assert.equal(two.received_at,'2026-11-19T21:40:05.412000+00:00');
 assert.deepEqual(Object.values(one.variables),[false,false,false]);
 assert.deepEqual(Object.values(two.variables),[true,false,false]);
});
test('AC-01/02: empty and failed startup preserve unknown signals',()=>{
 const empty=success(initial(),[],0); assert.equal(empty.status,'ESPERANDO');assert.equal(empty.rows.length,0);
 const failed=failure(initial(),'timeout');assert.equal(failed.status,'INTERRUMPIDA');assert.equal(failed.rows.length,0);assert.equal(label(null),'Sin lectura');
});
test('AC-03/04/05: transition, failure, empty response and recovery',()=>{
 let state=success(initial(),[one],1);assert.equal(state.rows.at(-1).variables.piston1_act,false);
 state=success(state,[two,one],2);assert.equal(state.rows.at(-1).variables.piston1_act,true);
 const rows=state.rows;state=failure(state,'failed');assert.deepEqual(state.rows,rows);
 state=success(state,[],3);assert.equal(state.status,'SIN_DATOS_NUEVOS');assert.deepEqual(state.rows,rows);
 state=success(state,[two,one],4);assert.equal(state.status,'EN_LINEA');assert.equal(state.rows.length,2);assert.equal(state.lastQuery,4);
});
test('AC-06: dedupe functional keys, preserve newest receipt, first tie',()=>{
 const newer={...one,id:999,received_at:'2026-11-20T00:00:00Z'};
 assert.equal(merge([one],[two,one,one,newer]).length,2);
 assert.equal(merge([one],[one,newer])[0].id,999);
 assert.equal(merge([], [newer,{...newer,id:888}])[0].id,999);
 assert.equal(merge([newer],[{...newer,id:777}])[0].id,777);
 assert.equal(merge([], [one,{...one,source:'other'}]).length,2);
});
test('buffer sorts timestamps then seq and keeps 50 newest',()=>{
 const rows=Array.from({length:60},(_,i)=>({...one,seq:i,timestamp:new Date(Date.UTC(2026,0,1,0,0,i)).toISOString()}));
 const result=merge([],rows.reverse());assert.equal(result.length,50);assert.equal(result[0].seq,10);assert.equal(result.at(-1).seq,59);
});
test('contract rejects wrappers; boolean strings are unknown, extra variables ignored',()=>{
 assert.throws(()=>normalize({records:fixture}));assert.throws(()=>normalize([null,1,{}]));
 const [r]=normalize([{...one,variables:{piston1_act:'true',piston2_act:0,piston3_act:null,extra:true}}]);
 assert.deepEqual(Object.values(r.variables),[null,null,null]);
 assert.equal(normalize([{...one,timestamp:'bad',received_at:null}])[0].timestamp,null);
});
test('age uses received_at, estimates on timestamp and reports clock skew',()=>{
 assert.equal(age(two,Date.parse(two.received_at)+2000),'2 s');
 assert.equal(age({...two,received_at:null},Date.parse(two.timestamp)+1000),'1 s (estimada)');
 assert.equal(age(two,0),'0 s · desfase de reloj');
});
const config={API_BASE:'/api',LIMIT:50,REQUEST_TIMEOUT_MS:100};
const response=(body,status=200)=>new Response(typeof body==='string'?body:JSON.stringify(body),{status});
test('AC-08: ignored run_id activates local filter without mixing runs',async()=>{
 const urls=[];const client=createTelemetryClient(config,async url=>{urls.push(url);return response([one,{...two,run_id:'other'}]);});
 const result=await client.query('INTEGRACION-001');assert.equal(result.filterLocal,true);assert.equal(result.rows.length,1);
 await client.query('INTEGRACION-001');assert.match(urls[0],/run_id=INTEGRACION-001/);assert.doesNotMatch(urls[1],/run_id/);
});
test('fallback retries once, prioritizes run_id, keeps limit fallback for next query',async()=>{
 const urls=[],answers=[response('run_id and limit rejected',422),response(fixture),response('limit rejected',400),response(fixture)];
 const client=createTelemetryClient(config,async url=>{urls.push(url);return answers.shift();});
 assert.equal((await client.query('INTEGRACION-001')).filterLocal,true);
 assert.equal((await client.query('INTEGRACION-001')).limitLocal,true);
 assert.equal(urls.length,4);assert.doesNotMatch(urls[1],/run_id/);assert.match(urls[1],/limit/);assert.doesNotMatch(urls[3],/limit/);
});
test('no retry or fixture fallback after network/contract failures',async()=>{
 let calls=0;const client=createTelemetryClient(config,async()=>{calls++;throw Error('offline');});
 await assert.rejects(client.query('INTEGRACION-001'));assert.equal(calls,1);
 const bad=createTelemetryClient(config,async()=>response({records:fixture}));await assert.rejects(bad.query('INTEGRACION-001'));
});
test('requests are abortable and disable caching',async()=>{
 const client=createTelemetryClient({...config,REQUEST_TIMEOUT_MS:10},(_url,options)=>new Promise((resolve,reject)=>{
 assert.equal(options.cache,'no-store');options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));
 }));await assert.rejects(client.query('INTEGRACION-001'),{name:'AbortError'});
});
