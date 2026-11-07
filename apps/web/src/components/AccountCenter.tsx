import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Cloud, Download, LoaderCircle, ShieldCheck, Trash2, UserRound, X } from "lucide-react";
import { apiRequest } from "../lib/api";
import { getFirebaseAuth } from "../lib/firebase";
import { useLocale } from "../lib/locale";
import type { AppSession } from "../types/auth";

type Props = {
  open: boolean;
  onClose: () => void;
  session: AppSession;
  profileSyncState: "local" | "loading" | "saving" | "synced" | "error";
  onAccountDeleted: () => Promise<void> | void;
};

function saveJsonFile(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function AccountCenter({ open, onClose, session, profileSyncState, onAccountDeleted }: Props) {
  const { text } = useLocale();
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  const exportData = async () => {
    setBusy(true); setMessage("");
    try {
      const payload = await apiRequest<unknown>("/api/me/export", { token: session.token });
      saveJsonFile(`edupath-data-${session.user.username}.json`, payload);
      setMessage(text("Your EduPath data export was downloaded.", "আপনার EduPath ডেটার কপি ডাউনলোড হয়েছে।"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("Could not export your data.", "ডেটা এক্সপোর্ট করা যায়নি।"));
    } finally { setBusy(false); }
  };

  const clearPublicCache = () => {
    let cleared = 0;
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("edupath_public_api:")) { localStorage.removeItem(key); cleared += 1; }
    }
    setMessage(text(`${cleared} cached public response${cleared === 1 ? "" : "s"} cleared.`, `${cleared}টি cached public response মুছে ফেলা হয়েছে।`));
  };

  const deleteAccount = async () => {
    if (deleteConfirmation.trim().toLowerCase() !== session.user.username.toLowerCase()) return;
    setBusy(true); setMessage("");
    try {
      const idToken = session.mode === "demo" ? undefined : await getFirebaseAuth().currentUser?.getIdToken(true);
      if (session.mode !== "demo" && !idToken) throw new Error(text("Sign out and sign in again before deleting your account.", "অ্যাকাউন্ট মুছতে আগে সাইন আউট করে আবার সাইন ইন করুন।"));
      await apiRequest<{ deleted: boolean }>("/api/me/account", { method: "DELETE", token: session.token, body: JSON.stringify({ confirmation: deleteConfirmation.trim(), idToken }) });
      await onAccountDeleted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("Could not delete your account.", "অ্যাকাউন্ট মুছতে ব্যর্থ হয়েছে।"));
    } finally { setBusy(false); }
  };

  const syncLabel = profileSyncState === "synced" ? text("Synced", "সিঙ্ক হয়েছে")
    : profileSyncState === "saving" ? text("Saving…", "সংরক্ষণ হচ্ছে…")
      : profileSyncState === "loading" ? text("Loading…", "লোড হচ্ছে…")
        : profileSyncState === "error" ? text("Sync needs attention", "সিঙ্ক যাচাই প্রয়োজন") : text("Local only", "শুধু লোকাল");

  return <AnimatePresence>{open && <motion.div className="fixed inset-0 z-[85] grid place-items-center bg-[#041321]/75 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
    <motion.div role="dialog" aria-modal="true" aria-labelledby="account-center-label" data-testid="account-center-dialog" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl sm:p-7" initial={{ y: 24, opacity: 0, scale: .97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 16, opacity: 0 }} onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><span id="account-center-label" className="text-xs font-black uppercase tracking-[.18em] text-teal-700">{text("Account & privacy", "অ্যাকাউন্ট ও প্রাইভেসি")}</span><h2 id="account-center-user-name" className="mt-2 text-2xl font-black">{session.user.displayName}</h2><p className="mt-1 text-sm text-slate-500">@{session.user.username}</p></div><button type="button" className="grid size-11 place-items-center rounded-xl bg-slate-100" onClick={onClose} aria-label={text("Close", "বন্ধ করুন")}><X size={18} /></button></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-sm font-black"><UserRound size={17} className="text-teal-700" />{text("Identity", "পরিচয়")}</div><p className="mt-2 break-all text-xs leading-5 text-slate-600">{session.user.email}</p><p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{session.user.role}</p></div>
        <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-sm font-black"><Cloud size={17} className="text-cyan-700" />{text("Profile cloud sync", "প্রোফাইল ক্লাউড সিঙ্ক")}</div><p className={`mt-2 text-xs font-bold ${profileSyncState === "error" ? "text-rose-700" : "text-emerald-700"}`}>{syncLabel}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{text("Signed-in student pathway preferences are saved to the EduPath database.", "সাইন ইন করা শিক্ষার্থীর pathway preference EduPath database-এ সংরক্ষিত হয়।")}</p></div>
      </div>
      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-black text-emerald-900"><ShieldCheck size={17} />{text("Verification", "ভেরিফিকেশন")}</div><div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold"><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 ${session.user.emailVerified ? "bg-white text-emerald-800" : "bg-amber-100 text-amber-900"}`}><CheckCircle2 size={13} />{text("Email", "ইমেইল")}: {session.user.emailVerified ? text("verified", "যাচাইকৃত") : text("not verified", "যাচাই হয়নি")}</span><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 ${session.user.phoneVerified ? "bg-white text-emerald-800" : "bg-slate-100 text-slate-600"}`}><CheckCircle2 size={13} />{text("Phone", "ফোন")}: {session.user.phoneVerified ? text("verified", "যাচাইকৃত") : text("not verified", "যাচাই হয়নি")}</span></div></div>
      <div className="mt-6 grid gap-3">
        <button type="button" disabled={busy} onClick={exportData} className="flex min-h-12 items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-teal-300 hover:bg-teal-50 disabled:opacity-50"><span><strong className="block text-sm">{text("Download my EduPath data", "আমার EduPath ডেটা ডাউনলোড")}</strong><span className="mt-1 block text-[11px] leading-5 text-slate-500">{text("Exports your account, profile, shortlist, applications and activity as JSON.", "অ্যাকাউন্ট, প্রোফাইল, shortlist, application ও activity JSON হিসেবে এক্সপোর্ট করে।")}</span></span>{busy ? <LoaderCircle className="animate-spin" size={18} /> : <Download size={18} />}</button>
        <button type="button" onClick={clearPublicCache} className="flex min-h-12 items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-rose-200 hover:bg-rose-50"><span><strong className="block text-sm">{text("Clear cached public data", "Cached public data মুছুন")}</strong><span className="mt-1 block text-[11px] leading-5 text-slate-500">{text("Removes offline catalog API copies from this device only. Your account data stays intact.", "শুধু এই ডিভাইসের offline catalog cache মুছবে; account data থাকবে।")}</span></span><Trash2 size={18} /></button>
        {session.user.role === "STUDENT" && <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4"><button type="button" onClick={() => { setDeleteOpen((value) => !value); setDeleteConfirmation(""); }} className="flex min-h-11 w-full items-center justify-between gap-4 text-left text-rose-800"><span><strong className="block text-sm">{text("Delete my account", "আমার অ্যাকাউন্ট মুছুন")}</strong><span className="mt-1 block text-[11px] leading-5 text-rose-700/80">{session.mode === "demo" ? text("Deletes this disposable demo account and its demo activity.", "এই disposable demo account ও demo activity মুছে দেবে।") : text("Permanently removes your EduPath account data and Firebase sign-in identity.", "EduPath account data ও Firebase sign-in identity স্থায়ীভাবে মুছে দেবে।")}</span></span><Trash2 size={18} /></button>{deleteOpen && <div className="mt-4 border-t border-rose-200 pt-4"><label className="block text-xs font-bold text-rose-900">{text(`Type ${session.user.username} to confirm`, `নিশ্চিত করতে ${session.user.username} লিখুন`)}</label><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" className="mt-2 min-h-11 w-full rounded-xl border border-rose-200 bg-white px-3 text-sm outline-none focus:border-rose-500" /><button type="button" disabled={busy || deleteConfirmation.trim().toLowerCase() !== session.user.username.toLowerCase()} onClick={deleteAccount} className="mt-3 min-h-11 w-full rounded-xl bg-rose-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? text("Deleting…", "মুছে ফেলা হচ্ছে…") : text("Permanently delete account", "স্থায়ীভাবে অ্যাকাউন্ট মুছুন")}</button></div>}</div>}
      </div>
      {message && <p role="status" aria-live="polite" className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-700">{message}</p>}
      <p className="mt-5 text-[10px] leading-5 text-slate-400">{text("EduPath stores only application data needed for the student workflow. Firebase authentication credentials and passwords are not included in the export.", "EduPath student workflow-এর প্রয়োজনীয় application data রাখে। Firebase authentication credential ও password export-এ থাকে না।")}</p>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}
