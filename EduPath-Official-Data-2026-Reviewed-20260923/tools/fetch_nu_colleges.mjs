// Run from an EduPath project with Playwright installed:
// node tools/fetch_nu_colleges.mjs
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("https://collegeportal.nu.ac.bd/college-list", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(3000);

const rows = await page.locator("table tbody tr").evaluateAll(trs =>
  trs.map(tr => [...tr.querySelectorAll("td")].map(td => (td.textContent || "").trim()))
     .filter(c => c.length >= 2 && c[0])
);

const esc = v => `"${String(v ?? "").replaceAll('"','""')}"`;
const csv = ["college_code,college_name,email,source_url",
  ...rows.map(c => [c[0], c[1], c[2] || "", "https://collegeportal.nu.ac.bd/college-list"].map(esc).join(","))
].join("\n");
await writeFile("07-nu/nu_colleges_live_crawl.csv", csv, "utf8");
console.log("NU rows:", rows.length);
await browser.close();
