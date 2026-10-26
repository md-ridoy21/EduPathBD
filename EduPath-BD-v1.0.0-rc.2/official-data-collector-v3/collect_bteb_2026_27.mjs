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
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
page.setDefaultTimeout(25000);

const candidates = [
  'https://www.btebadmission.gov.bd/website/',
  'https://btebadmission.gov.bd/website/',
  'https://app1.btebadmission.gov.bd/'
];
let home = '';
let body = '';
for (const u of candidates) {
  try {
    await page.goto(u, { waitUntil:'domcontentloaded', timeout:90000 });
    await page.waitForTimeout(2500);
    body = (await page.locator('body').innerText()).replace(/\s+/g,' ');
    if (/2026\s*-\s*2027/.test(body)) { home = page.url(); break; }
    if (!home) home = page.url();
  } catch (e) {
    console.error('BTEB candidate failed:', u, e.message);
  }
}
if (!home) {
  await writeFile(path.join(diagDir, 'bteb_navigation_failed.txt'), 'All BTEB entry URLs failed', 'utf8');
  await browser.close();
  process.exit(2);
}
if (!/2026\s*-\s*2027/.test(body)) console.error('WARNING: BTEB page did not visibly confirm Session 2026-2027.');

const links = await page.locator('a').evaluateAll(as => as.map(a => ({text:(a.textContent||'').replace(/\s+/g,' ').trim(), href:a.href})).filter(x=>x.href));
const useful = links.filter(x => /প্রতিষ্ঠানের নামের তালিকা|institute|institution|seat|নীতিমালা|বিজ্ঞপ্তি|notice|fee|ফি|admission/i.test(x.text+' '+x.href));
// Add stable current-session pages even if the home page does not expose them directly.
for (const u of [
  'https://www.btebadmission.gov.bd/website/inst_list_available_seat.html',
  'https://www.btebadmission.gov.bd/website/notice.html',
  'https://www.btebadmission.gov.bd/website/payment.html'
]) {
  if (!useful.some(x => x.href === u)) useful.push({ text:'known official current-session endpoint', href:u });
}
const unique = [...new Map(useful.map(x => [x.href, x])).values()];
const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;
const linkCsv = ['text,url,tls_certificate_validation_bypassed,retrieved_date', ...unique.map(x=>[x.text,x.href,'true','2026-09-23'].map(esc).join(','))].join('\n')+'\n';
await writeFile(path.join(dir,'bteb_2026_27_official_links.csv'), linkCsv, 'utf8');

const captures = [];
for (const target of unique.filter(x => /inst_list_available_seat|প্রতিষ্ঠানের নামের তালিকা|institute|institution|seat/i.test(x.text+' '+x.href)).slice(0,20)) {
  try {
    await page.goto(target.href,{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForTimeout(1800);
    const txt=(await page.locator('body').innerText()).replace(/\s+/g,' ');
    const session=(txt.match(/Session\s*:\s*2026\s*-\s*2027/i)?.[0]||'');
    const anchors=await page.locator('a').evaluateAll(as=>as.map(a=>({text:(a.textContent||'').replace(/\s+/g,' ').trim(),href:a.href})).filter(x=>x.href));
    const tables=await page.locator('table').evaluateAll(ts=>ts.map(t=>[...t.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('th,td')].map(td=>(td.textContent||'').replace(/\s+/g,' ').trim()))));
    captures.push({source_url:page.url(),session,links:anchors.filter(a=>/\.pdf(?:$|\?)|institution|institute|seat/i.test(a.text+' '+a.href)),tables});
  } catch(e) { console.error('BTEB target failed:',target.href,e.message); }
}
await writeFile(path.join(dir,'bteb_2026_27_table_capture.json'),JSON.stringify({retrievedDate:'2026-09-23',home,tlsCertificateValidationBypassed:true,captures},null,2),'utf8');
await page.screenshot({path:path.join(diagDir,'bteb_final.png'),fullPage:true}).catch(()=>{});
console.log(`BTEB current-session links: ${unique.length}; detail captures: ${captures.length}`);
await browser.close();
