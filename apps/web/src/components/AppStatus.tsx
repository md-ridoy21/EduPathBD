import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { CloudOff, LoaderCircle, RefreshCw, Wifi } from "lucide-react";
import { useLocale } from "../lib/locale";
import { reportQaEvent } from "../lib/quality-audit";

export function NetworkStatusBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [restored, setRestored] = useState(false);
  const { text } = useLocale();
  useEffect(() => {
    const onOnline = () => { setOnline(true); setRestored(true); window.setTimeout(() => setRestored(false), 3500); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);
  if (online && !restored) return null;
  return <div role="status" aria-live="polite" className={`fixed inset-x-3 top-20 z-[70] mx-auto flex max-w-xl items-center justify-center gap-2 rounded-xl px-4 py-3 text-center text-xs font-black shadow-xl ${online ? "bg-emerald-600 text-white" : "bg-amber-300 text-amber-950"}`}>
    {online ? <Wifi size={16} /> : <CloudOff size={16} />}{online ? text("Connection restored. Live data is available.", "ইন্টারনেট সংযোগ ফিরে এসেছে। লাইভ তথ্য পাওয়া যাচ্ছে।") : text("You are offline. Saved public data and on-device guidance remain available.", "আপনি অফলাইনে আছেন। সংরক্ষিত তথ্য ও অন-ডিভাইস গাইডেন্স ব্যবহার করা যাবে।")}
  </div>;
}

export function SectionLoader() {
  const { text } = useLocale();
  return <div role="status" aria-live="polite" className="grid min-h-40 place-items-center bg-slate-100"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-teal-700" size={24} /><p className="mt-2 text-xs font-bold text-slate-500">{text("Loading this section...", "সেকশনটি লোড হচ্ছে...")}</p></div></div>;
}

type BoundaryState = { failed: boolean };
export class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };
  static getDerivedStateFromError(): BoundaryState { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("EduPath UI boundary", error, info.componentStack);
    reportQaEvent({ source: "runtime", severity: "fail", title: "React interface crash", detail: `${error.message}\n${info.componentStack || ""}` });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const bangla = document.documentElement.lang === "bn";
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><div role="alert" className="max-w-md rounded-[2rem] border border-rose-100 bg-white p-7 text-center shadow-xl"><RefreshCw className="mx-auto text-rose-600" size={32} /><h1 className="mt-4 text-xl font-black">{bangla ? "অ্যাপটি সাময়িকভাবে লোড করা যায়নি" : "The app could not finish loading"}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{bangla ? "আপনার সংরক্ষিত তথ্য মুছে যায়নি। আবার চেষ্টা করতে Reload চাপুন।" : "Your saved data has not been deleted. Select Reload to try again."}</p><button onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-[#071b2e] px-5 py-3 text-sm font-black text-white">{bangla ? "আবার লোড করুন" : "Reload app"}</button></div></main>;
  }
}
