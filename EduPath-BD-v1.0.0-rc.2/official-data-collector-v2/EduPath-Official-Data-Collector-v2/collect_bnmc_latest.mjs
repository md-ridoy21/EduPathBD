import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const outDir = process.env.DATA_DIR || path.join(os.homedir(), 'Downloads', 'EduPath-Official-Data-2026-Reviewed-20260923');
const dir = path.join(outDir, '06-bnmc');
const diagDir = path.join(dir, '_diagnostics');
await mkdir(dir, { recursive: true });
await mkdir(diagDir, { recursive: true });

const browser = await chromium.launch({ headless: true, acceptDownloads: true });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(20000);

const listing = 'https://bnmc.portal.gov.bd/pages/miscellaneous-infos';
await page.goto(listing, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(2500);

const targetRe = /১৪ জুন ২০২৬.*নার্সিং.*মিডওয়াইফারি.*প্রতিষ্ঠানের তালিকা|14 June 2026.*nursing.*midwifery/i;
const row = page.locator('tr').filter({ hasText: targetRe }).first();
if (!(await row.count())) {
  await page.screenshot({ path: path.join(diagDir, 'bnmc_listing_no_target.png'), fullPage: true }).catch(() => {});
  await writeFile(path.join(diagDir, 'bnmc_listing_text.txt'), await page.locator('body').innerText(), 'utf8');
  console.error('Latest 14 June 2026 BNMC institution-list row not found.');
  process.exit(2);
}

const title = (await row.innerText()).replace(/\s+/g,' ').trim();
let href = await row.locator('a').last().getAttribute('href').catch(() => null);
if (!href) {
  const link = page.getByRole('link', { name: /দেখুন|view/i }).filter({ has: page.locator('xpath=ancestor::tr') }).first();
  href = await link.getAttribute('href').catch(() => null);
}
if (!href) {
  // Click any visible action in the row.
  await row.locator('a').last().click();
} else {
  await page.goto(new URL(href, listing).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
}
await page.waitForTimeout(2200);

const detailUrl = page.url();
const anchors = await page.locator('a').evaluateAll(as => as.map(a => ({ text:(a.textContent||'').trim(), href:a.href })).filter(x => x.href));
const fileLinks = anchors.filter(x => /sites\/default\/files|objectstorage|\.pdf(?:$|\?)|\.xlsx?(?:$|\?)|\.csv(?:$|\?)/i.test(x.href));
await writeFile(path.join(dir, 'bnmc_latest_source_metadata.json'), JSON.stringify({title, listing, detailUrl, fileLinks, retrievedDate:'2026-09-23'}, null, 2), 'utf8');

if (!fileLinks.length) {
  await page.screenshot({ path: path.join(diagDir, 'bnmc_detail_no_file.png'), fullPage: true }).catch(() => {});
  await writeFile(path.join(diagDir, 'bnmc_detail_text.txt'), await page.locator('body').innerText(), 'utf8');
  console.error('BNMC detail page found, but a direct attachment URL was not exposed. Metadata saved for diagnosis.');
  process.exit(3);
}

let saved = 0;
for (let i=0;i<fileLinks.length;i++) {
  const u = fileLinks[i].href;
  try {
    const res = await context.request.get(u, { timeout: 90000 });
    if (!res.ok()) continue;
    const ct = res.headers()['content-type'] || '';
    let ext = path.extname(new URL(u).pathname).toLowerCase();
    if (!ext || ext.length > 6) ext = ct.includes('pdf') ? '.pdf' : ct.includes('spreadsheet') ? '.xlsx' : '.bin';
    const name = `BNMC-Updated-Institutions-2026-06-14${fileLinks.length>1?`-${i+1}`:''}${ext}`;
    await writeFile(path.join(dir, name), await res.body());
    console.log(`Saved BNMC attachment: ${name}`);
    saved++;
  } catch (e) {
    console.error(`BNMC attachment fetch failed: ${u}: ${e.message}`);
  }
}
if (!saved) process.exitCode = 4;
await browser.close();
