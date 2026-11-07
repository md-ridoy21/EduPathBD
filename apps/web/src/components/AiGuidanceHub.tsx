import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bot, CheckCircle2, ExternalLink, FileText, LoaderCircle, Send, ShieldCheck, Sparkles } from "lucide-react";
import { apiRequest } from "../lib/api";
import { useLocale } from "../lib/locale";
import type { AppSession } from "../types/auth";
import type { Circular, Paginated } from "../types/catalog";

type GuidanceContext = { stage?: "SSC" | "HSC" | "DIPLOMA" | "UNDERGRADUATE" | "GRADUATE"; districtCode?: string; upazilaCode?: string; interests?: string[] };
type Props = { session: AppSession | null; onRequireAuth: () => void; guidanceContext?: GuidanceContext };
type AiSource = { id: string; title: string; detail: string; url: string; verified: boolean };
type AiResult = { answer: string; mode: "gemini" | "demo" | "fallback"; model: string; sources: AiSource[]; safetyNotice: string };

export function AiGuidanceHub({ session, onRequireAuth, guidanceContext }: Props) {
  const { text } = useLocale();
  const quickQuestions = [
    text("With GPA 4.80 in Science, which pathways should I explore?", "আমার GPA 4.80, Science থেকে কোন pathway দেখতে পারি?"),
    text("Show the upcoming admission deadlines and application fees.", "সামনের admission deadline ও application fee গুলো বলো।"),
    text("How should I choose between engineering and diploma pathways?", "Engineering আর diploma pathway-এর মধ্যে কীভাবে সিদ্ধান্ত নেব?")
  ];
  const [question, setQuestion] = useState(quickQuestions[0]);
  const [result, setResult] = useState<AiResult | null>(null);
  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [circularId, setCircularId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiRequest<Paginated<Circular>>("/api/circulars?limit=8").then((payload) => {
      setCirculars(payload.data);
      setCircularId(payload.data[0]?.id ?? "");
    }).catch(() => undefined);
  }, []);

  const ask = async () => {
    if (!session) { onRequireAuth(); return; }
    if (question.trim().length < 5) return;
    setBusy(true); setMessage("");
    try { setResult(await apiRequest<AiResult>("/api/ai/ask", { method: "POST", token: session.token, body: JSON.stringify({ question, context: guidanceContext }) })); }
    catch (error) { setMessage(error instanceof Error ? error.message : "AI guidance is unavailable"); }
    finally { setBusy(false); }
  };

  const summarize = async () => {
    if (!session) { onRequireAuth(); return; }
    if (!circularId) return;
    setBusy(true); setMessage("");
    try { setResult(await apiRequest<AiResult>(`/api/ai/circulars/${circularId}/summary`, { method: "POST", token: session.token })); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not summarize circular"); }
    finally { setBusy(false); }
  };

  return <section id="ai-guide" className="bg-[#071b2e] py-16 text-white lg:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
      <div><span className="inline-flex items-center gap-2 rounded-full bg-violet-400/10 px-3 py-2 text-xs font-black text-violet-200"><Sparkles size={14} /> {text("Source-aware generative AI", "উৎস-সচেতন জেনারেটিভ AI")}</span><h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">{text("Ask Edu AI, then verify the evidence", "Edu AI-কে জিজ্ঞাসা করুন, তারপর প্রমাণ যাচাই করুন")}</h2><p className="mt-4 text-sm leading-7 text-slate-300">{text("The assistant answers from EduPath’s labelled admission records and returns the exact records it used. It never replaces the official circular.", "সহকারী EduPath-এর লেবেলকৃত ভর্তি তথ্য থেকে উত্তর ও ব্যবহৃত নির্দিষ্ট উৎস দেখায়। এটি অফিসিয়াল সার্কুলারের বিকল্প নয়।")}</p>
        <div className="mt-7 grid gap-2">{quickQuestions.map((item) => <button type="button" key={item} onClick={() => setQuestion(item)} className="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs leading-5 text-slate-200 transition hover:border-violet-300/50 hover:bg-white/10">{item}</button>)}</div>
        <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4"><div className="flex items-center gap-2 text-xs font-black text-emerald-200"><ShieldCheck size={15} /> {text("Failure-safe demo", "নির্ভরযোগ্য ডেমো")}</div><p className="mt-2 text-[11px] leading-5 text-slate-300">{text("The classroom demo needs no key. A free Gemini key enables live generation; verified-record fallback stays usable if it is unavailable.", "ক্লাসরুম ডেমোতে key লাগে না। ফ্রি Gemini key দিলে live generation চালু হয়; না থাকলেও যাচাইকৃত তথ্যের fallback কাজ করে।")}</p></div>
      </div>

      <div className="rounded-[2rem] bg-white p-5 text-slate-950 shadow-2xl sm:p-7">
        <label className="block"><span className="text-xs font-black text-slate-600">{text("Your education or admission question", "আপনার শিক্ষা বা ভর্তি বিষয়ক প্রশ্ন")}</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 outline-none focus:border-violet-500" /></label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row"><button type="button" disabled={busy || question.trim().length < 5} onClick={ask} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white disabled:opacity-40">{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />} {text("Ask Edu AI", "Edu AI-কে জিজ্ঞাসা করুন")}</button><div className="flex flex-1 gap-2"><select aria-label={text("Select circular", "সার্কুলার নির্বাচন")} value={circularId} onChange={(event) => setCircularId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none">{circulars.map((item) => <option key={item.id} value={item.id}>{item.institutionName}</option>)}</select><button type="button" aria-label={text("Summarize circular", "সার্কুলারের সারাংশ")} disabled={busy || !circularId} onClick={summarize} title={text("Summarize circular", "সার্কুলারের সারাংশ")} className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-900 text-white disabled:opacity-40"><FileText size={18} /></button></div></div>
        {message && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{message}</p>}
        {!result ? <div className="mt-6 grid min-h-52 place-items-center rounded-2xl bg-slate-50 text-center"><div><Bot className="mx-auto text-violet-600" size={34} /><p className="mt-3 text-sm font-black">{text("Your cited answer will appear here", "উৎসসহ উত্তর এখানে দেখাবে")}</p><p className="mt-1 text-xs text-slate-500">{text("Sign in with student_demo for the key-free demo.", "key ছাড়া ডেমোর জন্য student_demo দিয়ে সাইন ইন করুন।")}</p></div></div> : <motion.div aria-live="polite" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/50 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-violet-700"><CheckCircle2 size={13} /> {result.mode} · {result.model}</span><span className="text-[10px] text-slate-400">{text(`${result.sources.length} cited records`, `${result.sources.length}টি উদ্ধৃত রেকর্ড`)}</span></div><div className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-700">{result.answer}</div><div className="mt-5 grid gap-2">{result.sources.map((source) => <div key={source.id} className="rounded-xl border border-white bg-white p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black">{source.title}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{source.detail}</p></div>{source.verified && <CheckCircle2 className="shrink-0 text-emerald-600" size={15} />}</div>{source.url && <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 text-[10px] font-black text-teal-700">{text("Official source", "অফিসিয়াল উৎস")} <ExternalLink size={11} /></a>}</div>)}</div><p className="mt-4 border-t border-violet-100 pt-3 text-[10px] leading-4 text-slate-500">{result.safetyNotice}</p></motion.div>}
      </div>
    </div>
  </div></section>;
}
