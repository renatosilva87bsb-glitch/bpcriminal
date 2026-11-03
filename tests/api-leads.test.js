import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/leads.js';

function mockRes(){return {statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
function request(body,extra={}){return {method:'POST',headers:{'content-type':'application/json',origin:process.env.PUBLIC_SITE_URL || 'https://bandeiraepaulo.vercel.app',...(extra.headers||{})},body};}
const valid={request_id:'123e4567-e89b-42d3-a456-426614174000',name:'Pessoa Teste',phone:'(61) 99999-0000',email:'teste@example.com',practice_area:'Direito Criminal',urgency:'routine',consent:true,website:''};

 test('rejects methods other than POST',async()=>{const res=mockRes();await handler({method:'GET',headers:{}},res);assert.equal(res.statusCode,405);});
test('requires JSON content type',async()=>{const res=mockRes();await handler(request(valid,{headers:{'content-type':'text/plain'}}),res);assert.equal(res.statusCode,415);});
test('rejects missing consent',async()=>{const res=mockRes();await handler(request({...valid,consent:false}),res);assert.equal(res.statusCode,400);});
test('honeypot does not persist a lead',async()=>{const old=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('must not call DB')};const res=mockRes();await handler(request({...valid,website:'bot'}),res);globalThis.fetch=old;assert.equal(res.statusCode,202);});
test('persists valid lead directly in the CRM customers table',async()=>{
  const oldFetch=globalThis.fetch;const oldEnv={...process.env};process.env.SUPABASE_URL='https://project.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test';process.env.PUBLIC_LEAD_TENANT_ID='123e4567-e89b-42d3-a456-426614174000';process.env.PUBLIC_SITE_URL='https://bp.example';
  const calls=[];globalThis.fetch=async(url,opts)=>{calls.push({url,opts});if(url.includes('/rpc/consume_public_lead_limit'))return new Response('true',{status:200});if(url.includes('/customers?select='))return new Response('[]',{status:200});assert.match(url,/\/rest\/v1\/customers$/);const payload=JSON.parse(opts.body);assert.equal(payload.full_name,'Pessoa Teste');assert.equal(payload.status,'lead');assert.equal(payload.tenant_id,process.env.PUBLIC_LEAD_TENANT_ID);assert.equal(payload.phone_e164,'+5561999990000');assert.equal(payload.lead_practice_area,'Direito Criminal');assert.equal(payload.lead_request_id,valid.request_id);return new Response(JSON.stringify([{id:'00000000-0000-0000-0000-000000000001'}]),{status:201});};
  const res=mockRes();await handler(request(valid),res);globalThis.fetch=oldFetch;process.env=oldEnv;
  assert.equal(calls.length,3);assert.equal(res.statusCode,201);assert.equal(res.body.ok,true);
});
test('returns the existing CRM record for a repeated request id',async()=>{
  const oldFetch=globalThis.fetch;const oldEnv={...process.env};process.env.SUPABASE_URL='https://project.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test';process.env.PUBLIC_LEAD_TENANT_ID='123e4567-e89b-42d3-a456-426614174000';
  globalThis.fetch=async(url)=>{assert.match(url,/customers\?select=/);return new Response(JSON.stringify([{id:'existing-id'}]),{status:200});};
  const res=mockRes();await handler(request(valid),res);globalThis.fetch=oldFetch;process.env=oldEnv;assert.equal(res.statusCode,200);assert.equal(res.body.reference,'existing-id');
});
