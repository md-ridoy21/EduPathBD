export type Institution = {
  id: string;
  name: string;
  slug: string;
  type: string;
  district: string;
  division?: string;
  upazila?: string;
  officialCode?: string;
  description?: string;
  websiteUrl?: string;
  sourceUrl?: string;
  verified: boolean;
  programCount: number;
};

export type Program = {
  id: string;
  institutionId: string;
  institutionName: string;
  name: string;
  slug: string;
  level: string;
  pathwayCategory?: string;
  entryStage?: string;
  subjectAreas?: string[];
  durationMonths?: number;
  tuitionMin?: number;
  tuitionMax?: number;
  groups: string[];
  minimumGpa: number;
  careerOutcomes: string[];
  sourceUrl?: string;
  verified: boolean;
};

export type Circular = {
  id: string;
  institutionId: string;
  institutionName: string;
  title: string;
  academicSession: string;
  applicationStartsAt?: string;
  applicationEndsAt: string;
  examAt?: string;
  applicationFee?: number;
  sourceUrl: string;
  verified: boolean;
};

export type StudentApplication = {
  id: string;
  programId: string;
  programName: string;
  institutionName: string;
  status: string;
  notes?: string;
  updatedAt: string;
  documents: Array<{ id: string; title: string; isRequired: boolean; isCompleted: boolean }>;
};

export type Paginated<T> = {
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

export type CatalogStats = {
  institutions: number;
  programs: number;
  circulars: number;
};
