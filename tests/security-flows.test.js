import test from 'node:test';
import assert from 'node:assert/strict';
import { requireTenantMember } from '../api/_auth.js';
import leads from '../api/leads.js';
import contacts from '../api/contact-events.js';

const office='123e4567-e89b-42d3-a456-426614174000';
const second='123e4567-e89b-42d3-a456-426614174001';
const response=()=>({code:200,body:null,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
function setup(){const env={...process.env},fetch=global.fetch;Object.assign(process.env,{SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',SUPABASE_PUBLISHABLE_KEY:'public-test',PUBLIC_LEAD_TENANT_ID:office,PUBLIC_SITE_URL:'https://example.com'});return()=>{process.env=env;global.fetch=fetch;};}

test('multiple memberships require explicit office selection',async()=>{const restore=setup();try{
  global.fetch=async url=>url.includes('/auth/v1/user')?new Response(JSON.stringify({id:second}),{status:200}):new Response(JSON.stringify([{tenant_id:office,role:'owner'},{tenant_id:second,role:'agent'}]),{status:200});
  const auth=await requireTenantMember({headers:{authorization:'Bearer test'}});assert.equal(auth.status,409);
}finally{restore();}});
test('explicit office is verified against user membership',async()=>{const restore=setup();try{
  global.fetch=async url=>{if(url.includes('/auth/v1/user'))return new Response(JSON.stringify({id:second}),{status:200});assert.match(url,new RegExp('tenant_id=eq.'+office));return new Response('[]',{status:200});};
  const auth=await requireTenantMember({headers:{authorization:'Bearer test','x-bp-tenant-id':office}});assert.equal(auth.status,403);
}finally{restore();}});
test('lead rate limit prevents customer insertion',async()=>{const restore=setup();let inserted=false;try{
  global.fetch=async(url,opts)=>{if(url.includes('/customers?'))return new Response('[]',{status:200});if(url.includes('/rpc/consume_public_lead_limit')){assert.match(JSON.parse(opts.body).p_bucket,/^[a-f0-9]{64}$/);return new Response('false',{status:200});}inserted=true;throw Error('must not insert');};
  const res=response();await leads({method:'POST',headers:{'content-type':'application/json',origin:'https://example.com'},body:{request_id:office,name:'Contato de teste',phone:'(61) 99999-0000',practice_area:'Direito Criminal',urgency:'routine',consent:true}},res);assert.equal(res.code,429);assert.equal(inserted,false);
}finally{restore();}});
test('contact event rejects customer outside active office',async()=>{const restore=setup();let inserted=false;try{
  global.fetch=async(url,opts)=>{if(url.includes('/auth/v1/user'))return new Response(JSON.stringify({id:second}),{status:200});if(url.includes('/tenant_members?'))return new Response(JSON.stringify([{tenant_id:office,role:'owner'}]),{status:200});if(url.includes('/customers?')){assert.match(url,new RegExp('tenant_id=eq.'+office));return new Response('[]',{status:200});}inserted=true;throw Error('must not insert');};
  const res=response();await contacts({method:'POST',headers:{authorization:'Bearer test'},body:{customer_id:second,safe_summary:'Retorno operacional solicitado.'}},res);assert.equal(res.code,404);assert.equal(inserted,false);
}finally{restore();}});
