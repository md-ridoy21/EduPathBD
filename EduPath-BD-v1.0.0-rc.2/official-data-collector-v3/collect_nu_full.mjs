import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const outDir = process.env.DATA_DIR || path.join(os.homedir(), 'Downloads', 'EduPath-Official-Data-2026-Reviewed-20260923');
const dir = path.join(outDir, '07-nu');
const outFile = path.join(dir, 'nu_colleges_live_crawl.csv');
const diagDir = path.join(dir, '_diagnostics');
await mkdir(dir, { recursive: true });
await mkdir(diagDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1200 } });
const page = await context.newPage();
page.setDefaultTimeout(25000);
const url = 'https://collegeportal.nu.ac.bd/college-list';
const seen = new Map();
const network = [];
const responseBodies = [];
const normalize = s => (s || '').replace(/\s+/g, ' ').trim();

function put(code,name,email='',source=url) {
  code=normalize(String(code||'')); name=normalize(String(name||'')); email=normalize(String(email||''));
  if(!/^\d{2,8}$/.test(code)||name.length<3) return false;
  const key=`${code}|${name.toLowerCase()}`;
  if(!seen.has(key)) seen.set(key,{college_code:code,college_name:name,email,source_url:source,retrieved_date:'2026-09-23'});
  return true;
}

function walkJson(v, source) {
  if(Array.isArray(v)){ for(const x of v) walkJson(x,source); return; }
  if(!v||typeof v!=='object') return;
  const entries=Object.entries(v); const lower=Object.fromEntries(entries.map(([k,val])=>[k.toLowerCase(),val]));
  const code = lower.college_code ?? lower.collegecode ?? lower.college_code_no ?? lower.code ?? lower.collegeid ?? lower.college_id;
  const name = lower.college_name ?? lower.collegename ?? lower.name ?? lower.college;
  const email = lower.email ?? lower.college_email ?? '';
  if(code!=null&&name!=null) put(code,name,email,source);
  for(const [,x] of entries) if(x&&typeof x==='object') walkJson(x,source);
}

page.on('response', async res => {
  const req=res.request(); const u=res.url(); const type=req.resourceType(); const ct=res.headers()['content-type']||'';
  if(!['xhr','fetch','document'].includes(type) && !/college|list|api|data/i.test(u)) return;
  const meta={url:u,status:res.status(),resourceType:type,method:req.method(),postData:req.postData()||'',contentType:ct};
  network.push(meta);
  if(res.status()>=400) return;
  if(/json|text|javascript/i.test(ct)||['xhr','fetch'].includes(type)) {
    try {
      const text=await res.text();
      if(text.length<5_000_000) responseBodies.push({url:u,text:text.slice(0,500000)});
      try{walkJson(JSON.parse(text),u);}catch{}
    } catch{}
  }
});

async function captureDom() {
  const rows=await page.locator('table tbody tr').evaluateAll(trs=>trs.map(tr=>[...tr.querySelectorAll('td')].map(td=>(td.textContent||'').replace(/\s+/g,' ').trim()))).catch(()=>[]);
  for(const c of rows) if(c.length>=2) put(c[0],c[1],c[2]||'',page.url());
}

try {
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForTimeout(8000);
  await captureDom();
} catch(e) {
  await writeFile(path.join(diagDir,'nu_navigation_error.txt'),String(e?.stack||e),'utf8');
}

// Trigger the portal's search/XHR path. The public page often renders only headers until searched.
const search = page.locator('input[type="search"], .dataTables_filter input, input[placeholder*="Search" i], input[placeholder*="search" i]').first();
if(await search.count()) {
  const queries=['0','1','2','3','4','5','6','7','8','9'];
  for(const q of queries) {
    await search.fill(q).catch(()=>{}); await page.waitForTimeout(900); await captureDom();
    // paginate current result set if standard DataTables pagination exists
    for(let guard=0;guard<250;guard++) {
      const next=page.locator('.dataTables_paginate .next:not(.disabled), a.paginate_button.next:not(.disabled), li.next:not(.disabled) a, button:has-text("Next"):not([disabled])').first();
      if(!(await next.count())||!(await next.isVisible().catch(()=>false))) break;
      const before=seen.size;
      await next.click({force:true}).catch(()=>{}); await page.waitForTimeout(450); await captureDom();
      if(seen.size===before) break;
    }
  }
  await search.fill('').catch(()=>{});
}

