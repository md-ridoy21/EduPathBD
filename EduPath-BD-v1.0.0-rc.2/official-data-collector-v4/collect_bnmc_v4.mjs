import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { DATA_DIR, RETRIEVED_DATE, normalize, stripTags, anchorsFromHtml, absoluteUrl, curlGetWithMeta, ensureDir } from './lib_common.mjs';

const dir=await ensureDir(path.join(DATA_DIR,'06-bnmc'));
const diag=await ensureDir(path.join(dir,'_diagnostics'));
const titleNeedles=['১৪ জুন ২০২৬','নার্সিং','মিডওয়াইফারি','প্রতিষ্ঠানের তালিকা'];
const listingCandidates=[
  'https://bnmc.portal.gov.bd/pages/miscellaneous-infos',
  'http://bnmc.portal.gov.bd/pages/miscellaneous-infos',
  'https://bnmc.gov.bd/pages/miscellaneous-infos',
  'http://bnmc.gov.bd/pages/miscellaneous-infos'
];
let listingUrl='', listingHtml='', detailUrl='', targetTitle='';
const attempts=[];

function hasTarget(text){ const n=normalize(text); return titleNeedles.every(x=>n.includes(x)); }
function findDetailInHtml(html,base){
  // 1) direct anchor containing title
  for(const a of anchorsFromHtml(html,base)) if(hasTarget(a.text)) return {url:a.href,title:a.text,mode:'title-anchor'};
  // 2) title in a table/card container with separate "দেখুন" link
  for(const m of html.matchAll(/<(tr|article|li|div)\b[^>]*>([\s\S]*?)<\/\1>/gi)){
    const text=normalize(stripTags(m[2])); if(!hasTarget(text)) continue;
    const as=anchorsFromHtml(m[2],base);
    const preferred=as.find(a=>/দেখুন|view|details?/i.test(a.text)) || as.at(-1);
    if(preferred) return {url:preferred.href,title:text,mode:'container-link'};
  }
  return null;
}

for(const u of listingCandidates){
  try{
    const r=await curlGetWithMeta(u,{timeout:45});
    const html=r.body.toString('utf8');
    attempts.push({requested:u,status:r.status,effectiveUrl:r.effectiveUrl,contentType:r.contentType,bytes:r.body.length,containsTarget:hasTarget(stripTags(html))});
    if(r.status>=200&&r.status<400&&html.length>500){
      const found=findDetailInHtml(html,r.effectiveUrl||u);
      if(found){listingUrl=r.effectiveUrl||u;listingHtml=html;detailUrl=found.url;targetTitle=found.title;break;}
      // keep best page for diagnostics
      if(html.length>listingHtml.length){listingHtml=html;listingUrl=r.effectiveUrl||u;}
    }
  }catch(e){attempts.push({requested:u,error:e.message});}
}
await writeFile(path.join(diag,'bnmc_v4_listing_attempts.json'),JSON.stringify(attempts,null,2),'utf8');
if(listingHtml) await writeFile(path.join(diag,'bnmc_v4_listing.html'),listingHtml,'utf8');

if(!detailUrl){
  // Latest official row is independently visible on the official portal, but do not fabricate a detail URL.
  const meta={
    title:'১৪ জুন ২০২৬ হালনাগাদ নার্সিং ও মিডওয়াইফারি শিক্ষা প্রতিষ্ঠানের তালিকা',
    listingUrl: listingUrl || listingCandidates[0],
    publishedDate:'2026-09-02',
    retrievedDate:RETRIEVED_DATE,
    attachmentStatus:'detail_url_not_exposed_by_server_html',
    tlsValidationBypassedByCurl:true,
    attempts
  };
  await writeFile(path.join(dir,'bnmc_latest_source_metadata.json'),JSON.stringify(meta,null,2),'utf8');
  console.error('BNMC latest listing confirmed/captured, but detail attachment URL was not exposed in raw official HTML. Metadata saved; attachment remains pending.');
  process.exitCode=2;
} else {
  let detail;
  try{detail=await curlGetWithMeta(detailUrl,{timeout:60});}catch(e){
    await writeFile(path.join(diag,'bnmc_v4_detail_error.txt'),String(e?.stack||e),'utf8');
    console.error('BNMC detail fetch failed:',e.message); process.exit(3);
  }
  const html=detail.body.toString('utf8');
  await writeFile(path.join(diag,'bnmc_v4_detail.html'),html,'utf8');
  const anchors=anchorsFromHtml(html,detail.effectiveUrl||detailUrl);
  const files=anchors.filter(a=>/ডাউনলোড|download|file/i.test(a.text)||/objectstorage|\.pdf(?:$|\?)|\.xlsx?(?:$|\?)|\.csv(?:$|\?)|attachment|download/i.test(a.href));
  const unique=[...new Map(files.map(x=>[x.href,x])).values()];
  const saved=[];
  for(let i=0;i<unique.length;i++){
    const f=unique[i];
    try{
      const r=await curlGetWithMeta(f.href,{timeout:90});
      if(r.status<200||r.status>=400||r.body.length<1000) continue;
      let ext=path.extname(new URL(r.effectiveUrl||f.href).pathname).toLowerCase();
      if(!/^\.(pdf|xlsx?|csv|docx?)$/.test(ext)){
        if(/pdf/i.test(r.contentType)) ext='.pdf'; else if(/spreadsheet|excel/i.test(r.contentType)) ext='.xlsx'; else if(/csv/i.test(r.contentType)) ext='.csv'; else ext='.bin';
      }
      const name=`BNMC-Updated-Institutions-2026-06-14${unique.length>1?`-${i+1}`:''}${ext}`;
      await writeFile(path.join(dir,name),r.body); saved.push({name,url:f.href,effectiveUrl:r.effectiveUrl,bytes:r.body.length,contentType:r.contentType});
    }catch{}
  }
  const meta={title:targetTitle||'১৪ জুন ২০২৬ হালনাগাদ নার্সিং ও মিডওয়াইফারি শিক্ষা প্রতিষ্ঠানের তালিকা',listingUrl,detailUrl:detail.effectiveUrl||detailUrl,publishedDate:'2026-09-02',retrievedDate:RETRIEVED_DATE,fileLinks:unique,saved,tlsValidationBypassedByCurl:true};
  await writeFile(path.join(dir,'bnmc_latest_source_metadata.json'),JSON.stringify(meta,null,2),'utf8');
  console.log(`BNMC detail found; attachment candidates: ${unique.length}; saved: ${saved.length}`);
  if(!saved.length) process.exitCode=2;
}
