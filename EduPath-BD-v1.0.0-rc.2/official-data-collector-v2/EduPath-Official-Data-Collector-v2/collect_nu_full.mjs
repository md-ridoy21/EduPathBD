import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const outDir = process.env.DATA_DIR || path.join(os.homedir(), 'Downloads', 'EduPath-Official-Data-2026-Reviewed-20260923');
const outFile = path.join(outDir, '07-nu', 'nu_colleges_live_crawl.csv');
const diagDir = path.join(outDir, '07-nu', '_diagnostics');
await mkdir(path.dirname(outFile), { recursive: true });
await mkdir(diagDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
page.setDefaultTimeout(20000);

const url = 'https://collegeportal.nu.ac.bd/college-list';
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3000);

// Try to increase page length if DataTables exposes a length selector.
for (const selector of ['select[name$="_length"]', '.dataTables_length select', 'select:has(option[value="100"])']) {
  const loc = page.locator(selector).first();
  if (await loc.count()) {
    const values = await loc.locator('option').evaluateAll(opts => opts.map(o => o.value));
    const preferred = ['100', '50', '-1'].find(v => values.includes(v));
    if (preferred) {
      await loc.selectOption(preferred).catch(() => {});
      await page.waitForTimeout(1200);
      break;
    }
  }
}

const seen = new Map();
const normalize = s => (s || '').replace(/\s+/g, ' ').trim();

async function captureRows() {
  const rows = await page.locator('table tbody tr').evaluateAll(trs => trs.map(tr =>
    [...tr.querySelectorAll('td')].map(td => (td.textContent || '').replace(/\s+/g, ' ').trim())
  ));
  let added = 0;
  for (const c of rows) {
    if (c.length < 2) continue;
    const code = normalize(c[0]);
    const name = normalize(c[1]);
    const email = normalize(c[2] || '');
    if (!code || !name || !/^\d+$/.test(code)) continue;
    const key = `${code}|${name}`;
    if (!seen.has(key)) {
      seen.set(key, { college_code: code, college_name: name, email, source_url: url, retrieved_date: '2026-09-23' });
      added++;
    }
  }
  return added;
}

function nextCandidates() {
  return [
    '.dataTables_paginate .next:not(.disabled)',
    'a.paginate_button.next:not(.disabled)',
    'li.next:not(.disabled) a',
    'button:has-text("Next"):not([disabled])',
    'a:has-text("Next")',
    'button:has-text("পরবর্তী")',
    'a:has-text("পরবর্তী")'
  ];
}

let pages = 0;
let stagnant = 0;
while (pages < 1000) {
  const before = seen.size;
  await captureRows();
  pages++;
  if (seen.size === before) stagnant++; else stagnant = 0;

  let next = null;
  for (const sel of nextCandidates()) {
    const loc = page.locator(sel).first();
    if (await loc.count()) {
      const disabled = await loc.evaluate(el =>
        el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled') || el.parentElement?.classList.contains('disabled')
      ).catch(() => true);
      if (!disabled && await loc.isVisible().catch(() => false)) { next = loc; break; }
    }
  }
  if (!next || stagnant >= 2) break;

  const firstKeyBefore = await page.locator('table tbody tr').first().innerText().catch(() => '');
  await next.click({ timeout: 10000 }).catch(async () => { await next.click({ force: true }); });
  await page.waitForTimeout(700);
  await page.waitForFunction(oldText => {
    const tr = document.querySelector('table tbody tr');
    return !tr || (tr.textContent || '').trim() !== oldText.trim();
  }, firstKeyBefore, { timeout: 8000 }).catch(() => {});
}

const items = [...seen.values()].sort((a,b) => Number(a.college_code) - Number(b.college_code));
const esc = v => `"${String(v ?? '').replaceAll('"','""')}"`;
const csv = [
  'college_code,college_name,email,source_url,retrieved_date',
  ...items.map(r => [r.college_code,r.college_name,r.email,r.source_url,r.retrieved_date].map(esc).join(','))
].join('\n') + '\n';
await writeFile(outFile, csv, 'utf8');

const infoText = await page.locator('body').innerText().catch(() => '');
await writeFile(path.join(diagDir, 'nu_page_text.txt'), infoText, 'utf8');
await page.screenshot({ path: path.join(diagDir, 'nu_final_page.png'), fullPage: true }).catch(() => {});

console.log(`NU captured rows: ${items.length}; pages traversed: ${pages}`);
console.log(`Saved: ${outFile}`);
if (items.length < 1000) {
  console.error('WARNING: NU result is far below the official affiliated-college scale. Treat as incomplete and inspect diagnostics.');
  process.exitCode = 2;
}
await browser.close();
