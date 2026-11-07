import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  EvidenceDataset,
  Prisma,
  PrismaClient,
  VerificationStatus,
} from "@prisma/client";

const prisma = new PrismaClient();
const APPROVAL_TOKEN = "I_APPROVE_1336_PENDING_SOURCE_EVIDENCE_IMPORT";

type Row = Record<string,string>;
function clean(v: unknown){ return String(v ?? "").trim(); }
function lower(v: unknown){ return clean(v).toLowerCase(); }

function parseCsv(text:string):Row[]{
  const rows:string[][]=[]; let row:string[]=[], cell="", q=false;
  for(let i=0;i<text.length;i++){ const ch=text[i]!;
    if(q){
      if(ch==='"'){ if(text[i+1]==='"'){cell+='"';i++;} else q=false; }
      else cell+=ch;
    } else if(ch==='"') q=true;
    else if(ch===","){row.push(cell);cell="";}
    else if(ch==="\n"){row.push(cell.replace(/\r$/,""));rows.push(row);row=[];cell="";}
    else cell+=ch;
  }
  if(cell.length||row.length){row.push(cell.replace(/\r$/,""));rows.push(row);}
  if(rows.length<2)return[];
  const h=rows[0]!.map(x=>x.trim());
  return rows.slice(1).filter(r=>r.some(v=>v.trim())).map(r=>{const o:Row={};h.forEach((x,i)=>o[x]=(r[i]??"").trim());return o;});
}
function arg(flag:string){const i=process.argv.indexOf(flag);return i>=0?process.argv[i+1]:undefined;}
function has(flag:string){return process.argv.includes(flag);}
function parseJson<T>(s:string, fallback:T):T{
  try{return s?JSON.parse(s):fallback;}catch{return fallback;}
}

