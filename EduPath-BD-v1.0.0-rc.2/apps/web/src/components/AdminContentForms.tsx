import { useEffect, useState } from "react";
import { CalendarPlus, Film, GraduationCap, LoaderCircle } from "lucide-react";
import { apiRequest } from "../lib/api";
import { DatePickerInput } from "./DatePickerInput";
import type { Institution } from "../types/catalog";

type Props = { token: string; refreshKey: number; onCreated: () => void };
type FormMode = "program" | "circular" | "media";

const emptyProgram = { institutionId: "", name: "", slug: "", level: "Undergraduate", durationMonths: "48", tuitionMin: "", tuitionMax: "", careerOutcomes: "" };
const emptyCircular = { institutionId: "", title: "", academicSession: "2026-27", applicationStartsAt: "", applicationEndsAt: "", examAt: "", applicationFee: "", sourceUrl: "" };
const emptyMedia = { institutionId: "", type: "YOUTUBE" as "YOUTUBE" | "AUDIO", title: "", url: "", languageCode: "" as "" | "en" | "bn" };

export function AdminContentForms({ token, refreshKey, onCreated }: Props) {
  const [mode, setMode] = useState<FormMode>("program");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [program, setProgram] = useState(emptyProgram);
  const [circular, setCircular] = useState(emptyCircular);
  const [media, setMedia] = useState(emptyMedia);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const tuitionRangeInvalid = Boolean(program.tuitionMin && program.tuitionMax && Number(program.tuitionMin) > Number(program.tuitionMax));
  const circularDateInvalid = Boolean(
    (circular.applicationStartsAt && circular.applicationEndsAt && circular.applicationStartsAt > circular.applicationEndsAt)
    || (circular.examAt && circular.applicationEndsAt && circular.examAt < circular.applicationEndsAt)
  );

  useEffect(() => {
    apiRequest<{ data: Array<{ id: string; title: string }> }>("/api/admin/content?kind=INSTITUTION", { token }).then((result) => {
      const allInstitutions = result.data.map((item) => ({ id: item.id, name: item.title })) as Institution[];
      setInstitutions(allInstitutions);
      const firstId = allInstitutions[0]?.id ?? "";
      setProgram((current) => ({ ...current, institutionId: current.institutionId || firstId }));
      setCircular((current) => ({ ...current, institutionId: current.institutionId || firstId }));
      setMedia((current) => ({ ...current, institutionId: current.institutionId || firstId }));
    }).catch((error: Error) => setMessage(error.message));
  }, [refreshKey, token]);

  const setProgramName = (name: string) => setProgram((current) => ({ ...current, name, slug: name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") }));

  const createProgram = async () => {
    setBusy(true); setMessage("");
    try {
      await apiRequest("/api/admin/programs", { method: "POST", token, body: JSON.stringify({ institutionId: program.institutionId, name: program.name, slug: program.slug, level: program.level, ...(program.durationMonths ? { durationMonths: Number(program.durationMonths) } : {}), ...(program.tuitionMin ? { tuitionMin: Number(program.tuitionMin) } : {}), ...(program.tuitionMax ? { tuitionMax: Number(program.tuitionMax) } : {}), careerOutcomes: program.careerOutcomes.split(",").map((item) => item.trim()).filter(Boolean) }) });
      setProgram({ ...emptyProgram, institutionId: program.institutionId });
      setMessage("Program saved as a draft for verification.");
      onCreated();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create program"); }
    finally { setBusy(false); }
  };

  const createCircular = async () => {
    setBusy(true); setMessage("");
    try {
      await apiRequest("/api/admin/circulars", { method: "POST", token, body: JSON.stringify({ institutionId: circular.institutionId, title: circular.title, academicSession: circular.academicSession, ...(circular.applicationStartsAt ? { applicationStartsAt: circular.applicationStartsAt } : {}), applicationEndsAt: circular.applicationEndsAt, ...(circular.examAt ? { examAt: circular.examAt } : {}), ...(circular.applicationFee ? { applicationFee: Number(circular.applicationFee) } : {}), sourceUrl: circular.sourceUrl }) });
      setCircular({ ...emptyCircular, institutionId: circular.institutionId });
      setMessage("Circular saved as pending verification.");
      onCreated();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create circular"); }
    finally { setBusy(false); }
  };

  const createMedia = async () => {
    setBusy(true); setMessage("");
    try {
      await apiRequest("/api/admin/media", { method: "POST", token, body: JSON.stringify({
        ...(media.institutionId ? { institutionId: media.institutionId } : {}),
        type: media.type,
        title: media.title,
        url: media.url,
        ...(media.languageCode ? { languageCode: media.languageCode } : {})
      }) });
      setMedia({ ...emptyMedia, institutionId: media.institutionId });
      setMessage("Media resource saved as pending. Verify it before students can see it.");
      onCreated();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create media resource"); }
    finally { setBusy(false); }
  };

  return <section className="mt-7 rounded-[1.7rem] border border-slate-200 bg-white p-5 sm:p-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">{mode === "program" ? <GraduationCap size={20} /> : mode === "circular" ? <CalendarPlus size={20} /> : <Film size={20} />}</span><div><h3 className="text-xl font-black">Academic content</h3><p className="mt-1 text-xs leading-5 text-slate-500">Programs, circulars and institution media enter a review workflow before students can see them.</p></div></div><div className="flex max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1 text-xs font-black" role="tablist" aria-label="Academic content type">{(["program", "circular", "media"] as FormMode[]).map((value) => <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => { setMode(value); setMessage(""); }} className={`min-h-11 rounded-lg px-4 py-2 capitalize ${mode === value ? "bg-white shadow-sm" : "text-slate-500"}`}>{value}</button>)}</div></div>

    {mode === "program" ? <div className="mt-6 grid gap-4 md:grid-cols-2">
      <AdminField label="Institution"><select value={program.institutionId} onChange={(event) => setProgram({ ...program, institutionId: event.target.value })}>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></AdminField>
      <AdminField label="Program name"><input value={program.name} onChange={(event) => setProgramName(event.target.value)} placeholder="Computer Science and Engineering" /></AdminField>
      <AdminField label="URL slug"><input value={program.slug} onChange={(event) => setProgram({ ...program, slug: event.target.value })} placeholder="computer-science-engineering" /></AdminField>
      <AdminField label="Level"><select value={program.level} onChange={(event) => setProgram({ ...program, level: event.target.value })}><option>Undergraduate</option><option>Diploma</option><option>Certificate</option><option>Postgraduate</option></select></AdminField>
      <AdminField label="Duration in months"><input type="number" min="1" value={program.durationMonths} onChange={(event) => setProgram({ ...program, durationMonths: event.target.value })} /></AdminField>
      <AdminField label="Career outcomes (comma separated)"><input value={program.careerOutcomes} onChange={(event) => setProgram({ ...program, careerOutcomes: event.target.value })} placeholder="Software Engineer, Data Analyst" /></AdminField>
      <AdminField label="Minimum tuition"><input type="number" min="0" value={program.tuitionMin} onChange={(event) => setProgram({ ...program, tuitionMin: event.target.value })} placeholder="0" /></AdminField>
      <AdminField label="Maximum tuition"><input type="number" min={program.tuitionMin || "0"} value={program.tuitionMax} onChange={(event) => setProgram({ ...program, tuitionMax: event.target.value })} placeholder="100000" /></AdminField>
    </div> : mode === "circular" ? <div className="mt-6 grid gap-4 md:grid-cols-2">
      <AdminField label="Institution"><select value={circular.institutionId} onChange={(event) => setCircular({ ...circular, institutionId: event.target.value })}>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></AdminField>
      <AdminField label="Circular title"><input value={circular.title} onChange={(event) => setCircular({ ...circular, title: event.target.value })} placeholder="Undergraduate admission circular" /></AdminField>
      <AdminField label="Academic session"><input value={circular.academicSession} onChange={(event) => setCircular({ ...circular, academicSession: event.target.value })} /></AdminField>
      <AdminField label="Application fee"><input type="number" min="0" value={circular.applicationFee} onChange={(event) => setCircular({ ...circular, applicationFee: event.target.value })} placeholder="1000" /></AdminField>
      <AdminField label="Application starts"><DatePickerInput value={circular.applicationStartsAt} onChange={(value) => setCircular({ ...circular, applicationStartsAt: value })} ariaLabel="Application start date" /></AdminField>
      <AdminField label="Application deadline"><DatePickerInput value={circular.applicationEndsAt} min={circular.applicationStartsAt || undefined} onChange={(value) => setCircular({ ...circular, applicationEndsAt: value })} ariaLabel="Application deadline" /></AdminField>
      <AdminField label="Exam date (optional)"><DatePickerInput value={circular.examAt} min={circular.applicationEndsAt || undefined} onChange={(value) => setCircular({ ...circular, examAt: value })} ariaLabel="Exam date" /></AdminField>
      <AdminField label="Official source URL"><input type="url" value={circular.sourceUrl} onChange={(event) => setCircular({ ...circular, sourceUrl: event.target.value })} placeholder="https://..." /></AdminField>
    </div> : <div className="mt-6 grid gap-4 md:grid-cols-2">
      <AdminField label="Media scope"><select value={media.institutionId} onChange={(event) => setMedia({ ...media, institutionId: event.target.value })}><option value="">Global admission fallback</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></AdminField>
      <AdminField label="Resource type"><select value={media.type} onChange={(event) => setMedia({ ...media, type: event.target.value as "YOUTUBE" | "AUDIO", url: "" })}><option value="YOUTUBE">YouTube video</option><option value="AUDIO">Audio guide</option></select></AdminField>
      <AdminField label="Resource title"><input value={media.title} onChange={(event) => setMedia({ ...media, title: event.target.value })} placeholder="Official campus tour or admission briefing" /></AdminField>
      <AdminField label={media.type === "YOUTUBE" ? "YouTube URL" : "Direct HTTPS audio URL"}><input type="url" value={media.url} onChange={(event) => setMedia({ ...media, url: event.target.value })} placeholder={media.type === "YOUTUBE" ? "https://youtu.be/..." : "https://.../guidance.mp3"} /></AdminField>
      <AdminField label="Language"><select value={media.languageCode} onChange={(event) => setMedia({ ...media, languageCode: event.target.value as "" | "en" | "bn" })}><option value="">Language neutral</option><option value="bn">Bangla</option><option value="en">English</option></select></AdminField>
      <p className="text-xs leading-5 text-slate-500 md:col-span-2">Institution media overrides the global fallback. Only relevant, rights-safe resources from a trustworthy source should be submitted, and they remain hidden until verification.</p>
    </div>}
    {tuitionRangeInvalid && mode === "program" && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">Minimum tuition cannot exceed maximum tuition.</p>}
    {circularDateInvalid && mode === "circular" && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">Application and exam dates are not in a valid order.</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-700">{message}</p>}
    <button type="button" disabled={busy || tuitionRangeInvalid || circularDateInvalid || (mode === "program" ? !program.institutionId || !program.name || !program.slug : mode === "circular" ? !circular.institutionId || !circular.title || !circular.applicationEndsAt || !circular.sourceUrl : !media.title || !media.url)} onClick={mode === "program" ? createProgram : mode === "circular" ? createCircular : createMedia} className="mt-5 flex min-h-11 items-center gap-2 rounded-xl bg-[#071b2e] px-5 py-3 text-sm font-black text-white disabled:opacity-40">{busy ? <LoaderCircle className="animate-spin" size={17} /> : mode === "program" ? <GraduationCap size={17} /> : mode === "circular" ? <CalendarPlus size={17} /> : <Film size={17} />}Save {mode}</button>
  </section>;
}

function AdminField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="admin-field"><span>{label}</span>{children}</label>;
}
