import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const outDir = process.env.DATA_DIR || path.join(os.homedir(), 'Downloads', 'EduPath-Official-Data-2026-Reviewed-20260923');
const dir = path.join(outDir,'04-ugc');
await mkdir(dir,{recursive:true});
const browser = await chromium.launch({headless:true});
const page = await browser.newPage(); page.setDefaultTimeout(20000);

const listPages = [
  ['public','https://www.ugc-universities.gov.bd/public-universities'],
  ['private','https://www.ugc-universities.gov.bd/private-universities'],
  ['international','https://www.ugc-universities.gov.bd/international-universities']
];
const detailLinks = new Map();
for (const [category,url] of listPages) {
  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000}); await page.waitForTimeout(1200);
    const links = await page.locator('a[href*="university-detail"]').evaluateAll(as=>as.map(a=>({name:(a.textContent||'').replace(/\s+/g,' ').trim(),href:a.href})));
    for (const x of links) if (x.href) detailLinks.set(x.href,{...x,category});
  } catch(e){ console.error('UGC list fetch failed',url,e.message); }
}

const rows=[];
let idx=0;
for (const [url,meta] of detailLinks) {
  idx++;
  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000}); await page.waitForTimeout(500);
    const title = (await page.locator('h1').first().innerText().catch(()=>meta.name)).replace(/\s+/g,' ').trim();
    const bodyText = await page.locator('body').innerText();
    const websiteMatch = bodyText.match(/Website\s*\|?\s*([^\n]+)/i);
    const approvedHeading = page.getByRole('heading',{name:/UGC Approved Faculties/i}).first();
    const faculties=[];
    if (await approvedHeading.count()) {
      const section = approvedHeading.locator('xpath=following-sibling::*');
      const lis = await section.locator('li').allInnerTexts().catch(()=>[]);
      faculties.push(...lis.map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean));
    }
    // Also capture list items near the approved-faculties heading in a bounded DOM traversal.
    const near = await page.evaluate(() => {
      const hs=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
      const h=hs.find(x=>/UGC Approved Faculties/i.test(x.textContent||''));
      if(!h) return [];
      const out=[]; let el=h.nextElementSibling; let steps=0;
      while(el && steps++<12 && !/^H[1-6]$/.test(el.tagName)) { out.push(...[...el.querySelectorAll('li')].map(li=>(li.textContent||'').trim())); el=el.nextElementSibling; }
      return out;
    });
    for (const f of near) if(f && !faculties.includes(f)) faculties.push(f);
    rows.push({category:meta.category,university_name:title,detail_url:url,website:websiteMatch?.[1]?.trim()||'',approved_faculties:faculties.join(' | '),retrieved_date:'2026-09-23'});
    if (idx%25===0) console.log(`UGC ${idx}/${detailLinks.size}`);
  } catch(e){ console.error('UGC detail failed',url,e.message); }
}
const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;
const csv=['category,university_name,detail_url,website,approved_faculties,retrieved_date',...rows.map(r=>[r.category,r.university_name,r.detail_url,r.website,r.approved_faculties,r.retrieved_date].map(esc).join(','))].join('\n')+'\n';
await writeFile(path.join(dir,'ugc_university_approved_faculties_2026-09-23.csv'),csv,'utf8');
console.log(`UGC detail pages captured: ${rows.length}/${detailLinks.size}`);
await browser.close();
