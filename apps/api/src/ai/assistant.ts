import { config } from "../config.js";

export type KnowledgeSource = {
  id: string;
  title: string;
  detail: string;
  url: string;
  verified: boolean;
  kind?: "PROGRAM" | "CIRCULAR" | "SCHOLARSHIP" | "INSTITUTION";
  pathwayCategory?: string;
  entryStage?: string;
  districtCode?: string;
  upazilaCode?: string;
};

export type AssistantContext = {
  stage?: "SSC" | "HSC" | "DIPLOMA" | "UNDERGRADUATE" | "GRADUATE";
  districtCode?: string;
  upazilaCode?: string;
  pathways?: string[];
  interests?: string[];
};

export type AssistantResult = {
  answer: string;
  mode: "gemini" | "demo" | "fallback";
  model: string;
  sources: KnowledgeSource[];
  safetyNotice: string;
};

const sourceConcepts = [
  { pathways: ["POLYTECHNIC_DIPLOMA", "TECHNICAL_VOCATIONAL"], aliases: ["diploma", "polytechnic", "technical", "vocational", "ডিপ্লোমা", "পলিটেকনিক", "কারিগরি"] },
  { pathways: ["ENGINEERING"], aliases: ["engineering", "engineer", "cse", "eee", "civil", "ইঞ্জিনিয়ারিং", "ইঞ্জিনিয়ারিং", "প্রকৌশল"] },
  { pathways: ["UNIVERSITY_GENERAL"], aliases: ["university", "undergraduate", "honours", "বিশ্ববিদ্যালয়", "বিশ্ববিদ্যালয়", "স্নাতক"] },
  { pathways: ["MEDICAL_DENTAL", "MEDICAL_TECHNOLOGY", "NURSING_MIDWIFERY"], aliases: ["medical", "mbbs", "dental", "nursing", "medicine", "মেডিকেল", "নার্সিং", "চিকিৎসা"] },
  { pathways: ["GENERAL_COLLEGE"], aliases: ["college", "hsc college", "কলেজ", "এইচএসসি"] },
  { pathways: ["HIGHER_STUDY"], aliases: ["higher study", "masters", "phd", "উচ্চশিক্ষা", "বিদেশে পড়াশোনা"] }
] as const;

function sourceText(source: KnowledgeSource) {
  return `${source.title} ${source.detail}`.toLowerCase();
}

function uniqueSources(sources: KnowledgeSource[]) {
  return [...new Map(sources.map((source) => [source.id, source])).values()];
}

export function selectRelevantSources(question: string, sources: KnowledgeSource[], context: AssistantContext = {}) {
  const normalizedQuestion = question.toLowerCase();
  const stopWords = new Set(["which", "what", "when", "where", "how", "show", "give", "tell", "with", "from", "জন্য", "আমার", "কোন", "কোনটি", "কিভাবে", "গুলো", "এবং"]);
  const terms = [...new Set([...normalizedQuestion.split(/[^a-z0-9\u0980-\u09ff]+/), ...(context.interests ?? []).flatMap((item) => item.toLowerCase().split(/[^a-z0-9\u0980-\u09ff]+/))].filter((term) => term.length > 2 && !stopWords.has(term)))];
  const requestedConcepts = sourceConcepts.filter((concept) => concept.aliases.some((alias) => normalizedQuestion.includes(alias)));
  const requestedPathways = new Set(context.pathways?.length ? context.pathways : requestedConcepts.flatMap((concept) => [...concept.pathways]));
  const deadlineIntent = /deadline|date|fee|circular|শেষ\s*তারিখ|তারিখ|ফি|সার্কুলার/.test(normalizedQuestion);
  const scholarshipIntent = /scholarship|stipend|funding|বৃত্তি|স্কলারশিপ|উপবৃত্তি/.test(normalizedQuestion);
  const locallyScoped = context.stage === "SSC" && Boolean(context.districtCode || context.upazilaCode);

  const eligiblePool = sources.filter((source) => {
    if (!source.verified) return false;
    if (scholarshipIntent && source.kind !== "SCHOLARSHIP") return false;
    if (deadlineIntent && !scholarshipIntent && source.kind !== "CIRCULAR") return false;
    if (requestedPathways.size && source.kind === "PROGRAM" && source.pathwayCategory && !requestedPathways.has(source.pathwayCategory)) return false;
    if (context.stage && source.kind === "PROGRAM" && source.entryStage && source.entryStage.toUpperCase() !== context.stage) return false;
    if (locallyScoped && context.upazilaCode && source.upazilaCode !== context.upazilaCode) return false;
    if (locallyScoped && !context.upazilaCode && context.districtCode && source.districtCode !== context.districtCode) return false;
    return true;
  });
  const ranked = eligiblePool.map((source) => {
    const haystack = sourceText(source);
    const termScore = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 2 : 0), 0);
    const pathwayScore = source.pathwayCategory && requestedPathways.has(source.pathwayCategory) ? 8 : 0;
    const locationScore = context.upazilaCode && source.upazilaCode === context.upazilaCode ? 10 : context.districtCode && source.districtCode === context.districtCode ? 5 : 0;
    const kindScore = scholarshipIntent && source.kind === "SCHOLARSHIP" ? 10 : deadlineIntent && source.kind === "CIRCULAR" ? 10 : 0;
    return { source, score: termScore + pathwayScore + locationScore + kindScore };
  }).sort((a, b) => b.score - a.score);

  if (requestedConcepts.length > 1) {
    const comparisonSources = requestedConcepts.flatMap((concept) => ranked
      .filter(({ source }) => Boolean(source.pathwayCategory && concept.pathways.includes(source.pathwayCategory as never)))
      .slice(0, 4)
      .map(({ source }) => source));
    const balanced = uniqueSources(comparisonSources);
    if (balanced.length >= requestedConcepts.length) return balanced.slice(0, 10);
  }

  return ranked.filter((item) => item.score > 0 || requestedPathways.size > 0 || deadlineIntent || scholarshipIntent || locallyScoped).slice(0, 10).map((item) => item.source);
}

