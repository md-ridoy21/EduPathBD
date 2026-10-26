import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const outDir = process.env.DATA_DIR || path.join(os.homedir(), 'Downloads', 'EduPath-Official-Data-2026-Reviewed-20260923');
const dir = path.join(outDir, '03-bteb');
const diagDir = path.join(dir, '_diagnostics');
await mkdir(dir, { recursive: true });
await mkdir(diagDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport:{width:1440,height:1200} });
page.setDefaultTimeout(20000);

const home = 'https://app1.btebadmission.gov.bd/';
await page.goto(home, { waitUntil:'domcontentloaded', timeout:90000 });
await page.waitForTimeout(2200);
const body = (await page.locator('body').innerText()).replace(/\s+/g,' ');
const sessionMatch = body.match(/Session\s*:\s*2026\s*-\s*2027/i);
if (!sessionMatch) console.error('WARNING: BTEB page did not visibly confirm Session 2026-2027.');

const links = await page.locator('a').evaluateAll(as => as.map(a => ({text:(a.textContent||'').replace(/\s+/g,' ').trim(), href:a.href})).filter(x=>x.href));
const useful = links.filter(x => /প্রতিষ্ঠানের নামের তালিকা|institute|institution|seat|নীতিমালা|বিজ্ঞপ্তি|fee|ফি/i.test(x.text+' '+x.href));
const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;
const linkCsv = ['text,url', ...useful.map(x=>[x.text,x.href].map(esc).join(','))].join('\n')+'\n';
await writeFile(path.join(dir,'bteb_2026_27_official_links.csv'), linkCsv, 'utf8');

// Follow likely institution-list links and capture all table rows we can see/paginate.
const institutionTargets = [...new Set(useful.filter(x=>/প্রতিষ্ঠানের নামের তালিকা|inst.*list|institute.*list/i.test(x.text+' '+x.href)).map(x=>x.href))];
const allRows = [];
for (const target of institutionTargets.slice(0,5)) {
  try {
    await page.goto(target,{waitUntil:'domcontentloaded',timeout:90000}); await page.waitForTimeout(1800);
    let guard=0;
    while (guard++<200) {
      const rows = await page.locator('table tbody tr').evaluateAll(trs=>trs.map(tr=>[...tr.querySelectorAll('td')].map(td=>(td.textContent||'').replace(/\s+/g,' ').trim())));
      for (const c of rows) if (c.length>=2) allRows.push({source_url:page.url(), cells:c});
      const next = page.locator('.dataTables_paginate .next:not(.disabled), a.paginate_button.next:not(.disabled), li.next:not(.disabled) a').first();
      if (!(await next.count()) || !(await next.isVisible().catch(()=>false))) break;
      await next.click(); await page.waitForTimeout(500);
    }
  } catch (e) { console.error('BTEB list target failed:',target,e.message); }
}
await writeFile(path.join(dir,'bteb_2026_27_table_capture.json'),JSON.stringify({session:'2026-2027',retrievedDate:'2026-09-23',home,links:useful,rows:allRows},null,2),'utf8');
await page.screenshot({path:path.join(diagDir,'bteb_final.png'),fullPage:true}).catch(()=>{});
console.log(`BTEB 2026-27 useful links: ${useful.length}; captured table rows: ${allRows.length}`);
await browser.close();