// Replay any DataTables-like public XHR once with a large page size.
for(const n of network.filter(x=>['xhr','fetch'].includes(x.resourceType))) {
  const hasPaging=/\b(start|offset|length|limit)=/i.test(n.url+' '+n.postData) || /search%5Bvalue%5D|search\[value\]/i.test(n.url+' '+n.postData);
  if(!hasPaging) continue;
  try {
    if(n.method==='GET') {
      const u=new URL(n.url);
      for(const key of ['start','offset']) if(u.searchParams.has(key)) u.searchParams.set(key,'0');
      for(const key of ['length','limit','pageSize','size']) if(u.searchParams.has(key)) u.searchParams.set(key,'5000');
      if(u.searchParams.has('search[value]')) u.searchParams.set('search[value]','');
      const res=await context.request.get(u.href,{timeout:90000,ignoreHTTPSErrors:true});
      const text=await res.text(); try{walkJson(JSON.parse(text),u.href);}catch{}
    } else if(n.method==='POST' && n.postData) {
      const params=new URLSearchParams(n.postData);
      for(const key of ['start','offset']) if(params.has(key)) params.set(key,'0');
      for(const key of ['length','limit','pageSize','size']) if(params.has(key)) params.set(key,'5000');
      if(params.has('search[value]')) params.set('search[value]','');
      const res=await context.request.post(n.url,{form:Object.fromEntries(params),timeout:90000,ignoreHTTPSErrors:true});
      const text=await res.text(); try{walkJson(JSON.parse(text),n.url);}catch{}
    }
  } catch{}
}

// Inspect loaded script URLs/text for API clues when no rows were exposed.
const scripts=await page.locator('script[src]').evaluateAll(ss=>ss.map(s=>s.src).filter(Boolean)).catch(()=>[]);
const scriptHints=[];
for(const s of scripts.slice(0,40)) {
  try {
    const res=await context.request.get(s,{timeout:30000,ignoreHTTPSErrors:true}); if(!res.ok()) continue;
    const text=await res.text();
    for(const m of text.matchAll(/['"`]([^'"`]{0,160}(?:college|list|api)[^'"`]{0,160})['"`]/ig)) {
      const hint=normalize(m[1]); if(hint&&hint.length<350) scriptHints.push({script:s,hint});
    }
  } catch{}
}

const items=[...seen.values()].sort((a,b)=>Number(a.college_code)-Number(b.college_code));
const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;
const csv=['college_code,college_name,email,source_url,retrieved_date',...items.map(r=>[r.college_code,r.college_name,r.email,r.source_url,r.retrieved_date].map(esc).join(','))].join('\n')+'\n';

// Do not silently replace a larger existing file with a smaller failed crawl.
let existingRows=0;
try { const old=await readFile(outFile,'utf8'); existingRows=Math.max(0,old.split(/\r?\n/).filter(Boolean).length-1); } catch{}
if(items.length>=existingRows || existingRows===0) await writeFile(outFile,csv,'utf8');
else await writeFile(path.join(dir,'nu_colleges_live_crawl_v3_candidate.csv'),csv,'utf8');

await writeFile(path.join(diagDir,'nu_network_requests.json'),JSON.stringify(network,null,2),'utf8');
await writeFile(path.join(diagDir,'nu_response_samples.json'),JSON.stringify(responseBodies.slice(0,50),null,2),'utf8');
await writeFile(path.join(diagDir,'nu_script_hints.json'),JSON.stringify(scriptHints.slice(0,500),null,2),'utf8');
await writeFile(path.join(diagDir,'nu_page_text.txt'),await page.locator('body').innerText().catch(()=>''),'utf8');
await page.screenshot({path:path.join(diagDir,'nu_final_page.png'),fullPage:true}).catch(()=>{});
console.log(`NU captured rows: ${items.length}; previous file rows: ${existingRows}; network events: ${network.length}`);
if(items.length<1000) {
  console.error('NU is still below completeness threshold. This run saved network/API diagnostics so the exact public endpoint can be fixed next without guessing.');
  process.exitCode=2;
}
await browser.close();
