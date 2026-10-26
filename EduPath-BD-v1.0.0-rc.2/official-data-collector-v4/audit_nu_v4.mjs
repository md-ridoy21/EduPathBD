import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { DATA_DIR, parseCsv, normalize, readJsonIfExists, ensureDir } from './lib_common.mjs';
const dir=await ensureDir(path.join(DATA_DIR,'07-nu'));
let rows=[];try{rows=parseCsv(await readFile(path.join(dir,'nu_colleges_live_crawl.csv'),'utf8'));}catch{}
const codeCounts=new Map(), nameCounts=new Map();
for(const r of rows){const c=normalize(r.college_code),n=normalize(r.college_name).toLowerCase();if(c)codeCounts.set(c,(codeCounts.get(c)||0)+1);if(n)nameCounts.set(n,(nameCounts.get(n)||0)+1);}
const duplicateCodes=[...codeCounts].filter(([,n])=>n>1); const duplicateNames=[...nameCounts].filter(([,n])=>n>1);
const samples=await readJsonIfExists(path.join(dir,'_diagnostics','nu_response_samples.json'))||[];
const totals=[];
function walk(v,path=''){
  if(Array.isArray(v)){v.forEach((x,i)=>walk(x,`${path}[${i}]`));return;}
  if(!v||typeof v!=='object')return;
  for(const [k,x] of Object.entries(v)){
    const p=path?`${path}.${k}`:k;
    if(/^(recordsTotal|recordsFiltered|total|totalRecords|count|total_count)$/i.test(k)&&Number.isFinite(Number(x)))totals.push({path:p,value:Number(x)});
    if(x&&typeof x==='object')walk(x,p);
  }
}
for(const s of samples){try{walk(JSON.parse(s.text||''),'response');}catch{}}
const report={rows:rows.length,uniqueCodes:codeCounts.size,uniqueNames:nameCounts.size,duplicateCodeCount:duplicateCodes.length,duplicateNameCount:duplicateNames.length,blankCodes:rows.filter(r=>!normalize(r.college_code)).length,blankNames:rows.filter(r=>!normalize(r.college_name)).length,duplicateCodes:duplicateCodes.slice(0,100),duplicateNames:duplicateNames.slice(0,100),apiTotalCandidates:[...new Map(totals.map(x=>[`${x.path}|${x.value}`,x])).values()].slice(0,100),note:'NU official profile currently states 2,257 affiliated institutions; the live college-list endpoint may include additional/inactive/other rows. Do not promote all 2,294 rows until status/type reconciliation is complete.'};
await writeFile(path.join(dir,'nu_colleges_audit_v4.json'),JSON.stringify(report,null,2),'utf8');
console.log(`NU audit: rows=${report.rows} uniqueCodes=${report.uniqueCodes} duplicateCodes=${report.duplicateCodeCount} blankNames=${report.blankNames}`);
if(report.rows<2200||report.duplicateCodeCount>0||report.blankCodes>0||report.blankNames>0)process.exitCode=2;