async function main(){
  const fileArg=arg("--file");
  const apply=has("--apply");
  const token=arg("--approval-token") ?? "";
  if(!fileArg) throw new Error("Usage: npx tsx scripts/import-source-evidence-guarded.ts --file <source_evidence_1336.csv> [--apply --approval-token TOKEN]");
  if(apply && token!==APPROVAL_TOKEN) throw new Error("HARD_STOP: invalid explicit approval token");

  const rows=parseCsv(await readFile(resolve(fileArg),"utf8"));
  if(rows.length!==1336) throw new Error(`HARD_STOP: expected 1336 rows, got ${rows.length}`);

  const sourceIds=rows.map(r=>clean(r.source_record_id));
  if(new Set(sourceIds).size!==1336) throw new Error("HARD_STOP: duplicate source_record_id in staging");
  if(rows.some(r=>clean(r.verification_status)!=="PENDING")) throw new Error("HARD_STOP: non-PENDING evidence row");
  if(rows.some(r=>clean(r.production_verified)!=="NO")) throw new Error("HARD_STOP: production_verified must be NO");

  const dataSource=await prisma.dataSource.findUnique({where:{id:"source_ugc"},select:{id:true}});
  if(!dataSource) throw new Error("HARD_STOP: DataSource source_ugc not found");

  const parentIds=[...new Set(rows.map(r=>lower(r.parent_source_record_id)).filter(Boolean))];
  const parents=await prisma.institution.findMany({
    where:{dataSourceId:"source_ugc",sourceRecordId:{in:parentIds}},
    select:{id:true,sourceRecordId:true}
  });
  const parentMap=new Map(parents.map(p=>[lower(p.sourceRecordId),p.id]));

  const existing=await prisma.sourceEvidence.findMany({
    where:{dataSourceId:"source_ugc",sourceRecordId:{in:sourceIds}},
    select:{id:true,sourceRecordId:true}
  });

  const payloads:Prisma.SourceEvidenceCreateManyInput[]=rows.map(r=>({
    dataset: clean(r.dataset)==="ADMISSION" ? EvidenceDataset.ADMISSION : EvidenceDataset.SCHOLARSHIP,
    institutionId: parentMap.get(lower(r.parent_source_record_id)) ?? null,
    programId: null,
    dataSourceId:"source_ugc",
    sourceRecordId:clean(r.source_record_id),
    parentSourceRecordId:clean(r.parent_source_record_id) || null,
    candidateType:clean(r.candidate_type) || null,
    sourceCandidateText:clean(r.source_candidate_text),
    sourceUrl:clean(r.source_url),
    pageSha256Values:parseJson<string[]>(r.page_sha256_values_json,[]),
    extractedValues:parseJson<Prisma.InputJsonValue>(r.extracted_values_json,{}),
    assistantDecision:clean(r.assistant_decision) || null,
    assistantAction:clean(r.assistant_action) || null,
    normalizedValue:clean(r.normalized_value) || null,
    normalizedSourceUrl:clean(r.normalized_source_url) || null,
    verificationStatus:VerificationStatus.PENDING,
  }));

  const admission=payloads.filter(p=>p.dataset===EvidenceDataset.ADMISSION).length;
  const scholarship=payloads.filter(p=>p.dataset===EvidenceDataset.SCHOLARSHIP).length;
  const resolvedParents=payloads.filter(p=>p.institutionId).length;
  const unresolvedParents=payloads.length-resolvedParents;

  const hard:string[]=[];
  if(existing.length) hard.push("EXISTING_SOURCE_EVIDENCE_COLLISIONS");
  if(admission!==682) hard.push("ADMISSION_COUNT_NOT_682");
  if(scholarship!==654) hard.push("SCHOLARSHIP_COUNT_NOT_654");
  if(payloads.some(p=>p.verificationStatus!==VerificationStatus.PENDING)) hard.push("NON_PENDING_PAYLOAD");

  const preflight={
    status:hard.length?"HARD_STOP":(apply?"READY_TO_APPLY":"DRY_RUN_READY_FOR_EXPLICIT_HUMAN_APPROVAL"),
    mode:apply?"EXPLICIT_HUMAN_APPROVED_TRANSACTION":"DRY_RUN_ONLY",
    dbWritesPerformed:false,
    rowsRead:rows.length,
    admissionEvidence:admission,
    scholarshipEvidence:scholarship,
    parentResolvedRows:resolvedParents,
    parentUnresolvedRows:unresolvedParents,
    existingSourceEvidenceCollisions:existing.length,
    requiredApprovalToken:APPROVAL_TOKEN,
    structuredAdmissionRuleWrites:0,
    structuredScholarshipWrites:0,
    verifiedPublicationPerformed:false,
    hardStopReasons:hard,
  };
  if(hard.length){console.log(JSON.stringify(preflight,null,2));process.exitCode=2;return;}
  if(!apply){console.log(JSON.stringify(preflight,null,2));return;}

  const result=await prisma.$transaction(async tx=>{
    const collision=await tx.sourceEvidence.count({
      where:{dataSourceId:"source_ugc",sourceRecordId:{in:sourceIds}}
    });
    if(collision) throw new Error("HARD_STOP_IN_TRANSACTION: evidence collision appeared");

    const created=await tx.sourceEvidence.createMany({data:payloads});
    if(created.count!==1336) throw new Error(`HARD_STOP_IN_TRANSACTION: created ${created.count} != 1336`);

    const pending=await tx.sourceEvidence.count({
      where:{
        dataSourceId:"source_ugc",
        sourceRecordId:{in:sourceIds},
        verificationStatus:VerificationStatus.PENDING
      }
    });
    if(pending!==1336) throw new Error(`HARD_STOP_IN_TRANSACTION: pending ${pending} != 1336`);
    return {insertedPendingEvidenceRows:created.count,pendingVerifiedInsideTransaction:pending};
  },{maxWait:15000,timeout:120000});

  console.log(JSON.stringify({
    status:"APPLY_SUCCESS",
    mode:"EXPLICIT_HUMAN_APPROVED_TRANSACTION",
    dbWritesPerformed:true,
    result,
    policyAssertions:{
      allRowsPending:true,
      structuredAdmissionRuleWrites:0,
      structuredScholarshipWrites:0,
      verifiedPublicationPerformed:false,
      fakeOrInferredValuesInserted:false,
    }
  },null,2));
}

main()
 .catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1;})
 .finally(async()=>{await prisma.$disconnect();});
