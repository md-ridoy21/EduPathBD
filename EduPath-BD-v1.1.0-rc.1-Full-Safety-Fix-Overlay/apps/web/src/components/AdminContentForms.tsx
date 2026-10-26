import { useEffect, useMemo, useState } from "react";
import { Award, CalendarPlus, ClipboardCheck, Film, GraduationCap, LoaderCircle } from "lucide-react";
import { apiRequest } from "../lib/api";
import { DatePickerInput } from "./DatePickerInput";

type Props = { token: string; refreshKey: number; onCreated: () => void };
type FormMode = "program" | "admission" | "circular" | "scholarship" | "media";
type Option = { id: string; title: string; subtitle?: string };

const emptyProgram = { institutionId: "", name: "", slug: "", level: "Undergraduate", durationMonths: "48", tuitionMin: "", tuitionMax: "", careerOutcomes: "" };
const emptyAdmission = { programId: "", academicSession: "2026-27", applicantStage: "HSC", allowedGroups: "Science", minimumSscGpa: "", minimumHscGpa: "", minimumCombinedGpa: "", additionalCriteria: "", sourceUrl: "" };
const emptyCircular = { institutionId: "", title: "", academicSession: "2026-27", applicationStartsAt: "", applicationEndsAt: "", examAt: "", applicationFee: "", sourceUrl: "" };
const emptyScholarship = { institutionId: "", programId: "", title: "", provider: "", minimumGpa: "", groups: "", levels: "HSC", amountDescription: "", deadline: "", sourceUrl: "" };
const emptyMedia = { institutionId: "", type: "YOUTUBE" as "YOUTUBE" | "AUDIO", title: "", url: "", languageCode: "" as "" | "en" | "bn" };

