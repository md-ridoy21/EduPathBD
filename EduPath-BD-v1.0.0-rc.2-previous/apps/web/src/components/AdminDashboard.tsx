import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Building2, FileText, Film, LoaderCircle, Plus, ShieldCheck, UsersRound, X, type LucideIcon } from "lucide-react";
import { apiRequest } from "../lib/api";
import type { AppSession } from "../types/auth";
import { AdminContentForms } from "./AdminContentForms";
import { AdminInsights } from "./AdminInsights";
import { AdminReviewQueue } from "./AdminReviewQueue";
import { AdminCsvImport } from "./AdminCsvImport";

type Props = { session: AppSession; open: boolean; onClose: () => void; onContentChanged: () => void };
type Stats = { users: number; institutions: number; programs: number; circulars: number; media: number; pendingVerification: number };
type InstitutionForm = { name: string; slug: string; type: string; district: string; websiteUrl: string; sourceUrl: string };

const emptyForm: InstitutionForm = { name: "", slug: "", type: "PUBLIC_UNIVERSITY", district: "", websiteUrl: "", sourceUrl: "" };

export function AdminDashboard({ session, open, onClose, onContentChanged }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const statCards: Array<{ label: string; value: number | undefined; icon: LucideIcon }> = [
    { label: "Users", value: stats?.users, icon: UsersRound },
    { label: "Institutions", value: stats?.institutions, icon: Building2 },
    { label: "Programs", value: stats?.programs, icon: BarChart3 },
    { label: "Circulars", value: stats?.circulars, icon: FileText },
    { label: "Media", value: stats?.media, icon: Film },
    { label: "Pending", value: stats?.pendingVerification, icon: ShieldCheck }
  ];

  useEffect(() => {
    if (!open) return;
    apiRequest<Stats>("/api/admin/stats", { token: session.token }).then(setStats).catch((error: Error) => setMessage(error.message));
  }, [open, session.token]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  const refreshStats = () => {
    setRefreshKey((current) => current + 1);
    onContentChanged();
    return apiRequest<Stats>("/api/admin/stats", { token: session.token }).then(setStats).catch((error: Error) => setMessage(error.message));
  };

  const setName = (name: string) => setForm((current) => ({ ...current, name, slug: name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") }));

  const create = async () => {
    setBusy(true);
    setMessage("");
    try {
      const body = Object.fromEntries(Object.entries(form).filter(([, value]) => value));
      await apiRequest("/api/admin/institutions", { method: "POST", token: session.token, body: JSON.stringify(body) });
      setForm(emptyForm);
      setMessage("Institution saved as a draft. It can now enter the verification workflow.");
      setStats(await apiRequest<Stats>("/api/admin/stats", { token: session.token }));
      setRefreshKey((current) => current + 1);
      onContentChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save institution");
    } finally {
      setBusy(false);
    }
  };

  return <AnimatePresence>{open && <motion.div role="dialog" aria-modal="true" aria-labelledby="admin-dashboard-title" className="fixed inset-0 z-[75] overflow-y-auto bg-slate-100" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#071b2e] text-emerald-300"><ShieldCheck size={21} /></span><div><h2 className="font-black">EduPath Control Center</h2><p className="text-xs text-slate-500">Signed in as {session.user.username} · {session.user.role}</p></div></div><button type="button" aria-label="Close admin dashboard" className="grid size-11 place-items-center rounded-xl bg-slate-100" onClick={onClose}><X size={18} /></button></div></header>
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div><span className="text-xs font-black uppercase tracking-[.18em] text-teal-700">Admin dashboard</span><h1 id="admin-dashboard-title" className="mt-2 text-3xl font-black">Content and verification overview</h1><p className="mt-2 text-sm text-slate-600">Manage verified academic data without changing or rebuilding the mobile application.</p></div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {statCards.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><Icon className="text-teal-700" size={19} /><strong className="mt-4 block text-2xl">{value ?? "—"}</strong><span className="text-xs text-slate-500">{label}</span></div>)}
      </div>
      {session.user.role === "ADMIN" ? <><section className="mt-7 rounded-[1.7rem] border border-slate-200 bg-white p-5 sm:p-7"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700"><Plus size={20} /></span><div><h3 className="text-xl font-black">Add institution</h3><p className="mt-1 text-xs leading-5 text-slate-500">New records start as drafts so unverified information is never presented as official.</p></div></div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <AdminField label="Institution name"><input value={form.name} onChange={(event) => setName(event.target.value)} placeholder="University name" /></AdminField>
          <AdminField label="URL slug"><input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="university-name" /></AdminField>
          <AdminField label="Institution type"><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="PUBLIC_UNIVERSITY">Public university</option><option value="PRIVATE_UNIVERSITY">Private university</option><option value="ENGINEERING">Engineering</option><option value="MEDICAL">Medical</option><option value="COLLEGE">College</option><option value="POLYTECHNIC">Polytechnic</option><option value="TECHNICAL">Technical</option><option value="TRAINING_PROVIDER">Training provider</option></select></AdminField>
          <AdminField label="District"><input value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} placeholder="Dhaka" /></AdminField>
          <AdminField label="Official website (optional)"><input type="url" value={form.websiteUrl} onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} placeholder="https://..." /></AdminField>
          <AdminField label="Source URL (optional)"><input type="url" value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} placeholder="https://..." /></AdminField>
        </div>
        {message && <p role="status" className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-700">{message}</p>}
        <button type="button" disabled={busy || !form.name || !form.slug || !form.district} onClick={create} className="mt-5 flex min-h-11 items-center gap-2 rounded-xl bg-[#071b2e] px-5 py-3 text-sm font-black text-white disabled:opacity-40">{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Plus size={17} />}Save draft</button>
      </section>
      <AdminCsvImport token={session.token} onImported={refreshStats} />
      <AdminContentForms token={session.token} refreshKey={refreshKey} onCreated={refreshStats} />
      <AdminReviewQueue token={session.token} refreshKey={refreshKey} onChanged={refreshStats} />
      </> : <section className="mt-7 rounded-[1.7rem] border border-violet-100 bg-violet-50 p-5 text-sm text-violet-900"><strong className="block font-black">Moderator access</strong><p className="mt-2 text-xs leading-5">You can review analytics and user reports below. Publishing academic records remains restricted to administrators.</p></section>}
      <AdminInsights token={session.token} />
    </main>
  </motion.div>}</AnimatePresence>;
}

function AdminField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="admin-field"><span>{label}</span>{children}</label>;
}
