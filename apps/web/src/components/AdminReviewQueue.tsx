import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, FileCheck2, LoaderCircle, Pencil, RotateCcw, Save, ShieldAlert, X, XCircle } from "lucide-react";
import { apiRequest } from "../lib/api";

type VerificationStatus = "DRAFT" | "PENDING" | "VERIFIED" | "OUTDATED" | "REJECTED";
type AdminContentKind = "INSTITUTION" | "PROGRAM" | "ADMISSION_RULE" | "CIRCULAR" | "SCHOLARSHIP" | "MEDIA";
type EditableContent = { name?: string; district?: string; level?: string; title?: string; academicSession?: string; sourceUrl?: string; provider?: string; amountDescription?: string; type?: "YOUTUBE" | "AUDIO"; url?: string; languageCode?: "en" | "bn" | null };
type AdminContentItem = { id: string; kind: AdminContentKind; title: string; subtitle: string; status: VerificationStatus; sourceUrl?: string; updatedAt?: string; editable: EditableContent };
type Props = { token: string; refreshKey: number; onChanged: () => void };
type Filter = "REVIEW" | "ALL" | VerificationStatus;

const statusStyle: Record<VerificationStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING: "bg-amber-50 text-amber-700",
  VERIFIED: "bg-emerald-50 text-emerald-700",
  OUTDATED: "bg-orange-50 text-orange-700",
  REJECTED: "bg-rose-50 text-rose-700"
};

