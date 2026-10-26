import { useEffect, useState } from "react";
import { Award, Bell, Bookmark, CheckCircle2, ExternalLink, LoaderCircle, Search } from "lucide-react";
import { apiRequest } from "../lib/api";
import { enableDeadlineReminder } from "../lib/reminders";
import { useLocale } from "../lib/locale";
import type { Paginated } from "../types/catalog";

type Scholarship = {
  id: string;
  title: string;
  provider: string;
  description?: string;
  institutionName?: string;
  programName?: string;
  minimumGpa?: number;
  groups: string[];
  levels: string[];
  amountDescription?: string;
  deadline?: string;
  sourceUrl: string;
  verified: boolean;
};

const savedKey = "edupath_saved_scholarships";

function readSaved() {
  try { return JSON.parse(localStorage.getItem(savedKey) || "[]") as string[]; }
  catch { return []; }
}

export function ScholarshipHub() {
  const { localeCode, text } = useLocale();
  const [level, setLevel] = useState("HSC");
  const [group, setGroup] = useState("Science");
  const [gpa, setGpa] = useState("4.80");
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [saved, setSaved] = useState<string[]>(readSaved);
  const [busy, setBusy] = useState(false);
  const [reminderBusy, setReminderBusy] = useState("");
  const [message, setMessage] = useState("");

  const findMatches = async () => {
    const numericGpa = Number(gpa);
    if (!Number.isFinite(numericGpa) || numericGpa < 0 || numericGpa > 5) { setMessage(text("Enter a GPA between 0 and 5.", "০ থেকে ৫-এর মধ্যে GPA দিন।")); return; }
    setBusy(true); setMessage("");
    try {
      const params = new URLSearchParams({ level, group, gpa: String(numericGpa), limit: "12" });
      const result = await apiRequest<Paginated<Scholarship>>(`/api/scholarships?${params}`);
      setScholarships(result.data);
      if (!result.data.length) setMessage(text("No current verified scholarship matched these filters.", "বর্তমান যাচাইকৃত কোনো scholarship এই filter-এর সাথে মেলেনি।"));
    } catch (error) { setMessage(error instanceof Error ? error.message : text("Could not load scholarships.", "Scholarship লোড করা যায়নি।")); }
    finally { setBusy(false); }
  };

  useEffect(() => { void findMatches(); }, []);

  const toggleSaved = (id: string) => {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [id, ...saved];
    setSaved(next);
    localStorage.setItem(savedKey, JSON.stringify(next));
  };

  const remind = async (scholarship: Scholarship) => {
    if (!scholarship.deadline) return;
    setReminderBusy(scholarship.id); setMessage("");
    try {
      const mode = await enableDeadlineReminder({ id: `scholarship-${scholarship.id}`, title: scholarship.title, institution: scholarship.provider, deadline: scholarship.deadline });
      setMessage(mode === "notification" ? text("Scholarship notification scheduled.", "Scholarship notification নির্ধারিত হয়েছে।") : text("Scholarship reminder saved in the app.", "Scholarship reminder অ্যাপে সেভ হয়েছে।"));
    } catch (error) { setMessage(error instanceof Error ? error.message : text("Could not save this reminder.", "রিমাইন্ডারটি সেভ করা যায়নি।")); }
    finally { setReminderBusy(""); }
  };

  return <section id="scholarships" className="scroll-mt-28 bg-amber-50/60 py-16 lg:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div className="max-w-2xl"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-amber-700"><Award size={16} />{text("Scholarship matching", "Scholarship matching")}</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{text("Find verified funding opportunities", "যাচাইকৃত আর্থিক সহায়তা খুঁজুন")}</h2><p className="mt-4 text-sm leading-7 text-slate-600">{text("Match current scholarship records by stage, academic group and GPA, then verify the linked official source.", "শিক্ষাস্তর, বিভাগ ও GPA অনুযায়ী বর্তমান scholarship মিলিয়ে official source যাচাই করুন।")}</p></div>
    <div className="mt-8 grid gap-3 rounded-[1.7rem] border border-amber-200 bg-white p-5 sm:grid-cols-4 sm:p-6"><label className="admin-field"><span>{text("Stage", "শিক্ষাস্তর")}</span><select value={level} onChange={(event) => setLevel(event.target.value)}><option value="SSC">SSC</option><option value="HSC">HSC</option><option value="UNDERGRADUATE">Undergraduate</option></select></label><label className="admin-field"><span>{text("Group", "বিভাগ")}</span><select value={group} onChange={(event) => setGroup(event.target.value)}><option>Science</option><option>Business Studies</option><option>Humanities</option><option>Vocational</option></select></label><label className="admin-field"><span>GPA</span><input type="number" min="0" max="5" step=".01" value={gpa} onChange={(event) => setGpa(event.target.value)} /></label><button type="button" disabled={busy} onClick={findMatches} className="mt-auto flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071b2e] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Search size={17} />}{text("Match scholarships", "Scholarship মিলান")}</button></div>
    {reminderBusy && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-3 text-xs font-bold text-amber-900"><LoaderCircle className="animate-spin" size={15} />{text("Saving scholarship reminder…", "Scholarship reminder সেভ হচ্ছে…")}</p>}
    {message && <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-white px-4 py-3 text-xs text-slate-700">{message}</p>}
    <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{scholarships.map((item) => <article key={item.id} className="rounded-[1.5rem] border border-amber-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Award size={21} /></span><button type="button" onClick={() => toggleSaved(item.id)} aria-label={saved.includes(item.id) ? text("Remove saved scholarship", "সেভ করা scholarship সরান") : text("Save scholarship", "Scholarship সেভ করুন")} className={`grid size-11 place-items-center rounded-xl ${saved.includes(item.id) ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500"}`}><Bookmark size={17} fill={saved.includes(item.id) ? "currentColor" : "none"} /></button></div><p className="mt-4 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700"><CheckCircle2 size={13} />{text("Verified source", "যাচাইকৃত উৎস")}</p><h3 className="mt-2 text-lg font-black">{item.title}</h3><p className="mt-1 text-xs font-bold text-amber-700">{item.provider}</p>{item.description && <p className="mt-3 text-xs leading-5 text-slate-600">{item.description}</p>}<div className="mt-4 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400">{text("Minimum GPA", "ন্যূনতম GPA")}</span><strong className="mt-1 block text-sm text-slate-800">{item.minimumGpa ?? text("Not listed", "উল্লেখ নেই")}</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400">{text("Deadline", "ডেডলাইন")}</span><strong className="mt-1 block text-sm text-slate-800">{item.deadline ? new Date(item.deadline).toLocaleDateString(localeCode, { day: "numeric", month: "short" }) : text("Ongoing", "চলমান")}</strong></div></div>{item.amountDescription && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">{item.amountDescription}</p>}<div className="mt-4 flex flex-wrap gap-3"><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-xs font-black text-teal-700"><ExternalLink size={14} />{text("Official source", "অফিসিয়াল উৎস")}</a>{item.deadline && <button type="button" onClick={() => remind(item)} className="inline-flex min-h-11 items-center gap-1 text-xs font-black text-amber-700"><Bell size={14} />{text("Remind me", "মনে করান")}</button>}</div></article>)}</div>
  </div></section>;
}