function demoAnswer(question: string, sources: KnowledgeSource[]) {
  const lower = question.toLowerCase();
  const lead = lower.includes("deadline") || lower.includes("শেষ") || lower.includes("তারিখ")
    ? "উপলভ্য verified circular অনুযায়ী গুরুত্বপূর্ণ সময়সীমাগুলো নিচে দিলাম।"
    : lower.includes("fee") || lower.includes("খরচ") || lower.includes("ফি")
      ? "Official-source records থেকে পাওয়া application fee ও সংশ্লিষ্ট তথ্য নিচে দেওয়া হলো।"
      : lower.includes("eligible") || lower.includes("যোগ্য") || lower.includes("gpa")
        ? "Eligibility নির্ধারণে GPA-এর পাশাপাশি group, subject requirement এবং সর্বশেষ circular মিলিয়ে দেখা জরুরি।"
        : "তোমার প্রশ্নের সঙ্গে সবচেয়ে কাছাকাছি verified EduPath records থেকে একটি action-oriented উত্তর তৈরি করেছি।";
  const facts = sources.map((source, index) => `${index + 1}. ${source.title}: ${source.detail}`).join("\n");
  return `${lead}\n\n${facts}\n\nপরবর্তী কাজ: পছন্দের option shortlist করো, eligibility checker চালাও এবং আবেদন করার আগে linked official source একবার খুলে যাচাই করো।`;
}

async function askGemini(question: string, sources: KnowledgeSource[], context: AssistantContext) {
  const recordsContext = sources.map((source) => `[${source.id}] ${source.title}\n${source.detail}\nURL: ${source.url}`).join("\n\n");
  const profileContext = JSON.stringify(context);
  const prompt = `You are EduPath BD, an education, admission and career guidance assistant for Bangladeshi students. Answer the exact question in clear Bangla with familiar English education terms. Use only the supplied records and the supplied student context. Never broaden a local SSC query beyond its selected upazila/district. For HSC, rank suitable nationwide options unless the student explicitly chose a local scope. Do not invent institutions, dates, fees, rankings, eligibility rules or links. Distinguish confirmed eligibility from records that still need a current admission rule. If the records are insufficient, say exactly what is missing. End with a short next-action checklist and cite record IDs in square brackets.\n\nSTUDENT CONTEXT:\n${profileContext}\n\nQUESTION:\n${question}\n\nVERIFIED RECORDS:\n${recordsContext}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": config.geminiApiKey! },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 700 } }),
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new GeminiRequestError("http_error", response.status);
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!answer) throw new GeminiRequestError("empty_answer");
  return answer;
}

class GeminiRequestError extends Error {
  constructor(readonly category: "http_error" | "empty_answer", readonly status?: number) {
    super(category);
    this.name = "GeminiRequestError";
  }
}

function logGeminiFallback(error: unknown) {
  const event = {
    level: "warn",
    event: "ai.gemini_fallback",
    model: config.geminiModel,
    category: error instanceof GeminiRequestError ? error.category : error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "unexpected",
    ...(error instanceof GeminiRequestError && error.status ? { status: error.status } : {})
  };
  console.warn(JSON.stringify(event));
}

export async function answerEducationQuestion(question: string, allSources: KnowledgeSource[], context: AssistantContext = {}): Promise<AssistantResult> {
  const sources = selectRelevantSources(question, allSources, context);
  const safetyNotice = "AI guidance is informational. Always verify dates, fees and eligibility from the linked official source before applying.";
  if (!sources.length) {
    return { answer: "এই প্রশ্নের উত্তর দেওয়ার মতো verified EduPath record এখনো নেই। Admin panel থেকে official source-সহ data verify করার পর আবার চেষ্টা করো।", mode: "fallback", model: "source-aware-fallback-v1", sources: [], safetyNotice };
  }
  if (!config.geminiApiKey) {
    return { answer: demoAnswer(question, sources), mode: "demo", model: "source-aware-demo-v1", sources, safetyNotice };
  }
  try {
    return { answer: await askGemini(question, sources, context), mode: "gemini", model: config.geminiModel, sources, safetyNotice };
  } catch (error) {
    logGeminiFallback(error);
    return { answer: demoAnswer(question, sources), mode: "fallback", model: "source-aware-fallback-v1", sources, safetyNotice };
  }
}
