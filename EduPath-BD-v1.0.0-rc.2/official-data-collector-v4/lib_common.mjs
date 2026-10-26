import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
export const DATA_DIR = process.env.DATA_DIR || path.join(os.homedir(), 'Downloads', 'EduPath-Official-Data-2026-Reviewed-20260923');
export const RETRIEVED_DATE = '2026-09-23';

export function normalize(s='') { return String(s).replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim(); }
export function stripTags(html='') {
  return decodeEntities(String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<[^>]+>/g,' '));
}
export function decodeEntities(s='') {
  return String(s)
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
}
export function absoluteUrl(base, href='') {
  try { return new URL(href, base).href; } catch { return ''; }
}
export function anchorsFromHtml(html='', base='') {
  const out=[];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    out.push({ href:absoluteUrl(base, decodeEntities(m[1])), text:normalize(stripTags(m[2])) });
  }
  return out.filter(x=>x.href);
}
export function rowsFromHtmlTable(html='') {
  const out=[];
  for(const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells=[];
    for(const td of tr[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)) cells.push(normalize(stripTags(td[1])));
    if(cells.length) out.push(cells);
  }
  return out;
}
export function csvEscape(v='') { return `"${String(v??'').replaceAll('"','""')}"`; }
export async function writeCsv(file, headers, rows) {
  await mkdir(path.dirname(file),{recursive:true});
  const body=[headers.join(','),...rows.map(r=>headers.map(h=>csvEscape(r[h]??'')).join(','))].join('\n')+'\n';
  await writeFile(file,body,'utf8');
}
export function parseCsv(text='') {
  const rows=[]; let row=[], cell='', q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){
      if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}
      else if(c==='"') q=false;
      else cell+=c;
    } else {
      if(c==='"') q=true;
      else if(c===','){row.push(cell);cell='';}
      else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
      else cell+=c;
    }
  }
  if(cell||row.length){row.push(cell);rows.push(row);}
  if(!rows.length) return [];
  const headers=rows.shift();
  return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}
export async function curlGet(url, {binary=false, timeout=30}={}) {
  const args=['-k','-L','--compressed','-sS','--connect-timeout','8','--max-time',String(timeout),'-A','Mozilla/5.0 EduPathBD-OfficialDataCollector-v4/1.0',url];
  const {stdout}=await execFileAsync('curl',args,{encoding:binary?'buffer':'utf8',maxBuffer:binary?100*1024*1024:25*1024*1024});
  return stdout;
}
export async function curlGetWithMeta(url,{timeout=30}={}){
  const marker='__EDUPATH_META__';
  const args=['-k','-L','--compressed','-sS','--connect-timeout','8','--max-time',String(timeout),'-A','Mozilla/5.0 EduPathBD-OfficialDataCollector-v4/1.0','-w',`${marker}%{http_code}|%{url_effective}|%{content_type}`,url];
  const {stdout}=await execFileAsync('curl',args,{encoding:'buffer',maxBuffer:100*1024*1024});
  const mb=Buffer.from(marker); const idx=stdout.lastIndexOf(mb);
  if(idx<0) return {body:stdout,status:0,effectiveUrl:url,contentType:''};
  const body=stdout.subarray(0,idx); const meta=stdout.subarray(idx+mb.length).toString('utf8');
  const [status,effectiveUrl,contentType]=meta.split('|');
  return {body,status:Number(status||0),effectiveUrl:effectiveUrl||url,contentType:contentType||''};
}
export async function ensureDir(p){await mkdir(p,{recursive:true});return p;}
export async function readJsonIfExists(file){try{return JSON.parse(await readFile(file,'utf8'));}catch{return null;}}
