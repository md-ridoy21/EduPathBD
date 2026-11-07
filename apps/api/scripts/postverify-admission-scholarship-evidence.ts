import "dotenv/config";
import { EvidenceDataset, PrismaClient, VerificationStatus } from "@prisma/client";
const prisma=new PrismaClient();

(async()=>{
  const [total,ad,sch,pending,adRules,scholarships,verifiedEvidence]=await Promise.all([
    prisma.sourceEvidence.count({where:{dataSourceId:"source_ugc"}}),
    prisma.sourceEvidence.count({where:{dataSourceId:"source_ugc",dataset:EvidenceDataset.ADMISSION}}),
    prisma.sourceEvidence.count({where:{dataSourceId:"source_ugc",dataset:EvidenceDataset.SCHOLARSHIP}}),
    prisma.sourceEvidence.count({where:{dataSourceId:"source_ugc",verificationStatus:VerificationStatus.PENDING}}),
    prisma.admissionRule.count(),
    prisma.scholarship.count(),
    prisma.sourceEvidence.count({where:{dataSourceId:"source_ugc",verificationStatus:VerificationStatus.VERIFIED}}),
  ]);

  const checks={
    total1336:total===1336,
    admission682:ad===682,
    scholarship654:sch===654,
    allPending:pending===1336,
    noVerifiedEvidence:verifiedEvidence===0,
    structuredAdmissionRulesRemainZero:adRules===0,
    structuredScholarshipsRemainZero:scholarships===0,
  };
  const hard=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
  console.log(JSON.stringify({
    status:hard.length?"HARD_STOP":"PASS_ADMISSION_SCHOLARSHIP_EVIDENCE_FOUNDATION",
    mode:"READ_ONLY_POST_IMPORT_VERIFICATION",
    dbWritesPerformed:false,
    counts:{totalEvidence:total,admissionEvidence:ad,scholarshipEvidence:sch,pendingEvidence:pending,verifiedEvidence,admissionRules:adRules,scholarships},
    checks,hardStopReasons:hard
  },null,2));
  if(hard.length) process.exitCode=2;
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await prisma.$disconnect();});