export function AdminReviewQueue({ token, refreshKey, onChanged }: Props) {
  const [items, setItems] = useState<AdminContentItem[]>([]);
  const [filter, setFilter] = useState<Filter>("REVIEW");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [editKey, setEditKey] = useState("");
  const [editValues, setEditValues] = useState<EditableContent>({});

  const load = () => apiRequest<{ data: AdminContentItem[] }>("/api/admin/content", { token })
    .then((result) => setItems(result.data))
    .catch((error: Error) => setMessage(error.message));

  useEffect(() => { void load(); }, [token, refreshKey]);
  const visible = useMemo(() => items.filter((item) => filter === "ALL" || (filter === "REVIEW" ? item.status !== "VERIFIED" : item.status === filter)), [filter, items]);

  const decide = async (item: AdminContentItem, status: VerificationStatus) => {
    setBusyId(item.id); setMessage("");
    try {
      const updated = await apiRequest<AdminContentItem>(`/api/admin/content/${item.kind.toLowerCase()}/${item.id}/verification`, { method: "PATCH", token, body: JSON.stringify({ status }) });
      setItems((current) => current.map((entry) => entry.id === updated.id && entry.kind === updated.kind ? updated : entry));
      setMessage(`${updated.title} is now ${updated.status.toLowerCase()}.`);
      onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update verification status"); }
    finally { setBusyId(""); }
  };

  const beginEdit = (item: AdminContentItem) => {
    setEditKey(`${item.kind}:${item.id}`);
    setEditValues(item.editable);
    setMessage("");
  };

  const saveEdit = async (item: AdminContentItem) => {
    setBusyId(item.id); setMessage("");
    try {
      const updated = await apiRequest<AdminContentItem>(`/api/admin/content/${item.kind.toLowerCase()}/${item.id}`, { method: "PATCH", token, body: JSON.stringify(editValues) });
      setItems((current) => current.map((entry) => entry.id === updated.id && entry.kind === updated.kind ? updated : entry));
      setEditKey("");
      setMessage(`${updated.title} was updated and recorded in the audit log.`);
      onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not edit this content"); }
    finally { setBusyId(""); }
  };

  return <section className="mt-7 rounded-[1.7rem] border border-slate-200 bg-white p-5 sm:p-7">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700"><FileCheck2 size={20} /></span><div><h3 className="text-xl font-black">Verification queue</h3><p className="mt-1 text-xs leading-5 text-slate-500">Review drafts before publishing. Every decision immediately controls what students can see.</p></div></div>
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-xs font-black" aria-label="Verification filter">
        {(["REVIEW", "ALL", "VERIFIED", "REJECTED", "OUTDATED"] as Filter[]).map((value) => <button type="button" key={value} onClick={() => setFilter(value)} className={`min-h-11 whitespace-nowrap rounded-lg px-3 ${filter === value ? "bg-white shadow-sm" : "text-slate-500"}`}>{value === "REVIEW" ? "Needs review" : value.toLowerCase()}</button>)}
      </div>
    </div>
    {message && <p role="status" className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-700">{message}</p>}
    <div className="mt-5 grid gap-3">
      {visible.map((item) => { const editing = editKey === `${item.kind}:${item.id}`; return <article key={`${item.kind}-${item.id}`} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.kind}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${statusStyle[item.status]}`}>{item.status}</span></div>{editing ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(item.kind === "INSTITUTION" || item.kind === "PROGRAM") && <label className="admin-field"><span>Name</span><input value={editValues.name ?? ""} onChange={(event) => setEditValues({ ...editValues, name: event.target.value })} /></label>}
          {item.kind === "INSTITUTION" && <label className="admin-field"><span>District</span><input value={editValues.district ?? ""} onChange={(event) => setEditValues({ ...editValues, district: event.target.value })} /></label>}
          {item.kind === "PROGRAM" && <label className="admin-field"><span>Level</span><input value={editValues.level ?? ""} onChange={(event) => setEditValues({ ...editValues, level: event.target.value })} /></label>}
          {item.kind === "CIRCULAR" && <><label className="admin-field"><span>Title</span><input value={editValues.title ?? ""} onChange={(event) => setEditValues({ ...editValues, title: event.target.value })} /></label><label className="admin-field"><span>Academic session</span><input value={editValues.academicSession ?? ""} onChange={(event) => setEditValues({ ...editValues, academicSession: event.target.value })} /></label></>}
          {item.kind === "ADMISSION_RULE" && <label className="admin-field"><span>Academic session</span><input value={editValues.academicSession ?? ""} onChange={(event) => setEditValues({ ...editValues, academicSession: event.target.value })} /></label>}
          {item.kind === "SCHOLARSHIP" && <><label className="admin-field"><span>Title</span><input value={editValues.title ?? ""} onChange={(event) => setEditValues({ ...editValues, title: event.target.value })} /></label><label className="admin-field"><span>Provider</span><input value={editValues.provider ?? ""} onChange={(event) => setEditValues({ ...editValues, provider: event.target.value })} /></label><label className="admin-field sm:col-span-2"><span>Amount / award</span><input value={editValues.amountDescription ?? ""} onChange={(event) => setEditValues({ ...editValues, amountDescription: event.target.value })} /></label></>}
          {item.kind === "MEDIA" && <><label className="admin-field"><span>Title</span><input value={editValues.title ?? ""} onChange={(event) => setEditValues({ ...editValues, title: event.target.value })} /></label>{editValues.type ? <><label className="admin-field"><span>Type</span><select value={editValues.type} onChange={(event) => setEditValues({ ...editValues, type: event.target.value as "YOUTUBE" | "AUDIO" })}><option value="YOUTUBE">YouTube video</option><option value="AUDIO">Audio guide</option></select></label><label className="admin-field"><span>Language</span><select value={editValues.languageCode ?? ""} onChange={(event) => setEditValues({ ...editValues, languageCode: event.target.value ? event.target.value as "en" | "bn" : null })}><option value="">Language neutral</option><option value="bn">Bangla</option><option value="en">English</option></select></label><label className="admin-field"><span>Media URL</span><input type="url" value={editValues.url ?? ""} onChange={(event) => setEditValues({ ...editValues, url: event.target.value })} /></label></> : <p className="self-end rounded-xl bg-cyan-50 px-4 py-3 text-xs font-bold leading-5 text-cyan-900">This uploaded file is kept in private storage. Upload a replacement instead of changing its protected URL.</p>}</>}
          {(item.kind === "INSTITUTION" || item.kind === "PROGRAM" || item.kind === "ADMISSION_RULE" || item.kind === "CIRCULAR" || item.kind === "SCHOLARSHIP") && <label className="admin-field sm:col-span-2"><span>Official source URL</span><input type="url" value={editValues.sourceUrl ?? ""} onChange={(event) => setEditValues({ ...editValues, sourceUrl: event.target.value })} /></label>}
        </div> : <><h4 className="mt-2 truncate font-black">{item.title}</h4><p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>{item.sourceUrl ? <a className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-black text-teal-700" href={item.sourceUrl} target="_blank" rel="noreferrer">Check source <ExternalLink size={13} /></a> : <p className="mt-2 text-[11px] font-bold text-amber-700">No direct source attached</p>}</>}</div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {editing ? <><button type="button" disabled={busyId === item.id} onClick={() => saveEdit(item)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#071b2e] px-4 text-xs font-black text-white disabled:opacity-50">{busyId === item.id ? <LoaderCircle className="animate-spin" size={15} /> : <Save size={15} />}Save</button><button type="button" onClick={() => setEditKey("")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black"><X size={15} />Cancel</button></> : <button type="button" onClick={() => beginEdit(item)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black"><Pencil size={15} />Edit</button>}
          {!editing && <>
          {item.status !== "VERIFIED" && <button type="button" disabled={busyId === item.id} onClick={() => decide(item, "VERIFIED")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-50">{busyId === item.id ? <LoaderCircle className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}Verify</button>}
          {item.status !== "REJECTED" && item.status !== "VERIFIED" && <button type="button" disabled={busyId === item.id} onClick={() => decide(item, "REJECTED")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 px-4 text-xs font-black text-rose-700 disabled:opacity-50"><XCircle size={15} />Reject</button>}
          {item.status === "VERIFIED" && <button type="button" disabled={busyId === item.id} onClick={() => decide(item, "OUTDATED")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-orange-200 px-4 text-xs font-black text-orange-700 disabled:opacity-50"><ShieldAlert size={15} />Mark outdated</button>}
          {(item.status === "REJECTED" || item.status === "OUTDATED") && <button type="button" disabled={busyId === item.id} onClick={() => decide(item, "PENDING")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700 disabled:opacity-50"><RotateCcw size={15} />Reopen</button>}
          </>}
        </div>
      </div></article>; })}
      {!visible.length && <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={28} /><p className="mt-3 text-sm font-black">Nothing in this queue</p><p className="mt-1 text-xs text-slate-500">Create content or select another status filter.</p></div>}
    </div>
  </section>;
}
