import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const outDir = process.env.DATA_DIR || path.join(os.homedir(), 'Downloads', 'EduPath-Official-Data-2026-Reviewed-20260923');
const dir = path.join(outDir, '06-bnmc');
const diagDir = path.join(dir, '_diagnostics');
await mkdir(dir, { recursive: true });
await mkdir(diagDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
// Several Bangladesh government domains currently present certificate-chain/name errors
// in Chromium. Keep HTTPS, bypass only browser certificate validation, and record it.
const context = await browser.newContext({ acceptDownloads: true, ignoreHTTPSErrors: true });
const page = await context.newPage();
page.setDefaultTimeout(25000);

const listing = 'https://bnmc.portal.gov.bd/pages/miscellaneous-infos';
const retrievedDate = '2026-09-23';
try {
  await page.goto(listing, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);
} catch (e) {
  await writeFile(path.join(diagDir, 'bnmc_navigation_error.txt'), String(e?.stack || e), 'utf8');
  console.error('BNMC listing navigation failed even with certificate bypass:', e.message);
  await browser.close();
  process.exit(2);
}

const rows = page.locator('tr');
const count = await rows.count();
let target = null;
for (let i = 0; i < count; i++) {
  const r = rows.nth(i);
  const text = (await r.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  if (/১৪ জুন ২০২৬.*নার্সিং.*মিডওয়াইফারি.*প্রতিষ্ঠানের তালিকা/i.test(text) || /14 June 2026.*nursing.*midwifery.*institution/i.test(text)) {
    target = r; break;
  }
}
// Fallback: choose the first 2026 nursing/midwifery institution-list row.
if (!target) {
  for (let i = 0; i < count; i++) {
    const r = rows.nth(i);
    const text = (await r.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (/২০২৬.*নার্সিং.*মিডওয়াইফারি.*প্রতিষ্ঠানের তালিকা/i.test(text)) { target = r; break; }
  }
}

if (!target) {
  await page.screenshot({ path: path.join(diagDir, 'bnmc_listing_no_target.png'), fullPage: true }).catch(() => {});
  await writeFile(path.join(diagDir, 'bnmc_listing_text.txt'), await page.locator('body').innerText().catch(() => ''), 'utf8');
  console.error('BNMC 2026 institution-list row not found. Diagnostics saved.');
  await browser.close();
  process.exit(3);
}

const title = (await target.innerText()).replace(/\s+/g, ' ').trim();
const targetLinks = await target.locator('a').evaluateAll(as => as.map(a => ({ text:(a.textContent||'').trim(), href:a.href })).filter(x => x.href));
let detailUrl = targetLinks.at(-1)?.href || '';
if (detailUrl) {
  await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
} else {
  const clickable = target.locator('a,button').last();
  if (await clickable.count()) {
    await clickable.click({ force: true });
    await page.waitForTimeout(2500);
    detailUrl = page.url();
  }
}
await page.waitForTimeout(2200);
detailUrl = page.url();

const anchors = await page.locator('a').evaluateAll(as => as.map(a => ({ text:(a.textContent||'').replace(/\s+/g,' ').trim(), href:a.href })).filter(x => x.href));
const fileLinks = anchors.filter(x => /objectstorage|sites\/default\/files|\.pdf(?:$|\?)|\.xlsx?(?:$|\?)|\.csv(?:$|\?)/i.test(x.href));
const metadata = {
  title,
  listing,
  detailUrl,
  fileLinks,
  retrievedDate,
  tlsCertificateValidationBypassed: true,
  trustNote: 'HTTPS certificate validation was bypassed only because the official BNMC government host returned a certificate error in Chromium. Verify downloaded file hashes/source URL before promotion to VERIFIED.'
};
await writeFile(path.join(dir, 'bnmc_latest_source_metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

if (!fileLinks.length) {
  await page.screenshot({ path: path.join(diagDir, 'bnmc_detail_no_file.png'), fullPage: true }).catch(() => {});
  await writeFile(path.join(diagDir, 'bnmc_detail_text.txt'), await page.locator('body').innerText().catch(() => ''), 'utf8');
  console.error('BNMC detail page found, but no direct attachment URL was exposed. Metadata/diagnostics saved.');
  await browser.close();
  process.exit(4);
}

let saved = 0;
for (let i = 0; i < fileLinks.length; i++) {
  const u = fileLinks[i].href;
  try {
    const res = await context.request.get(u, { timeout: 90000, ignoreHTTPSErrors: true });
    if (!res.ok()) { console.error('BNMC attachment HTTP', res.status(), u); continue; }
    const ct = res.headers()['content-type'] || '';
    let ext = path.extname(new URL(u).pathname).toLowerCase();
    if (!ext || ext.length > 6) ext = ct.includes('pdf') ? '.pdf' : ct.includes('spreadsheet') ? '.xlsx' : ct.includes('csv') ? '.csv' : '.bin';
    const name = `BNMC-Updated-Institutions-2026-06-14${fileLinks.length > 1 ? `-${i+1}` : ''}${ext}`;
    await writeFile(path.join(dir, name), await res.body());
    console.log(`Saved BNMC attachment: ${name}`);
    saved++;
  } catch (e) {
    console.error(`BNMC attachment fetch failed: ${u}: ${e.message}`);
  }
}
if (!saved) process.exitCode = 5;
await browser.close();
