import type { DataAuthority } from "@prisma/client";

export type OfficialSourceDefinition = {
  id: string;
  authority: DataAuthority;
  name: string;
  baseUrl: string;
  datasetUrl?: string;
  institutionTypes: string[];
};

/**
 * Only regulator or institution-owned domains may promote imported records to
 * VERIFIED. The official import command rejects URLs outside the selected
 * authority domain; administrators can use the existing draft workflow for
 * non-regulator sources without presenting them as authoritative.
 */
export const officialSources: OfficialSourceDefinition[] = [
  {
    id: "source_bbs",
    authority: "BBS",
    name: "Bangladesh Bureau of Statistics",
    baseUrl: "https://bbs.gov.bd",
    institutionTypes: []
  },
  { id: "source_banbeis", authority: "BANBEIS", name: "Bangladesh Bureau of Educational Information and Statistics", baseUrl: "https://banbeis.gov.bd", institutionTypes: ["SCHOOL", "COLLEGE", "NATIONAL_UNIVERSITY_COLLEGE"] },
  { id: "source_dshe_emis", authority: "DSHE", name: "Directorate of Secondary and Higher Education EMIS", baseUrl: "https://emis.gov.bd", institutionTypes: ["SCHOOL", "COLLEGE"] },
  { id: "source_bteb", authority: "BTEB", name: "Bangladesh Technical Education Board", baseUrl: "https://bteb.gov.bd", institutionTypes: ["POLYTECHNIC", "TECHNICAL", "TRAINING_PROVIDER"] },
  { id: "source_ugc", authority: "UGC", name: "University Grants Commission of Bangladesh", baseUrl: "https://ugc.gov.bd", institutionTypes: ["PUBLIC_UNIVERSITY", "PRIVATE_UNIVERSITY", "ENGINEERING"] },
  { id: "source_dgme", authority: "DGME", name: "Directorate General of Medical Education", baseUrl: "https://dgme.gov.bd", institutionTypes: ["MEDICAL"] },
  { id: "source_bnmc", authority: "BNMC", name: "Bangladesh Nursing and Midwifery Council", baseUrl: "https://bnmc.gov.bd", institutionTypes: ["MEDICAL", "TRAINING_PROVIDER"] },
  { id: "source_nu", authority: "NATIONAL_UNIVERSITY", name: "National University Bangladesh", baseUrl: "https://www.nu.ac.bd", institutionTypes: ["NATIONAL_UNIVERSITY_COLLEGE"] },
  { id: "source_moedu", authority: "MINISTRY_OF_EDUCATION", name: "Ministry of Education Bangladesh", baseUrl: "https://moedu.gov.bd", institutionTypes: [] }
];

const officialHosts = new Set(officialSources.map((source) => new URL(source.baseUrl).hostname.replace(/^www\./, "")));

export function isOfficialEducationUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return url.protocol === "https:" && [...officialHosts].some((officialHost) => host === officialHost || host.endsWith(`.${officialHost}`));
  } catch {
    return false;
  }
}
