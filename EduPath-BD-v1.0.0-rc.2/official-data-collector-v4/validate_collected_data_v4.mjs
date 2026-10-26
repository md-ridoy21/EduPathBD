import { readFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, parseCsv, readJsonIfExists } from './lib_common.mjs';
const root=DATA_DIR; let fail=false;
async function csv(name,rel,min){try{const rows=parseCsv(await readFile(path.join(root,rel),'utf8'));console.log(`${name}: ${rows.length} rows (${rel})`);if(rows.length<min){console.log(`  BLOCKER: below completeness floor ${min}`);fail=true;}return rows;}catch{console.log(`${name}: MISSING (${rel})`);fail=true;return[];}}
const bteb=await csv('BTEB master v4','03-bteb/bteb_institute_master_live_v4.csv',509);
const nu=await csv('NU live list','07-nu/nu_colleges_live_crawl.csv',2200);
const ugc=await csv('UGC institutions','04-ugc/ugc_universities_2026-09-23.csv',180);
const fac=await csv('UGC faculties','04-ugc/ugc_university_approved_faculties_2026-09-23.csv',150);
const dgme=await csv('DGME','05-dgme/dgme_medical_dental_current_118.csv',118);
const br=await readJsonIfExists(path.join(root,'03-bteb','bteb_institute_master_live_v4_report.json'));
if(br){console.log(`BTEB reported total=${br.reportedTotal} collected=${br.collectedRows}`);if(br.reportedTotal&&br.reportedTotal!==br.collectedRows){console.log('  BLOCKER: BTEB reported/collected count mismatch');fail=true;}}
const na=await readJsonIfExists(path.join(root,'07-nu','nu_colleges_audit_v4.json'));
if(na){console.log(`NU audit uniqueCodes=${na.uniqueCodes} duplicateCodes=${na.duplicateCodeCount}`);if(na.duplicateCodeCount||na.blankCodes||na.blankNames)fail=true;}else{console.log('NU audit v4: MISSING');fail=true;}
const bm=await readJsonIfExists(path.join(root,'06-bnmc','bnmc_latest_source_metadata.json'));
if(!bm){console.log('BNMC metadata: MISSING');fail=true;}else{console.log(`BNMC metadata: ${bm.title||'present'}; saved=${bm.saved?.length||0}`);if(!(bm.saved?.length)) {console.log('  BLOCKER: latest BNMC attachment still not downloaded');fail=true;}}
try{const s=await stat(path.join(root,'03-bteb','bteb_2026_27_capture_v4.json'));console.log(`BTEB 2026-27 capture: present (${s.size} bytes)`);}catch{console.log('BTEB 2026-27 capture: MISSING');fail=true;}
console.log('\nInstitution-master phase status:',fail?'NOT FINAL':'COLLECTION GATES PASS');
process.exitCode=fail?2:0;
