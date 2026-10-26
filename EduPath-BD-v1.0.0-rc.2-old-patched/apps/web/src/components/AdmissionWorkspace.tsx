import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Bell, Building2, CalendarDays, Check, CheckCircle2, ExternalLink, GitCompareArrows, GraduationCap, Heart, ListChecks, LoaderCircle, MapPin, Search, ShieldCheck, Trash2 } from "lucide-react";
import { apiRequest } from "../lib/api";
import { DatePickerInput } from "./DatePickerInput";
import { StudentProgressReport } from "./StudentProgressReport";
import { enableDeadlineReminder, getReminderIds } from "../lib/reminders";
import { useLocale } from "../lib/locale";
import type { AppSession } from "../types/auth";
import type { Circular, Institution, Paginated, Program, StudentApplication } from "../types/catalog";

type Props = { session: AppSession | null; refreshKey: number; onRequireAuth: () => void };
type WorkspaceTab = "discover" | "compare" | "plan";

const institutionTypes = [
  ["", "All institution types"], ["PUBLIC_UNIVERSITY", "Public university"], ["PRIVATE_UNIVERSITY", "Private university"], ["ENGINEERING", "Engineering"], ["MEDICAL", "Medical"], ["NATIONAL_UNIVERSITY_COLLEGE", "National University"], ["POLYTECHNIC", "Polytechnic"], ["TRAINING_PROVIDER", "Skills & training"]
];

const statuses = ["INTERESTED", "DOCUMENTS_PENDING", "READY_TO_APPLY", "APPLIED", "ADMIT_CARD_RECEIVED", "EXAM_COMPLETED", "RESULT_PUBLISHED", "SELECTED", "NOT_SELECTED"];
const statusBangla: Record<string, string> = {
  INTERESTED: "আগ্রহী",
  DOCUMENTS_PENDING: "ডকুমেন্ট বাকি",
  READY_TO_APPLY: "আবেদনের জন্য প্রস্তুত",
  APPLIED: "আবেদন সম্পন্ন",
  ADMIT_CARD_RECEIVED: "প্রবেশপত্র পাওয়া গেছে",
  EXAM_COMPLETED: "পরীক্ষা সম্পন্ন",
  RESULT_PUBLISHED: "ফল প্রকাশিত",
  SELECTED: "নির্বাচিত",
  NOT_SELECTED: "নির্বাচিত হয়নি"
};
const typeBangla: Record<string, string> = {
  PUBLIC_UNIVERSITY: "সরকারি বিশ্ববিদ্যালয়",
  PRIVATE_UNIVERSITY: "বেসরকারি বিশ্ববিদ্যালয়",
  ENGINEERING: "প্রকৌশল",
  MEDICAL: "মেডিকেল",
  NATIONAL_UNIVERSITY_COLLEGE: "জাতীয় বিশ্ববিদ্যালয় কলেজ",
  POLYTECHNIC: "পলিটেকনিক",
  TRAINING_PROVIDER: "দক্ষতা ও প্রশিক্ষণ"
};

