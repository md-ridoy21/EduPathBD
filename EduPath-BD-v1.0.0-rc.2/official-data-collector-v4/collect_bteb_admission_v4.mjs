import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DATA_DIR, RETRIEVED_DATE, anchorsFromHtml, stripTags, normalize, curlGetWithMeta, writeCsv, ensureDir } from './lib_common.mjs';
const execFileAsync=promisify(execFile);
const dir=await ensureDir(path.join(DATA_DIR,'03-bteb'));
const diag=await ensureDir(path.join(dir,'_diagnostics'));
const homes=['https://www.btebadmission.gov.bd/website/','https://btebadmission.gov.bd/website/','http://btebadmission.gov.bd/website/'];
let homeHtml='',effective=''; const attempts=[];
for(const u of homes){try{const r=await curlGetWithMeta(u,{timeout:45});attempts.push({url:u,status:r.status,effectiveUrl:r.effectiveUrl,bytes:r.body.length});if(r.status<400&&r.body.length>1000){homeHtml=r.body.toString('utf8');effective=r.effectiveUrl||u;break;}}catch(e){attempts.push({url:u,error:e.message});}}
await writeFile(path.join(diag,'bteb_v4_home_attempts.json'),JSON.stringify(attempts,null,2),'utf8');
if(!homeHtml){console.error('BTEB admission home unavailable');process.exit(3);}
await writeFile(path.join(diag,'bteb_v4_home.html'),homeHtml,'utf8');
const text=normalize(stripTags(homeHtml));
const session=text.match(/Session\s*:\s*2026\s*-\s*2027/i)?.[0]||'';
const anchors=anchorsFromHtml(homeHtml,effective);
const useful=anchors.filter(a=>/2026|seat|institute|institution|diploma|admission|notice|circular|pdf/i.test(`${a.text} ${a.href}`));
const knownPdf='http://btebadmission.gov.bd/website/Link/2026/Final-2026-Center-with-seat-All.pdf';
if(!useful.some(x=>x.href===knownPdf)) useful.push({text:'Final 2026 center with seat (known official link exposed by current admission site)',href:knownPdf});
const unique=[...new Map(useful.map(x=>[x.href,x])).values()];
await writeCsv(path.join(dir,'bteb_2026_27_official_links_v4.csv'),['text','url','retrieved_date','session'],unique.map(x=>({...x,retrieved_date:RETRIEVED_DATE,session})));
const downloads=[];
for(const x of unique){
  if(!/\.pdf(?:$|\?)/i.test(x.href)) continue;
  try{
    const r=await curlGetWithMeta(x.href,{timeout:90}); if(r.status<200||r.status>=400||r.body.length<1000) continue;
    const urlPath=new URL(r.effectiveUrl||x.href).pathname;
    let name=path.basename(urlPath)||'bteb-2026-document.pdf'; if(!/\.pdf$/i.test(name)) name+='-document.pdf';
    name=name.replace(/[^A-Za-z0-9._-]+/g,'_');
    const out=path.join(dir,name); await writeFile(out,r.body);
    downloads.push({name,url:x.href,effectiveUrl:r.effectiveUrl,bytes:r.body.length,contentType:r.contentType});
    try{await execFileAsync('pdftotext',['-layout',out,`${out}.txt`],{timeout:60000});}catch{}
  }catch(e){downloads.push({url:x.href,error:e.message});}
}
const seatPages=unique.filter(x=>/inst_list_available_seat|available.?seat/i.test(`${x.text} ${x.href}`));
const captures=[];
for(const x of seatPages){try{const r=await curlGetWithMeta(x.href,{timeout:60});captures.push({url:x.href,effectiveUrl:r.effectiveUrl,status:r.status,bytes:r.body.length,text:normalize(stripTags(r.body.toString('utf8'))).slice(0,50000)});}catch(e){captures.push({url:x.href,error:e.message});}}
await writeFile(path.join(dir,'bteb_2026_27_capture_v4.json'),JSON.stringify({retrievedDate:RETRIEVED_DATE,session,home:effective,downloads,captures},null,2),'utf8');
console.log(`BTEB 2026-27: session=${session||'not detected'} links=${unique.length} pdfSaved=${downloads.filter(x=>x.name).length} seatPages=${captures.length}`);
if(!/2026\s*-\s*2027/i.test(session)||!downloads.some(x=>x.name)) process.exitCode=2;
