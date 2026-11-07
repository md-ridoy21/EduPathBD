import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { CheckCircle2, CircleAlert, LoaderCircle, RefreshCw, Smartphone, X, XCircle } from "lucide-react";
import { API_URL } from "../lib/api";
import { useLocale } from "../lib/locale";

type Props = { open: boolean; onClose: () => void };
type CheckState = "pass" | "warn" | "fail";
type DeviceCheck = { label: string; detail: string; state: CheckState };

export function DeviceCheckModal({ open, onClose }: Props) {
  const { text } = useLocale();
  const [checks, setChecks] = useState<DeviceCheck[]>([]);
  const [running, setRunning] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    const results: DeviceCheck[] = [];
    const platform = Capacitor.getPlatform();
    const native = Capacitor.isNativePlatform();
    results.push({ label: text("Runtime", "রানটাইম"), detail: native ? `${platform} · Capacitor native` : `${platform} · PWA/browser`, state: "pass" });
    results.push({ label: text("Network", "নেটওয়ার্ক"), detail: navigator.onLine ? text("Device reports online", "ডিভাইস অনলাইন দেখাচ্ছে") : text("Offline — cached public data remains available", "অফলাইন — cached public data পাওয়া যাবে"), state: navigator.onLine ? "pass" : "warn" });

    const unsafeNativeLocalhost = native && /\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/.test(API_URL);
    results.push({ label: text("API address", "API ঠিকানা"), detail: unsafeNativeLocalhost ? text("localhost points to the phone; rebuild with the laptop LAN/HTTPS API URL", "localhost ফোনকেই বোঝায়; laptop LAN/HTTPS API URL দিয়ে rebuild করুন") : API_URL || text("Same secure origin", "একই নিরাপদ অরিজিন"), state: unsafeNativeLocalhost ? "fail" : "pass" });

    try {
      const startedAt = performance.now();
      const response = await fetch(`${API_URL}/api/ready`, { signal: AbortSignal.timeout(5_000) });
      const payload = await response.json() as { status?: string; version?: string };
      const latency = Math.round(performance.now() - startedAt);
      results.push({ label: text("Backend", "ব্যাকএন্ড"), detail: response.ok ? `EduPath API v${payload.version ?? "?"} · ${latency} ms` : `HTTP ${response.status}`, state: response.ok && payload.status === "ok" ? "pass" : "fail" });
    } catch {
      results.push({ label: text("Backend", "ব্যাকএন্ড"), detail: text("API could not be reached from this device", "এই ডিভাইস থেকে API-তে সংযোগ হয়নি"), state: "fail" });
    }

    try {
      const key = "edupath_device_check";
      localStorage.setItem(key, "ok");
      const works = localStorage.getItem(key) === "ok";
      localStorage.removeItem(key);
      results.push({ label: text("Local storage", "লোকাল স্টোরেজ"), detail: works ? text("Preferences and offline state can persist", "পছন্দ ও offline state সংরক্ষণ করা যাবে") : text("Storage write failed", "স্টোরেজে লেখা যায়নি"), state: works ? "pass" : "fail" });
    } catch {
      results.push({ label: text("Local storage", "লোকাল স্টোরেজ"), detail: text("Storage is blocked", "স্টোরেজ বন্ধ আছে"), state: "fail" });
    }

    const notificationDetail = "Notification" in window ? Notification.permission : text("Not supported", "সমর্থিত নয়");
    results.push({ label: text("Notifications", "নোটিফিকেশন"), detail: notificationDetail, state: notificationDetail === "granted" ? "pass" : "warn" });
    const pwaReady = "serviceWorker" in navigator;
    results.push({ label: "PWA", detail: pwaReady ? text("Service worker supported", "Service worker সমর্থিত") : text("Service worker unavailable", "Service worker পাওয়া যায়নি"), state: pwaReady ? "pass" : "warn" });
    const topInset = Math.round(Number.parseFloat(getComputedStyle(document.documentElement).paddingTop) || 0);
    results.push({ label: text("System safe area", "সিস্টেম নিরাপদ এলাকা"), detail: native ? `${topInset} px ${text("top inset", "উপরের ফাঁকা জায়গা")}` : text("Managed by the browser", "ব্রাউজার নিয়ন্ত্রিত"), state: native && topInset < 1 ? "fail" : "pass" });
    results.push({ label: text("Viewport", "স্ক্রিন"), detail: `${window.innerWidth} × ${window.innerHeight} px`, state: window.innerWidth >= 320 ? "pass" : "warn" });
    setChecks(results);
    setRunning(false);
  };

  useEffect(() => {
    if (open) void runChecks();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;
  const failures = checks.filter((item) => item.state === "fail").length;

  return <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="device-check-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-teal-700"><Smartphone size={15} /> {text("Release diagnostics", "রিলিজ ডায়াগনস্টিকস")}</span><h2 id="device-check-title" className="mt-2 text-2xl font-black">{text("Device readiness check", "ডিভাইস প্রস্তুতি যাচাই")}</h2></div><button type="button" onClick={onClose} aria-label={text("Close", "বন্ধ করুন")} className="grid size-11 place-items-center rounded-xl bg-slate-100"><X size={18} /></button></div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{text("Run this on the presentation phone. It verifies the runtime, API connection and core device capabilities without exposing secrets.", "প্রেজেন্টেশনের ফোনে এটি চালান। কোনো secret না দেখিয়ে runtime, API connection ও device capability যাচাই করবে।")}</p>
      {running ? <div className="grid min-h-56 place-items-center"><LoaderCircle className="animate-spin text-teal-700" size={30} /></div> : <div className="mt-5 grid gap-2">{checks.map((item) => <div key={item.label} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">{item.state === "pass" ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18} /> : item.state === "warn" ? <CircleAlert className="mt-0.5 shrink-0 text-amber-600" size={18} /> : <XCircle className="mt-0.5 shrink-0 text-rose-600" size={18} />}<div><p className="text-xs font-black">{item.label}</p><p className="mt-1 break-all text-[11px] leading-4 text-slate-500">{item.detail}</p></div></div>)}</div>}
      {!running && <div className={`mt-5 rounded-xl px-4 py-3 text-xs font-bold ${failures ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{failures ? text(`${failures} blocking check(s) need attention.`, `${failures}টি বাধা ঠিক করতে হবে।`) : text("No blocking device issue detected.", "ডিভাইসে কোনো blocking issue পাওয়া যায়নি।")}</div>}
      <button type="button" onClick={runChecks} disabled={running} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#071b2e] px-4 py-3 text-sm font-black text-white disabled:opacity-50"><RefreshCw size={16} /> {text("Run checks again", "আবার যাচাই করুন")}</button>
    </section>
  </div>;
}