const csvList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export function AdminContentForms({ token, refreshKey, onCreated }: Props) {
  const [mode, setMode] = useState<FormMode>("program");
  const [institutions, setInstitutions] = useState<Option[]>([]);
  const [programs, setPrograms] = useState<Option[]>([]);
  const [program, setProgram] = useState(emptyProgram);
  const [admission, setAdmission] = useState(emptyAdmission);
  const [circular, setCircular] = useState(emptyCircular);
  const [scholarship, setScholarship] = useState(emptyScholarship);
  const [media, setMedia] = useState(emptyMedia);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest<{ data: Option[] }>("/api/admin/content?kind=INSTITUTION", { token }),
      apiRequest<{ data: Option[] }>("/api/admin/content?kind=PROGRAM", { token })
    ]).then(([institutionResult, programResult]) => {
      setInstitutions(institutionResult.data);
      setPrograms(programResult.data);
      const firstInstitution = institutionResult.data[0]?.id ?? "";
      const firstProgram = programResult.data[0]?.id ?? "";
      setProgram((current) => ({ ...current, institutionId: current.institutionId || firstInstitution }));
      setAdmission((current) => ({ ...current, programId: current.programId || firstProgram }));
      setCircular((current) => ({ ...current, institutionId: current.institutionId || firstInstitution }));
      setScholarship((current) => ({ ...current, institutionId: current.institutionId || firstInstitution }));
      setMedia((current) => ({ ...current, institutionId: current.institutionId || firstInstitution }));
    }).catch((error: Error) => setMessage(error.message));
  }, [refreshKey, token]);

  const programById = useMemo(() => new Map(programs.map((item) => [item.id, item])), [programs]);
  const tuitionRangeInvalid = Boolean(program.tuitionMin && program.tuitionMax && Number(program.tuitionMin) > Number(program.tuitionMax));
  const circularDateInvalid = Boolean((circular.applicationStartsAt && circular.applicationEndsAt && circular.applicationStartsAt > circular.applicationEndsAt) || (circular.examAt && circular.applicationEndsAt && circular.examAt < circular.applicationEndsAt));

  const setProgramName = (name: string) => setProgram((current) => ({ ...current, name, slug: name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") }));

  async function submit(url: string, body: unknown, success: string, reset: () => void) {
    setBusy(true); setMessage("");
    try {
      await apiRequest(url, { method: "POST", token, body: JSON.stringify(body) });
      reset(); setMessage(success); onCreated();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save content"); }
    finally { setBusy(false); }
  }

  const createProgram = () => submit("/api/admin/programs", {
    institutionId: program.institutionId, name: program.name, slug: program.slug, level: program.level,
    ...(program.durationMonths ? { durationMonths: Number(program.durationMonths) } : {}),
    ...(program.tuitionMin ? { tuitionMin: Number(program.tuitionMin) } : {}),
    ...(program.tuitionMax ? { tuitionMax: Number(program.tuitionMax) } : {}),
    careerOutcomes: csvList(program.careerOutcomes)
  }, "Program saved as a draft for verification.", () => setProgram({ ...emptyProgram, institutionId: program.institutionId }));

  const createAdmission = () => submit("/api/admin/admission-rules", {
    programId: admission.programId, academicSession: admission.academicSession, applicantStage: admission.applicantStage,
    allowedGroups: csvList(admission.allowedGroups),
    ...(admission.minimumSscGpa ? { minimumSscGpa: Number(admission.minimumSscGpa) } : {}),
    ...(admission.minimumHscGpa ? { minimumHscGpa: Number(admission.minimumHscGpa) } : {}),
    ...(admission.minimumCombinedGpa ? { minimumCombinedGpa: Number(admission.minimumCombinedGpa) } : {}),
    ...(admission.additionalCriteria ? { additionalCriteria: admission.additionalCriteria } : {}), sourceUrl: admission.sourceUrl
  }, "Admission rule saved as pending verification.", () => setAdmission({ ...emptyAdmission, programId: admission.programId }));

  const createCircular = () => submit("/api/admin/circulars", {
    institutionId: circular.institutionId, title: circular.title, academicSession: circular.academicSession,
    ...(circular.applicationStartsAt ? { applicationStartsAt: circular.applicationStartsAt } : {}), applicationEndsAt: circular.applicationEndsAt,
    ...(circular.examAt ? { examAt: circular.examAt } : {}), ...(circular.applicationFee ? { applicationFee: Number(circular.applicationFee) } : {}), sourceUrl: circular.sourceUrl
  }, "Circular saved as pending verification.", () => setCircular({ ...emptyCircular, institutionId: circular.institutionId }));

  const createScholarship = () => submit("/api/admin/scholarships", {
    ...(scholarship.institutionId ? { institutionId: scholarship.institutionId } : {}), ...(scholarship.programId ? { programId: scholarship.programId } : {}),
    title: scholarship.title, provider: scholarship.provider, ...(scholarship.minimumGpa ? { minimumGpa: Number(scholarship.minimumGpa) } : {}),
    groups: csvList(scholarship.groups), levels: csvList(scholarship.levels), ...(scholarship.amountDescription ? { amountDescription: scholarship.amountDescription } : {}),
    ...(scholarship.deadline ? { deadline: scholarship.deadline } : {}), sourceUrl: scholarship.sourceUrl
  }, "Scholarship saved as pending verification.", () => setScholarship({ ...emptyScholarship, institutionId: scholarship.institutionId }));

  const createMedia = () => submit("/api/admin/media", {
    ...(media.institutionId ? { institutionId: media.institutionId } : {}), type: media.type, title: media.title, url: media.url, ...(media.languageCode ? { languageCode: media.languageCode } : {})
  }, "Media resource saved as pending verification.", () => setMedia({ ...emptyMedia, institutionId: media.institutionId }));

  const submitCurrent = mode === "program" ? createProgram : mode === "admission" ? createAdmission : mode === "circular" ? createCircular : mode === "scholarship" ? createScholarship : createMedia;
  const invalidCurrent = tuitionRangeInvalid || circularDateInvalid || (mode === "program" ? !program.institutionId || !program.name || !program.slug : mode === "admission" ? !admission.programId || !admission.academicSession || !admission.sourceUrl : mode === "circular" ? !circular.institutionId || !circular.title || !circular.applicationEndsAt || !circular.sourceUrl : mode === "scholarship" ? !scholarship.title || !scholarship.provider || !scholarship.sourceUrl : !media.title || !media.url);
  const icon = mode === "program" ? <GraduationCap size={20} /> : mode === "admission" ? <ClipboardCheck size={20} /> : mode === "circular" ? <CalendarPlus size={20} /> : mode === "scholarship" ? <Award size={20} /> : <Film size={20} />;

  return <section className="mt-7 rounded-[1.7rem] border border-slate-200 bg-white p-5 sm:p-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">{icon}</span><div><h3 className="text-xl font-black">Academic content</h3><p className="mt-1 text-xs leading-5 text-slate-500">All student-facing catalog content enters review first. Parent content must be verified before child content can publish.</p></div></div><div className="flex max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1 text-xs font-black" role="tablist" aria-label="Academic content type">{(["program", "admission", "circular", "scholarship", "media"] as FormMode[]).map((value) => <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => { setMode(value); setMessage(""); }} className={`min-h-11 rounded-lg px-4 py-2 capitalize ${mode === value ? "bg-white shadow-sm" : "text-slate-500"}`}>{value}</button>)}</div></div>

    {mode === "program" && <div className="mt-6 grid gap-4 md:grid-cols-2">
      <AdminField label="Institution"><select value={program.institutionId} onChange={(event) => setProgram({ ...program, institutionId: event.target.value })}>{institutions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></AdminField>
      <AdminField label="Program name"><input value={program.name} onChange={(event) => setProgramName(event.target.value)} /></AdminField><AdminField label="URL slug"><input value={program.slug} onChange={(event) => setProgram({ ...program, slug: event.target.value })} /></AdminField><AdminField label="Level"><select value={program.level} onChange={(event) => setProgram({ ...program, level: event.target.value })}><option>Undergraduate</option><option>Diploma</option><option>Certificate</option><option>Postgraduate</option></select></AdminField><AdminField label="Duration in months"><input type="number" min="1" value={program.durationMonths} onChange={(event) => setProgram({ ...program, durationMonths: event.target.value })} /></AdminField><AdminField label="Career outcomes"><input value={program.careerOutcomes} onChange={(event) => setProgram({ ...program, careerOutcomes: event.target.value })} /></AdminField><AdminField label="Minimum tuition"><input type="number" min="0" value={program.tuitionMin} onChange={(event) => setProgram({ ...program, tuitionMin: event.target.value })} /></AdminField><AdminField label="Maximum tuition"><input type="number" min={program.tuitionMin || "0"} value={program.tuitionMax} onChange={(event) => setProgram({ ...program, tuitionMax: event.target.value })} /></AdminField>
    </div>}

    {mode === "admission" && <div className="mt-6 grid gap-4 md:grid-cols-2">
      <AdminField label="Program"><select value={admission.programId} onChange={(event) => setAdmission({ ...admission, programId: event.target.value })}>{programs.map((item) => <option key={item.id} value={item.id}>{item.title} — {item.subtitle}</option>)}</select></AdminField><AdminField label="Academic session"><input value={admission.academicSession} onChange={(event) => setAdmission({ ...admission, academicSession: event.target.value })} /></AdminField><AdminField label="Applicant stage"><select value={admission.applicantStage} onChange={(event) => setAdmission({ ...admission, applicantStage: event.target.value })}><option>SSC</option><option>HSC</option><option>DIPLOMA</option><option>UNDERGRADUATE</option><option>GRADUATE</option></select></AdminField><AdminField label="Allowed groups (comma separated)"><input value={admission.allowedGroups} onChange={(event) => setAdmission({ ...admission, allowedGroups: event.target.value })} /></AdminField><AdminField label="Minimum SSC GPA"><input type="number" min="0" max="5" step=".01" value={admission.minimumSscGpa} onChange={(event) => setAdmission({ ...admission, minimumSscGpa: event.target.value })} /></AdminField><AdminField label="Minimum HSC GPA"><input type="number" min="0" max="5" step=".01" value={admission.minimumHscGpa} onChange={(event) => setAdmission({ ...admission, minimumHscGpa: event.target.value })} /></AdminField><AdminField label="Minimum combined GPA"><input type="number" min="0" max="10" step=".01" value={admission.minimumCombinedGpa} onChange={(event) => setAdmission({ ...admission, minimumCombinedGpa: event.target.value })} /></AdminField><AdminField label="Official source URL"><input type="url" value={admission.sourceUrl} onChange={(event) => setAdmission({ ...admission, sourceUrl: event.target.value })} /></AdminField><AdminField label="Additional criteria"><textarea value={admission.additionalCriteria} onChange={(event) => setAdmission({ ...admission, additionalCriteria: event.target.value })} /></AdminField>
      {programById.get(admission.programId)?.subtitle && <p className="self-end text-xs text-slate-500">Parent: {programById.get(admission.programId)?.subtitle}</p>}
    </div>}

    {mode === "circular" && <div className="mt-6 grid gap-4 md:grid-cols-2">
      <AdminField label="Institution"><select value={circular.institutionId} onChange={(event) => setCircular({ ...circular, institutionId: event.target.value })}>{institutions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></AdminField><AdminField label="Circular title"><input value={circular.title} onChange={(event) => setCircular({ ...circular, title: event.target.value })} /></AdminField><AdminField label="Academic session"><input value={circular.academicSession} onChange={(event) => setCircular({ ...circular, academicSession: event.target.value })} /></AdminField><AdminField label="Application fee"><input type="number" min="0" value={circular.applicationFee} onChange={(event) => setCircular({ ...circular, applicationFee: event.target.value })} /></AdminField><AdminField label="Application starts"><DatePickerInput value={circular.applicationStartsAt} onChange={(value) => setCircular({ ...circular, applicationStartsAt: value })} ariaLabel="Application start date" /></AdminField><AdminField label="Application deadline"><DatePickerInput value={circular.applicationEndsAt} min={circular.applicationStartsAt || undefined} onChange={(value) => setCircular({ ...circular, applicationEndsAt: value })} ariaLabel="Application deadline" /></AdminField><AdminField label="Exam date"><DatePickerInput value={circular.examAt} min={circular.applicationEndsAt || undefined} onChange={(value) => setCircular({ ...circular, examAt: value })} ariaLabel="Exam date" /></AdminField><AdminField label="Official source URL"><input type="url" value={circular.sourceUrl} onChange={(event) => setCircular({ ...circular, sourceUrl: event.target.value })} /></AdminField>
    </div>}

    {mode === "scholarship" && <div className="mt-6 grid gap-4 md:grid-cols-2">
      <AdminField label="Institution (optional)"><select value={scholarship.institutionId} onChange={(event) => setScholarship({ ...scholarship, institutionId: event.target.value, programId: "" })}><option value="">Global / external provider</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></AdminField><AdminField label="Program (optional)"><select value={scholarship.programId} onChange={(event) => setScholarship({ ...scholarship, programId: event.target.value })}><option value="">Institution/global level</option>{programs.map((item) => <option key={item.id} value={item.id}>{item.title} — {item.subtitle}</option>)}</select></AdminField><AdminField label="Scholarship title"><input value={scholarship.title} onChange={(event) => setScholarship({ ...scholarship, title: event.target.value })} /></AdminField><AdminField label="Provider"><input value={scholarship.provider} onChange={(event) => setScholarship({ ...scholarship, provider: event.target.value })} /></AdminField><AdminField label="Minimum GPA"><input type="number" min="0" max="5" step=".01" value={scholarship.minimumGpa} onChange={(event) => setScholarship({ ...scholarship, minimumGpa: event.target.value })} /></AdminField><AdminField label="Groups"><input value={scholarship.groups} onChange={(event) => setScholarship({ ...scholarship, groups: event.target.value })} placeholder="Science, Humanities" /></AdminField><AdminField label="Levels"><input value={scholarship.levels} onChange={(event) => setScholarship({ ...scholarship, levels: event.target.value })} placeholder="HSC, UNDERGRADUATE" /></AdminField><AdminField label="Award / amount"><input value={scholarship.amountDescription} onChange={(event) => setScholarship({ ...scholarship, amountDescription: event.target.value })} /></AdminField><AdminField label="Deadline"><DatePickerInput value={scholarship.deadline} onChange={(value) => setScholarship({ ...scholarship, deadline: value })} ariaLabel="Scholarship deadline" /></AdminField><AdminField label="Official source URL"><input type="url" value={scholarship.sourceUrl} onChange={(event) => setScholarship({ ...scholarship, sourceUrl: event.target.value })} /></AdminField>
    </div>}

    {mode === "media" && <div className="mt-6 grid gap-4 md:grid-cols-2"><AdminField label="Media scope"><select value={media.institutionId} onChange={(event) => setMedia({ ...media, institutionId: event.target.value })}><option value="">Global admission fallback</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></AdminField><AdminField label="Resource type"><select value={media.type} onChange={(event) => setMedia({ ...media, type: event.target.value as "YOUTUBE" | "AUDIO", url: "" })}><option value="YOUTUBE">YouTube video</option><option value="AUDIO">Audio guide</option></select></AdminField><AdminField label="Resource title"><input value={media.title} onChange={(event) => setMedia({ ...media, title: event.target.value })} /></AdminField><AdminField label={media.type === "YOUTUBE" ? "YouTube URL" : "Direct HTTPS audio URL"}><input type="url" value={media.url} onChange={(event) => setMedia({ ...media, url: event.target.value })} /></AdminField><AdminField label="Language"><select value={media.languageCode} onChange={(event) => setMedia({ ...media, languageCode: event.target.value as "" | "en" | "bn" })}><option value="">Language neutral</option><option value="bn">Bangla</option><option value="en">English</option></select></AdminField></div>}

    {tuitionRangeInvalid && mode === "program" && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">Minimum tuition cannot exceed maximum tuition.</p>}
    {circularDateInvalid && mode === "circular" && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">Application and exam dates are not in a valid order.</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-700">{message}</p>}
    <button type="button" disabled={busy || invalidCurrent} onClick={submitCurrent} className="mt-5 flex min-h-11 items-center gap-2 rounded-xl bg-[#071b2e] px-5 py-3 text-sm font-black text-white disabled:opacity-40">{busy ? <LoaderCircle className="animate-spin" size={17} /> : icon}Save {mode}</button>
  </section>;
}

function AdminField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="admin-field"><span>{label}</span>{children}</label>;
}
