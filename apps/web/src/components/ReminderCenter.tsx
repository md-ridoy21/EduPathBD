import { Bell, CalendarDays, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getDeadlineReminders, removeDeadlineReminder, type DeadlineReminder } from "../lib/reminders";
import { useLocale } from "../lib/locale";

type Props = { open: boolean; onClose: () => void };

export function ReminderCenter({ open, onClose }: Props) {
  const { localeCode, text } = useLocale();
  const [reminders, setReminders] = useState<DeadlineReminder[]>(getDeadlineReminders);

  useEffect(() => {
    const refresh = () => setReminders(getDeadlineReminders());
    window.addEventListener("edupath:reminders-changed", refresh);
    if (open) refresh();
    return () => window.removeEventListener("edupath:reminders-changed", refresh);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  const goToDeadlines = () => {
    onClose();
    window.setTimeout(() => document.querySelector("#deadlines")?.scrollIntoView({ behavior: "smooth" }), 0);
  };

  return <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="reminder-center-title" className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-teal-700"><Bell size={15} />{text("Reminder center", "রিমাইন্ডার সেন্টার")}</span><h2 id="reminder-center-title" className="mt-2 text-2xl font-black">{text("Your saved deadlines", "সংরক্ষিত ডেডলাইন")}</h2></div><button type="button" onClick={onClose} aria-label={text("Close", "বন্ধ করুন")} className="grid size-11 place-items-center rounded-xl bg-slate-100"><X size={18} /></button></div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{text("Reminders stay saved on this device even when native notifications are unavailable.", "Native notification না থাকলেও রিমাইন্ডার এই ডিভাইসে সংরক্ষিত থাকবে।")}</p>
      {reminders.length ? <div className="mt-5 grid gap-3">{reminders.map((reminder) => <article key={reminder.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CalendarDays size={18} /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-black">{reminder.institution}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{reminder.title}</p><p className="mt-2 text-[11px] font-bold text-teal-700">{new Date(reminder.deadline).toLocaleDateString(localeCode, { day: "numeric", month: "short", year: "numeric" })}</p></div><button type="button" onClick={() => removeDeadlineReminder(reminder.id)} aria-label={text("Remove reminder", "রিমাইন্ডার সরান")} className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600"><Trash2 size={15} /></button></article>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-8 text-center"><Bell className="mx-auto text-slate-400" size={28} /><p className="mt-3 text-sm font-black">{text("No reminder saved yet", "এখনও রিমাইন্ডার সেভ করা হয়নি")}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text("Open a deadline and tap Remind me.", "ডেডলাইন থেকে ‘মনে করান’ চাপুন।")}</p></div>}
      <button type="button" onClick={goToDeadlines} className="mt-5 min-h-11 w-full rounded-xl bg-[#071b2e] px-4 py-3 text-sm font-black text-white">{text("View deadline calendar", "ডেডলাইন ক্যালেন্ডার দেখুন")}</button>
    </section>
  </div>;
}
