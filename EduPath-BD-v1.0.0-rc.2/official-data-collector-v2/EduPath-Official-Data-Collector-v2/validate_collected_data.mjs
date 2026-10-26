import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const root=process.env.DATA_DIR||path.join(os.homedir(),'Downloads','EduPath-Official-Data-2026-Reviewed-20260923');
const targets=[
 ['BTEB','03-bteb/bteb_full_live_crawl.csv',500],
 ['NU','07-nu/nu_colleges_live_crawl.csv',1000],
 ['UGC institutions','04-ugc/ugc_universities_2026-09-23.csv',150],
 ['UGC faculties','04-ugc/ugc_university_approved_faculties_2026-09-23.csv',150],
 ['DGME','05-dgme/dgme_medical_dental_current_118.csv',100]
];
let fail=false;
for(const [name,rel,min] of targets){
 try{const s=await readFile(path.join(root,rel),'utf8');const lines=s.split(/\r?\n/).filter(Boolean).length;const rows=Math.max(0,lines-1);console.log(`${name}: ${rows} rows (${rel})`);if(rows<min){console.log(`  WARNING: below expected completeness floor ${min}`);fail=true;}}
 catch{console.log(`${name}: MISSING (${rel})`);fail=true;}
}
for(const rel of ['06-bnmc/bnmc_latest_source_metadata.json','03-bteb/bteb_2026_27_official_links.csv']){
 try{const s=await stat(path.join(root,rel));console.log(`present: ${rel} (${s.size} bytes)`);}catch{console.log(`MISSING: ${rel}`);fail=true;}
}
process.exitCode=fail?2:0;
