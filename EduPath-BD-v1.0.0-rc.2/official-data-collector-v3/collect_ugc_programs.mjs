import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const outDir = process.env.DATA_DIR || path.join(os.homedir(), 'Downloads', 'EduPath-Official-Data-2026-Reviewed-20260923');
const dir = path.join(outDir,'04-ugc');
const diagDir = path.join(dir,'_diagnostics');
await mkdir(dir,{recursive:true});
await mkdir(diagDir,{recursive:true});
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({ignoreHTTPSErrors:true});
const page = await context.newPage(); page.setDefaultTimeout(25000);

const listPages = [
  ['public','https://www.ugc-universities.gov.bd/public-universities'],
  ['private','https://www.ugc-universities.gov.bd/private-universities'],
  ['international','https://www.ugc-universities.gov.bd/international-universities'],
  ['cbhe','https://www.ugc-universities.gov.bd/cbhe']
];
const detailLinks = new Map();
for (const [category,url] of listPages) {
  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000}); await page.waitForTimeout(1800);
    const links = await page.locator('a[href*="university-detail"]').evaluateAll(as=>as.map(a=>({name:(a.textContent||'').replace(/\s+/g,' ').trim(),href:a.href})));
    for (const x of links) if (x.href) detailLinks.set(x.href,{...x,category});
  } catch(e){ console.error('UGC list fetch failed',url,e.message); }
}

// Fallback if list pages render links in JS or fail: probe official detail IDs.
if (detailLinks.size < 100) {
  console.error(`UGC list discovery returned only ${detailLinks.size}; probing detail IDs as fallback.`);
  for (let id=1; id<=240; id++) {
    const url=`https://www.ugc-universities.gov.bd/university-detail/${id}`;
    try {
      const res=await context.request.get(url,{timeout:25000,ignoreHTTPSErrors:true});
      if(!res.ok()) continue;
      const text=await res.text();
      if(!/UGC Approved Faculties|Year of establishment|Permanent campus/i.test(text)) continue;
      const name=(text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
      detailLinks.set(url,{name,category:'unknown'});
    } catch {}
  }
}

const rows=[];
let idx=0;
for (const [url,meta] of detailLinks) {
  idx++;
  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000}); await page.waitForTimeout(450);
    const title = (await page.locator('h1').first().innerText().catch(()=>meta.name)).replace(/\s+/g,' ').trim();
    if (!title) continue;
    const bodyText = await page.locator('body').innerText();
    const websiteMatch = bodyText.match(/Website\s*\|?\s*([^\n]+)/i);
    const faculties = await page.evaluate(() => {
      const hs=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
      const h=hs.find(x=>/UGC Approved Faculties/i.test(x.textContent||''));
      if(!h) return [];
      const out=[]; let el=h.nextElementSibling; let steps=0;
      while(el && steps++<18 && !/^H[1-6]$/.test(el.tagName)) {
        out.push(...[...el.querySelectorAll('li')].map(li=>(li.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean));
        el=el.nextElementSibling;
      }
      return [...new Set(out)];
    });
    rows.push({category:meta.category,university_name:title,detail_url:url,website:websiteMatch?.[1]?.trim()||'',approved_faculties:faculties.join(' | '),retrieved_date:'2026-09-23',tls_certificate_validation_bypassed:'true'});
    if (idx%25===0) console.log(`UGC ${idx}/${detailLinks.size}`);
  } catch(e){ console.error('UGC detail failed',url,e.message); }
}
const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;
const csv=['category,university_name,detail_url,website,approved_faculties,retrieved_date,tls_certificate_validation_bypassed',...rows.map(r=>[r.category,r.university_name,r.detail_url,r.website,r.approved_faculties,r.retrieved_date,r.tls_certificate_validation_bypassed].map(esc).join(','))].join('\n')+'\n';
const outFile=path.join(dir,'ugc_university_approved_faculties_2026-09-23.csv');
await writeFile(outFile,csv,'utf8');
await writeFile(path.join(diagDir,'ugc_discovered_detail_links.json'),JSON.stringify([...detailLinks.entries()],null,2),'utf8');
console.log(`UGC detail pages captured: ${rows.length}/${detailLinks.size}`);
if(rows.length<150) process.exitCode=2;
await browser.close();
