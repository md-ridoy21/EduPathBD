import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient, VerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();
type Row = Record<string,string>;
function clean(v:unknown){ return String(v ?? "").trim(); }
function lower(v:unknown){ return clean(v).toLowerCase(); }
function parseCsv(text:string):Row[]{
  const rows:string[][]=[]; let row:string[]=[],cell="",q=false;
  for(let i=0;i<text.length;i++){const ch=text[i]!;
    if(q){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=ch;}
    else if(ch==='"')q=true;
    else if(ch===","){row.push(cell);cell="";}
    else if(ch==="\n"){row.push(cell.replace(/\r$/,""));rows.push(row);row=[];cell="";}
    else cell+=ch;
  }
  if(cell.length||row.length){row.push(cell.replace(/\r$/,""));rows.push(row);}
  if(rows.length<2)return[];
  const h=rows[0]!.map(x=>x.trim());
  return rows.slice(1).filter(r=>r.some(v=>v.trim())).map(r=>{const o:Row={};h.forEach((x,i)=>o[x]=(r[i]??"").trim());return o;});
}
function arg(f:string){const i=process.argv.indexOf(f);return i>=0?process.argv[i+1]:undefined;}
function sourceId(parent:string,slug:string){
  const identity=`${lower(parent)}|${lower(slug)}`;
  return `ugc:program:${createHash("sha256").update(identity).digest("hex").slice(0,32)}`;
}
async function main(){
  const fileArg=arg("--file"); if(!fileArg) throw new Error("Usage: npx tsx scripts/postverify-ugc-program-import.ts --file <csv>");
  const file=resolve(fileArg); const rows=parseCsv(await readFile(file,"utf8"));
  const ids=rows.map(r=>sourceId(r.parent_source_record_id,r.program_slug));
  const db=await prisma.program.findMany({
    where:{dataSourceId:"source_ugc",sourceRecordId:{in:ids}},
    select:{id:true,name:true,slug:true,sourceRecordId:true,verificationStatus:true,institutionId:true,sourceUrl:true}
  });
  const byId=new Map(db.map(x=>[x.sourceRecordId,x]));
  const missing=ids.filter(id=>!byId.has(id));
  const nonDraft=db.filter(x=>x.verificationStatus!==VerificationStatus.DRAFT);
  console.log(JSON.stringify({
    status: missing.length===0 && nonDraft.length===0 && db.length===ids.length ? "PASS_POST_IMPORT_VERIFICATION":"HARD_STOP",
    mode:"READ_ONLY_POST_IMPORT_VERIFICATION",
    dbWritesPerformed:false,
    expectedRows:rows.length,
    databaseRowsMatched:db.length,
    missingRows:missing.length,
    nonDraftRows:nonDraft.length,
    verifiedPublicationPerformed:false,
    samples:{missing:missing.slice(0,10),nonDraft:nonDraft.slice(0,10)}
  },null,2));
  if(missing.length||nonDraft.length||db.length!==ids.length) process.exitCode=2;
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await prisma.$disconnect();});
