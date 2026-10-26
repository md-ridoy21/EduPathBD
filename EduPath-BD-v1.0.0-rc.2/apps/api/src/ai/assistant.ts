import { config } from "../config.js";

export type KnowledgeSource = {
  id: string;
  title: string;
  detail: string;
  url: string;
  verified: boolean;
};

export type AssistantResult = {
  answer: string;
  mode: "gemini" | "demo" | "fallback";
  model: string;
  sources: KnowledgeSource[];
  safetyNotice: string;
};

const sourceConcepts = [
  ["diploma", "polytechnic", "technical", "vocational", "ডিপ্লোমা", "পলিটেকনিক", "কারিগরি"],
  ["engineering", "engineer", "cse", "eee", "civil", "ইঞ্জিনিয়ারিং", "ইঞ্জিনিয়ারিং", "প্রকৌশল"],
  ["university", "undergraduate", "honours", "বিশ্ববিদ্যালয়", "বিশ্ববিদ্যালয়", "স্নাতক"],
  ["medical", "mbbs", "medicine", "মেডিকেল", "চিকিৎসা"]
] as const;

function sourceText(source: KnowledgeSource) {
  return `${source.title} ${source.detail}`.toLowerCase();
}

function uniqueSources(sources: KnowledgeSource[]) {
  return [...new Map(sources.map((source) => [source.id, source])).values()];
}

export function selectRelevantSources(question: string, sources: KnowledgeSource[]) {
  const normalizedQuestion = question.toLowerCase();
  const terms = normalizedQuestion.split(/[^a-z0-9\u0980-\u09ff]+/).filter((term) => term.length > 2);
  const ranked = sources.map((source) => {
    const haystack = sourceText(source);
    return { source, score: terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0) };
  }).sort((a, b) => b.score - a.score);

  const requestedConcepts = sourceConcepts.filter((aliases) => aliases.some((alias) => normalizedQuestion.includes(alias)));
  if (requestedConcepts.length > 1) {
    const comparisonSources = requestedConcepts.flatMap((aliases) => ranked
      .filter(({ source }) => aliases.some((alias) => sourceText(source).includes(alias)))
      .slice(0, 2)
      .map(({ source }) => source));
    const balanced = uniqueSources(comparisonSources);
    if (balanced.length >= requestedConcepts.length) return balanced.slice(0, 5);
  }

  const matches = ranked.filter((item) => item.score > 0).slice(0, 5).map((item) => item.source);
  return matches.length ? matches : sources.slice(0, 4);
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

async function askGemini(question: string, sources: KnowledgeSource[]) {
  const context = sources.map((source) => `[${source.id}] ${source.title}\n${source.detail}\nURL: ${source.url}`).join("\n\n");
  const prompt = `You are EduPath BD, an education, admission and career guidance assistant for Bangladeshi students. Answer in clear Bangla with familiar English education terms. Use only the supplied records. Do not invent dates, fees, eligibility rules or links. If the records are insufficient, say so. End with a short next-action checklist and cite record IDs in square brackets.\n\nQUESTION:\n${question}\n\nVERIFIED OR LABELLED RECORDS:\n${context}`;
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

export async function answerEducationQuestion(question: string, allSources: KnowledgeSource[]): Promise<AssistantResult> {
  const sources = selectRelevantSources(question, allSources);
  const safetyNotice = "AI guidance is informational. Always verify dates, fees and eligibility from the linked official source before applying.";
  if (!sources.length) {
    return { answer: "এই প্রশ্নের উত্তর দেওয়ার মতো verified EduPath record এখনো নেই। Admin panel থেকে official source-সহ data verify করার পর আবার চেষ্টা করো।", mode: "fallback", model: "source-aware-fallback-v1", sources: [], safetyNotice };
  }
  if (!config.geminiApiKey) {
    return { answer: demoAnswer(question, sources), mode: "demo", model: "source-aware-demo-v1", sources, safetyNotice };
  }
  try {
    return { answer: await askGemini(question, sources), mode: "gemini", model: config.geminiModel, sources, safetyNotice };
  } catch (error) {
    logGeminiFallback(error);
    return { answer: demoAnswer(question, sources), mode: "fallback", model: "source-aware-fallback-v1", sources, safetyNotice };
  }
}
