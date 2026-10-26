import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { DATA_DIR, RETRIEVED_DATE, rowsFromHtmlTable, stripTags, normalize, curlGetWithMeta, writeCsv, ensureDir } from './lib_common.mjs';

const dir=await ensureDir(path.join(DATA_DIR,'03-bteb'));
const diag=await ensureDir(path.join(dir,'_diagnostics'));
const base='https://btebcbt.gov.bd/utility/instituteList';
const seen=new Map(); let reportedTotal=null; const pageStats=[];

for(let offset=0;offset<2000;offset+=10){
  const url=`${base}?max=10&offset=${offset}&search=`;
  let r; try{r=await curlGetWithMeta(url,{timeout:45});}catch(e){pageStats.push({offset,error:e.message});break;}
  const html=r.body.toString('utf8');
  const text=normalize(stripTags(html));
  if(reportedTotal==null){const m=text.match(/Showing\s+Record\s+Total\s*:\s*(\d+)/i);if(m)reportedTotal=Number(m[1]);}
  const rows=rowsFromHtmlTable(html); let added=0;
  for(const c of rows){
    if(c.length<8||!/^\d{4,7}$/.test(c[0])) continue;
    const row={institute_code:c[0],institute_name:c[1],address:c[2],mobile:c[3],eiin:c[4],email:c[5],division:c[6],district:c[7],source_url:base,retrieved_date:RETRIEVED_DATE};
    const key=`${row.institute_code}|${normalize(row.institute_name).toLowerCase()}`;
    if(!seen.has(key)){seen.set(key,row);added++;}
  }
  pageStats.push({offset,status:r.status,bytes:r.body.length,rowsDetected:rows.length,added,totalSeen:seen.size});
  if(added===0&&offset>0) break;
  if(reportedTotal&&seen.size>=reportedTotal) break;
}
const rows=[...seen.values()].sort((a,b)=>Number(a.institute_code)-Number(b.institute_code));
await writeCsv(path.join(dir,'bteb_institute_master_live_v4.csv'),['institute_code','institute_name','address','mobile','eiin','email','division','district','source_url','retrieved_date'],rows);
const report={source:base,retrievedDate:RETRIEVED_DATE,reportedTotal,collectedRows:rows.length,uniqueCodes:new Set(rows.map(r=>r.institute_code)).size,duplicateCodeCount:rows.length-new Set(rows.map(r=>r.institute_code)).size,pageStats};
await writeFile(path.join(dir,'bteb_institute_master_live_v4_report.json'),JSON.stringify(report,null,2),'utf8');
await writeFile(path.join(diag,'bteb_v4_pages.json'),JSON.stringify(pageStats,null,2),'utf8');
console.log(`BTEB master: reported=${reportedTotal ?? 'unknown'} collected=${rows.length} uniqueCodes=${report.uniqueCodes}`);
if(reportedTotal && rows.length!==reportedTotal) process.exitCode=2;
