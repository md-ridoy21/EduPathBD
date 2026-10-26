import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { DATA_DIR, RETRIEVED_DATE, normalize, stripTags, decodeEntities, curlGetWithMeta, parseCsv, writeCsv, ensureDir } from './lib_common.mjs';

const dir=await ensureDir(path.join(DATA_DIR,'04-ugc'));
const diag=await ensureDir(path.join(dir,'_diagnostics'));
let master=[];
try{master=parseCsv(await readFile(path.join(dir,'ugc_universities_2026-09-23.csv'),'utf8'));}catch{}
function keyName(s=''){return normalize(s).toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]+/g,' ');}
const catByName=new Map(master.map(r=>[keyName(r.university_name),r.category||'']));

function extract(html,url){
  if(!/UGC Approved Faculties|Year of establishment|Permanent campus/i.test(html)) return null;
  const hm=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i); let name=normalize(stripTags(hm?.[1]||''));
  if(!name){const tm=html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);name=normalize(stripTags(tm?.[1]||'')).replace(/\s*\|\s*University Grants Commission.*$/i,'');}
  if(!name||name.length<3) return null;
  let facultyBlock='';
  const fi=html.search(/UGC Approved Faculties/i);
  if(fi>=0) facultyBlock=html.slice(fi,Math.min(html.length,fi+40000));
  const faculties=[];
  for(const m of facultyBlock.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)){
    const x=normalize(stripTags(m[1]));
    if(x&&x.length<300&&!/^(home|contact|about|login|register)$/i.test(x)) faculties.push(x);
  }
  const uniq=[...new Set(faculties)].slice(0,80);
  const plain=normalize(stripTags(html));
  const wm=plain.match(/Website\s*\|?\s*((?:https?:\/\/|www\.)?[^\s|]+\.[A-Za-z]{2,}[^\s|]*)/i);
  let category=catByName.get(keyName(name))||'unknown';
  if(category==='unknown'){
    // Fuzzy containment against captured official master.
    const kn=keyName(name); const hit=master.find(r=>{const km=keyName(r.university_name);return km===kn||km.includes(kn)||kn.includes(km);});
    if(hit) category=hit.category||'unknown';
  }
  return {category,university_name:name,detail_url:url,website:wm?.[1]||'',approved_faculties:uniq.join(' | '),approved_faculty_count:uniq.length,retrieved_date:RETRIEVED_DATE,tls_certificate_validation_bypassed:'true'};
}

const ids=[...Array(450)].map((_,i)=>i+1);
const rows=[]; const failures=[]; let cursor=0;
async function worker(){
  while(true){
    const i=cursor++; if(i>=ids.length) return; const id=ids[i];
    const variants=[`https://www.ugc-universities.gov.bd/university-detail/${id}`,`https://ugc-universities.gov.bd/university-detail/${id}`,`http://www.ugc-universities.gov.bd/university-detail/${id}`];
    let got=null;
    for(const u of variants){
      try{const r=await curlGetWithMeta(u,{timeout:18});if(r.status>=200&&r.status<400&&r.body.length>500){const html=r.body.toString('utf8');const ex=extract(html,r.effectiveUrl||u);if(ex){got=ex;break;}}}catch{}
    }
    if(got){rows.push(got); if(rows.length%25===0)console.log(`UGC captured ${rows.length}`);} else failures.push(id);
  }
}
await Promise.all(Array.from({length:10},()=>worker()));
const unique=[...new Map(rows.map(r=>[keyName(r.university_name),r])).values()].sort((a,b)=>a.university_name.localeCompare(b.university_name));
await writeCsv(path.join(dir,'ugc_university_approved_faculties_2026-09-23.csv'),['category','university_name','detail_url','website','approved_faculties','approved_faculty_count','retrieved_date','tls_certificate_validation_bypassed'],unique);
await writeFile(path.join(diag,'ugc_v4_probe_report.json'),JSON.stringify({probedIds:ids.length,captured:unique.length,masterRows:master.length,unknownCategory:unique.filter(r=>r.category==='unknown').length,failures},null,2),'utf8');
console.log(`UGC faculties: captured=${unique.length}; source-master=${master.length}; unknownCategory=${unique.filter(r=>r.category==='unknown').length}`);
if(unique.length<150) process.exitCode=2;
