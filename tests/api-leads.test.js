import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/leads.js';

function mockRes(){return {statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
function request(body,extra={}){return {method:'POST',headers:{'content-type':'application/json',origin:'https://bp.example', 'x-real-ip':'203.0.113.10',...(extra.headers||{})},body};}
const valid={request_id:'123e4567-e89b-42d3-a456-426614174000',name:'Pessoa Teste',phone:'(61) 99999-0000',email:'teste@example.com',practice_area:'Direito Criminal',urgency:'routine',consent:true,website:''};

test('rejects methods other than POST',async()=>{const res=mockRes();await handler({method:'GET',headers:{}},res);assert.equal(res.statusCode,405);});
test('requires JSON content type',async()=>{const res=mockRes();await handler(request(valid,{headers:{'content-type':'text/plain'}}),res);assert.equal(res.statusCode,415);});
test('rejects missing consent',async()=>{const res=mockRes();await handler(request({...valid,consent:false}),res);assert.equal(res.statusCode,400);});
test('honeypot does not persist a lead',async()=>{const old=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('must not call DB')};const res=mockRes();await handler(request({...valid,website:'bot'}),res);globalThis.fetch=old;assert.equal(res.statusCode,202);});
test('persists valid lead only through server-side RPC',async()=>{
  const oldFetch=globalThis.fetch;const oldEnv={...process.env};
  process.env.SUPABASE_URL='https://project.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test';process.env.LEAD_HASH_SECRET='test-secret-with-at-least-32-bytes';process.env.PUBLIC_SITE_URL='https://bp.example';process.env.VERCEL_ENV='preview';
  let called=false;globalThis.fetch=async(url,opts)=>{called=true;assert.match(url,/\/rest\/v1\/rpc\/create_public_lead$/);assert.equal(opts.headers.apikey,'sb_secret_test');assert.equal(opts.headers.Authorization,undefined);const payload=JSON.parse(opts.body);assert.equal(payload.p_request_id,valid.request_id);assert.equal(payload.p_name,'Pessoa Teste');assert.equal(payload.p_ip_hash.length,64);return new Response(JSON.stringify('00000000-0000-0000-0000-000000000001'),{status:200});};
  const res=mockRes();await handler(request(valid),res);globalThis.fetch=oldFetch;process.env=oldEnv;
  assert.equal(called,true);assert.equal(res.statusCode,201);assert.equal(res.body.ok,true);
});
test('maps database rate limit to HTTP 429',async()=>{
  const oldFetch=globalThis.fetch;const oldEnv={...process.env};process.env.SUPABASE_URL='https://project.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test';process.env.LEAD_HASH_SECRET='test-secret-with-at-least-32-bytes';process.env.PUBLIC_SITE_URL='https://bp.example';
  globalThis.fetch=async()=>new Response('rate_limited',{status:400});const res=mockRes();await handler(request(valid),res);globalThis.fetch=oldFetch;process.env=oldEnv;assert.equal(res.statusCode,429);
});