function friendlyType(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function localizedType(value: string, bangla: boolean) {
  return bangla ? typeBangla[value] ?? friendlyType(value) : friendlyType(value);
}

function money(value?: number) {
  if (value === undefined) return "Not listed";
  return `৳${value.toLocaleString("en-BD")}`;
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AdmissionWorkspace({ session, refreshKey, onRequireAuth }: Props) {
  const { localeCode, text } = useLocale();
  const bangla = localeCode === "bn-BD";
  const [tab, setTab] = useState<WorkspaceTab>("discover");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [district, setDistrict] = useState("");
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<Paginated<Institution> | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [dateFrom, setDateFrom] = useState(() => dateInputValue(new Date()));
  const [dateTo, setDateTo] = useState(() => { const date = new Date(); date.setDate(date.getDate() + 120); return dateInputValue(date); });
  const [comparison, setComparison] = useState<Institution[]>(() => {
    try { return JSON.parse(localStorage.getItem("edupath_compare") || "[]") as Institution[]; } catch { return []; }
  });
  const [shortlisted, setShortlisted] = useState<Institution[]>([]);
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [message, setMessage] = useState("");
  const [deadlineMessage, setDeadlineMessage] = useState("");
  const [reminderIds, setReminderIds] = useState<string[]>(getReminderIds);

  useEffect(() => localStorage.setItem("edupath_compare", JSON.stringify(comparison)), [comparison]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setMessage("");
      try {
        const params = new URLSearchParams({ page: String(page), limit: "4" });
        if (search) params.set("search", search);
        if (type) params.set("type", type);
        if (district) params.set("district", district);
        const programParams = new URLSearchParams({ search, limit: "6" });
        if (type) programParams.set("type", type);
        if (district) programParams.set("district", district);
        const [institutionsResult, programResult] = await Promise.all([
          apiRequest<Paginated<Institution>>(`/api/institutions?${params}`),
          apiRequest<Paginated<Program>>(`/api/programs?${programParams}`)
        ]);
        setCatalog(institutionsResult);
        setPrograms(programResult.data);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load admission catalog");
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, type, district, page, refreshKey]);

  useEffect(() => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      setCirculars([]);
      setDeadlineMessage(text("The start date must be before the end date.", "শুরুর তারিখ শেষের তারিখের আগে হতে হবে।"));
      return;
    }
    setDeadlineMessage("");
    const params = new URLSearchParams({ from: dateFrom, to: `${dateTo}T23:59:59.999Z`, limit: "8" });
    apiRequest<Paginated<Circular>>(`/api/circulars?${params}`).then((result) => setCirculars(result.data)).catch((error: Error) => setDeadlineMessage(error.message));
  }, [dateFrom, dateTo, refreshKey, text]);

  useEffect(() => {
    if (!session) {
      setShortlisted([]);
      setApplications([]);
      return;
    }
    Promise.all([
      apiRequest<{ data: Institution[] }>("/api/me/shortlist", { token: session.token }),
      apiRequest<{ data: StudentApplication[] }>("/api/me/applications", { token: session.token })
    ]).then(([saved, tracked]) => { setShortlisted(saved.data); setApplications(tracked.data); }).catch((error: Error) => setMessage(error.message));
  }, [session]);

  const visibleInstitutions = catalog?.data ?? [];
  const toggleCompare = (institution: Institution) => {
    setComparison((current) => {
      if (current.some((item) => item.id === institution.id)) {
        setMessage(text("Removed from comparison.", "তুলনা থেকে সরানো হয়েছে।"));
        return current.filter((item) => item.id !== institution.id);
      }
      if (current.length >= 3) {
        setMessage(text("You can compare up to three institutions. Remove one before adding another.", "সর্বোচ্চ তিনটি প্রতিষ্ঠান তুলনা করা যাবে। নতুনটি যোগ করতে আগে একটি সরান।"));
        return current;
      }
      setMessage(text("Added to comparison.", "তুলনায় যোগ হয়েছে।"));
      return [...current, institution];
    });
  };

  const toggleShortlist = async (institution: Institution) => {
    if (!session) { onRequireAuth(); return; }
    const saved = shortlisted.some((item) => item.id === institution.id);
    setActionBusy(`shortlist:${institution.id}`);
    try {
      await apiRequest(`/api/me/shortlist/${institution.id}`, { method: saved ? "DELETE" : "POST", token: session.token });
      setShortlisted((current) => saved ? current.filter((item) => item.id !== institution.id) : [institution, ...current]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update shortlist"); }
    finally { setActionBusy(""); }
  };

  const startTracking = async (program: Program) => {
    if (!session) { onRequireAuth(); return; }
    setActionBusy(`track:${program.id}`);
    try {
      const application = await apiRequest<StudentApplication>("/api/me/applications", { method: "POST", token: session.token, body: JSON.stringify({ programId: program.id }) });
      setApplications((current) => [application, ...current.filter((item) => item.id !== application.id)]);
      setTab("plan");
      document.querySelector("#institutions")?.scrollIntoView({ behavior: "smooth" });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not start application tracker"); }
    finally { setActionBusy(""); }
  };

  const updateStatus = async (applicationId: string, status: string) => {
    if (!session) return;
    setActionBusy(`status:${applicationId}`);
    try {
      const updated = await apiRequest<StudentApplication>(`/api/me/applications/${applicationId}/status`, { method: "PATCH", token: session.token, body: JSON.stringify({ status }) });
      setApplications((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(text("Application status updated.", "আবেদনের অবস্থা আপডেট হয়েছে।"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("Could not update application status.", "আবেদনের অবস্থা আপডেট করা যায়নি।"));
    } finally { setActionBusy(""); }
  };

  const toggleDocument = async (application: StudentApplication, documentId: string, completed: boolean) => {
    if (!session) return;
    setActionBusy(`document:${documentId}`);
    try {
      const updated = await apiRequest<StudentApplication>(`/api/me/applications/${application.id}/documents/${documentId}`, { method: "PATCH", token: session.token, body: JSON.stringify({ completed }) });
      setApplications((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(text("Document checklist updated.", "ডকুমেন্ট চেকলিস্ট আপডেট হয়েছে।"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("Could not update the checklist.", "চেকলিস্ট আপডেট করা যায়নি।"));
    } finally { setActionBusy(""); }
  };

  const remind = async (circular: Circular) => {
    setActionBusy(`reminder:${circular.id}`);
    try {
      const mode = await enableDeadlineReminder({ id: circular.id, title: circular.title, institution: circular.institutionName, deadline: circular.applicationEndsAt });
      setReminderIds((current) => current.includes(circular.id) ? current : [...current, circular.id]);
      setDeadlineMessage(mode === "notification" ? text("Deadline reminder saved and notification permission confirmed.", "ডেডলাইন রিমাইন্ডার ও নোটিফিকেশন চালু হয়েছে।") : text("Deadline reminder saved inside EduPath. Native notification is unavailable on this build.", "EduPath-এ রিমাইন্ডার সেভ হয়েছে; এই build-এ native notification পাওয়া যাচ্ছে না।"));
    } catch (error) {
      setDeadlineMessage(error instanceof Error ? error.message : text("Could not save this reminder.", "রিমাইন্ডারটি সেভ করা যায়নি।"));
    } finally { setActionBusy(""); }
  };

  const tabLabel = (item: WorkspaceTab) => item === "discover" ? text("Discover", "খুঁজুন") : item === "compare" ? text("Compare", "তুলনা") : text("Plan", "পরিকল্পনা");

  return <>
    <section id="institutions" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[.2em] text-teal-700">{text("Admission workspace", "অ্যাডমিশন ওয়ার্কস্পেস")}</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{text("Search, compare and build your plan", "খুঁজুন, তুলনা করুন ও পরিকল্পনা গড়ুন")}</h2><p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{text("Filter verified institutions, compare up to three choices, shortlist favourites and track every application step.", "যাচাইকৃত প্রতিষ্ঠান ফিল্টার করুন, তিনটি পর্যন্ত পছন্দ তুলনা করুন, শর্টলিস্ট ও আবেদনের প্রতিটি ধাপ ট্র্যাক করুন।")}</p></div><div className="flex rounded-xl bg-slate-200/70 p-1 text-xs font-black" role="tablist" aria-label={text("Admission workspace view", "অ্যাডমিশন ওয়ার্কস্পেস ভিউ")}>{(["discover", "compare", "plan"] as WorkspaceTab[]).map((item) => <button type="button" role="tab" aria-selected={tab === item} key={item} onClick={() => setTab(item)} className={`min-h-11 rounded-lg px-4 py-2.5 ${tab === item ? "bg-white text-teal-800 shadow-sm" : "text-slate-500"}`}>{tabLabel(item)}{item === "compare" && ` (${comparison.length})`}{item === "plan" && ` (${applications.length})`}</button>)}</div></div>

      {message && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{message}</p>}
      {actionBusy && <p role="status" aria-live="polite" className="mt-5 flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs font-bold text-cyan-900"><LoaderCircle className="animate-spin" size={15} />{text("Saving your change…", "আপনার পরিবর্তন সেভ হচ্ছে…")}</p>}

      <AnimatePresence mode="wait">
        {tab === "discover" && <motion.div key="discover" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <div className="mt-8 grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_180px]">
            <label className="catalog-input"><Search size={17} /><input aria-label={text("Search catalog", "ক্যাটালগ খুঁজুন")} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={text("Search institution, program or district", "প্রতিষ্ঠান, প্রোগ্রাম বা জেলা খুঁজুন")} /></label>
            <label className="catalog-input"><Building2 size={17} /><select aria-label={text("Institution type", "প্রতিষ্ঠানের ধরন")} value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>{institutionTypes.map(([value, label]) => <option key={value} value={value}>{value === "" ? text(label, "সব ধরনের প্রতিষ্ঠান") : label}</option>)}</select></label>
            <label className="catalog-input"><MapPin size={17} /><select aria-label={text("District", "জেলা")} value={district} onChange={(event) => { setDistrict(event.target.value); setPage(1); }}><option value="">{text("All districts", "সব জেলা")}</option><option>Dhaka</option><option>Chattogram</option><option>Rangpur</option><option>Gazipur</option></select></label>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {busy ? <div className="col-span-full grid min-h-48 place-items-center"><LoaderCircle className="animate-spin text-teal-700" /></div> : visibleInstitutions.map((institution) => {
              const saved = shortlisted.some((item) => item.id === institution.id);
              const compared = comparison.some((item) => item.id === institution.id);
              return <article key={institution.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-start justify-between gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#eaf7f5] font-black text-teal-800">{institution.name.split(" ").slice(0, 2).map((word) => word[0]).join("")}</span><div className="flex gap-2"><button type="button" aria-label={text(`Compare ${institution.name}`, `${institution.name} তুলনা করুন`)} onClick={() => toggleCompare(institution)} className={`grid size-11 place-items-center rounded-xl border ${compared ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200"}`} title={text("Compare", "তুলনা")}><GitCompareArrows size={16} /></button><button type="button" aria-label={text(`Shortlist ${institution.name}`, `${institution.name} শর্টলিস্ট করুন`)} onClick={() => toggleShortlist(institution)} className={`grid size-11 place-items-center rounded-xl border ${saved ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200"}`} title={text("Shortlist", "শর্টলিস্ট")}><Heart size={16} fill={saved ? "currentColor" : "none"} /></button></div></div><h3 className="mt-4 text-lg font-black leading-6">{institution.name}</h3><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{institution.description}</p><div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold"><span className="rounded-full bg-slate-100 px-3 py-1.5">{localizedType(institution.type, bangla)}</span><span className="rounded-full bg-slate-100 px-3 py-1.5">{institution.district}</span><span className="rounded-full bg-slate-100 px-3 py-1.5">{institution.programCount} {text("programs", "প্রোগ্রাম")}</span>{institution.verified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700"><ShieldCheck size={12} /> {text("Verified", "যাচাইকৃত")}</span>}</div>{(institution.websiteUrl || institution.sourceUrl) && <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">{institution.websiteUrl && <a href={institution.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-xs font-black text-teal-700">{text("Website", "ওয়েবসাইট")}<ExternalLink size={12} /></a>}{institution.sourceUrl && <a href={institution.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-xs font-black text-slate-600">{text("Official source", "অফিসিয়াল উৎস")}<ExternalLink size={12} /></a>}</div>}</article>;
            })}
          </div>
          {!busy && !visibleInstitutions.length && <div className="mt-6 rounded-2xl bg-slate-100 p-8 text-center text-sm text-slate-600">{text("No institution matched these filters.", "এই ফিল্টারে কোনো প্রতিষ্ঠান পাওয়া যায়নি।")}</div>}
          {(catalog?.pagination.pages ?? 0) > 1 && <div className="mt-6 flex items-center justify-center gap-3"><button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="pagination-button"><ArrowLeft size={16} /> {text("Previous", "আগের")}</button><span className="text-xs font-bold text-slate-500">{text(`Page ${page} of ${catalog?.pagination.pages}`, `পৃষ্ঠা ${page}/${catalog?.pagination.pages}`)}</span><button type="button" disabled={page === catalog?.pagination.pages} onClick={() => setPage((current) => current + 1)} className="pagination-button">{text("Next", "পরের")} <ArrowRight size={16} /></button></div>}

          <div className="mt-12 flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-teal-700">{text("Programs", "প্রোগ্রাম")}</p><h3 className="mt-2 text-2xl font-black">{text("Matching study options", "মিলে যাওয়া পড়াশোনার সুযোগ")}</h3></div><span className="text-xs text-slate-500">{text(`${programs.length} shown`, `${programs.length}টি দেখানো হয়েছে`)}</span></div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">{programs.map((program) => <article key={program.id} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-[10px] font-black uppercase tracking-wider text-teal-700">{program.institutionName}</p><h4 className="mt-1 font-black">{program.name}</h4><p className="mt-2 text-xs text-slate-500">{program.level} · {program.durationMonths ? text(`${program.durationMonths / 12} years`, `${program.durationMonths / 12} বছর`) : text("Flexible", "নমনীয়")} · GPA {program.minimumGpa || text("varies", "ভিন্ন হতে পারে")} · {money(program.tuitionMin)}–{money(program.tuitionMax)}</p></div><button type="button" onClick={() => startTracking(program)} className="min-h-11 rounded-xl bg-[#071b2e] px-4 py-2.5 text-xs font-black text-white">{text("Track application", "আবেদন ট্র্যাক করুন")}</button></article>)}</div>
          {!busy && !programs.length && <p className="mt-5 rounded-2xl bg-slate-100 p-6 text-center text-sm text-slate-600">{text("No program matched this search.", "এই অনুসন্ধানে কোনো প্রোগ্রাম পাওয়া যায়নি।")}</p>}
        </motion.div>}

        {tab === "compare" && <motion.div key="compare" className="mt-8" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {comparison.length ? <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50"><th className="p-4 text-xs uppercase text-slate-500">{text("Criteria", "মানদণ্ড")}</th>{comparison.map((item) => <th key={item.id} className="p-4"><div className="flex items-start justify-between gap-3"><span className="max-w-48 font-black">{item.name}</span><button type="button" aria-label={text("Remove comparison", "তুলনা থেকে সরান")} onClick={() => toggleCompare(item)} className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100"><Trash2 size={15} /></button></div></th>)}</tr></thead><tbody>{[[text("Location", "অবস্থান"), comparison.map((item) => item.district)], [text("Type", "ধরন"), comparison.map((item) => localizedType(item.type, bangla))], [text("Programs", "প্রোগ্রাম"), comparison.map((item) => String(item.programCount))], [text("Verification", "যাচাই"), comparison.map((item) => item.verified ? text("Verified source", "যাচাইকৃত উৎস") : text("Draft", "খসড়া"))]].map(([label, values]) => <tr key={String(label)} className="border-b border-slate-100 last:border-0"><th className="p-4 text-xs text-slate-500">{label as string}</th>{(values as string[]).map((value, index) => <td key={`${value}-${index}`} className="p-4 font-semibold">{value}</td>)}</tr>)}</tbody></table></div> : <EmptyState icon={<GitCompareArrows size={25} />} title={text("No choices selected", "কোনো পছন্দ নির্বাচন করা হয়নি")} text={text("Return to Discover and add up to three institutions to compare them side by side.", "খুঁজুন অংশে ফিরে তিনটি পর্যন্ত প্রতিষ্ঠান পাশাপাশি তুলনা করুন।")} />}
        </motion.div>}

        {tab === "plan" && <motion.div key="plan" className="mt-8 grid gap-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {session && <StudentProgressReport session={session} shortlisted={shortlisted} applications={applications} />}
          {!session ? <EmptyState icon={<ListChecks size={25} />} title={text("Sign in to build your application plan", "আবেদন পরিকল্পনা করতে সাইন ইন করুন")} text={text("Your shortlist, document checklist and progress will stay connected to your verified account.", "শর্টলিস্ট, ডকুমেন্ট চেকলিস্ট ও অগ্রগতি আপনার অ্যাকাউন্টে থাকবে।")} action={<button type="button" onClick={onRequireAuth} className="min-h-11 rounded-xl bg-[#071b2e] px-5 py-3 text-xs font-black text-white">{text("Sign in / Register", "সাইন ইন / নিবন্ধন")}</button>} /> : applications.length ? applications.map((application) => {
            const completed = application.documents.filter((document) => document.isCompleted).length;
            return <article key={application.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-start"><div><p className="text-[10px] font-black uppercase tracking-wider text-teal-700">{application.institutionName}</p><h3 className="mt-1 text-lg font-black">{application.programName}</h3><p className="mt-2 text-xs text-slate-500">{text(`Checklist ${completed}/${application.documents.length} complete`, `চেকলিস্ট ${completed}/${application.documents.length} সম্পন্ন`)}</p></div><label className="admin-field min-w-56"><span>{text("Application status", "আবেদনের অবস্থা")}</span><select value={application.status} onChange={(event) => updateStatus(application.id, event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{bangla ? statusBangla[status] ?? friendlyType(status) : friendlyType(status)}</option>)}</select></label></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${application.documents.length ? (completed / application.documents.length) * 100 : 0}%` }} /></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{application.documents.map((document) => <label key={document.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-3 text-xs font-bold ${document.isCompleted ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200"}`}><input type="checkbox" checked={document.isCompleted} onChange={(event) => toggleDocument(application, document.id, event.target.checked)} className="size-4 accent-teal-700" />{document.isCompleted ? <CheckCircle2 size={16} /> : <ListChecks size={16} />}{document.title}</label>)}</div></article>;
          }) : <EmptyState icon={<GraduationCap size={25} />} title={text("No application tracked yet", "এখনও কোনো আবেদন ট্র্যাক করা হয়নি")} text={text("Choose a program from Discover and select Track application to create its checklist.", "খুঁজুন থেকে একটি প্রোগ্রাম বেছে নিয়ে আবেদন ট্র্যাক করুন।")} />}
        </motion.div>}
      </AnimatePresence>
    </section>

    <section id="deadlines" className="bg-[#071b2e] py-16 text-white lg:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">{text("Deadline calendar", "ডেডলাইন ক্যালেন্ডার")}</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{text("Plan around important dates", "গুরুত্বপূর্ণ তারিখ ধরে পরিকল্পনা করুন")}</h2><p className="mt-4 text-sm leading-7 text-slate-300">{text("Filter circulars by application closing date and verify every official source.", "আবেদনের শেষ তারিখ দিয়ে সার্কুলার ফিল্টার ও অফিসিয়াল উৎস যাচাই করুন।")}</p></div><div className="grid grid-cols-2 gap-3"><label className="date-filter"><span>{text("From", "শুরু")}</span><DatePickerInput value={dateFrom} max={dateTo || undefined} onChange={setDateFrom} ariaLabel={text("Filter start date", "ফিল্টার শুরুর তারিখ")} dark /></label><label className="date-filter"><span>{text("To", "শেষ")}</span><DatePickerInput value={dateTo} min={dateFrom || undefined} onChange={setDateTo} ariaLabel={text("Filter end date", "ফিল্টার শেষের তারিখ")} dark /></label></div></div>{deadlineMessage && <p role="status" className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-xs text-amber-100">{deadlineMessage}</p>}<div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{circulars.map((circular) => { const days = Math.ceil((new Date(circular.applicationEndsAt).getTime() - Date.now()) / 86400000); return <article key={circular.id} className="rounded-[1.5rem] border border-white/10 bg-white/[.06] p-5"><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-cyan-300/10 px-3 py-1 text-[10px] font-black text-cyan-200">{circular.academicSession}</span>{circular.verified && <Check size={15} className="text-emerald-300" />}</div><h3 className="mt-5 font-black leading-6">{circular.institutionName}</h3><p className="mt-2 text-xs leading-5 text-slate-300">{circular.title}</p><div className="mt-5 border-t border-white/10 pt-4"><p className="flex items-center gap-2 text-sm font-bold"><CalendarDays size={16} /> {new Date(circular.applicationEndsAt).toLocaleDateString(localeCode, { day: "numeric", month: "short", year: "numeric" })}</p><p className={`mt-2 text-xs font-bold ${days < 0 ? "text-rose-300" : "text-emerald-300"}`}>{days < 0 ? text("Closed", "বন্ধ") : text(`${days} days remaining`, `${days} দিন বাকি`)}</p></div><div className="mt-4 flex flex-wrap gap-3"><a href={circular.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-cyan-200"><ExternalLink size={14} /> {text("Official source", "অফিসিয়াল উৎস")}</a><button type="button" disabled={days < 0} onClick={() => remind(circular)} className={`inline-flex min-h-11 items-center gap-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${reminderIds.includes(circular.id) ? "text-emerald-300" : "text-slate-300"}`}><Bell size={14} /> {reminderIds.includes(circular.id) ? text("Reminder on", "রিমাইন্ডার চালু") : text("Remind me", "মনে করান")}</button></div></article>; })}</div>{!deadlineMessage && !circulars.length && <p className="mt-8 rounded-2xl bg-white/5 p-8 text-center text-sm text-slate-300">{text("No deadline exists inside this date range.", "এই সময়সীমায় কোনো ডেডলাইন নেই।")}</p>}</div></section>
  </>;
}

function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return <div className="grid min-h-64 place-items-center rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center"><div className="max-w-sm"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-700">{icon}</span><h3 className="mt-4 text-lg font-black">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>{action && <div className="mt-5">{action}</div>}</div></div>;
}
