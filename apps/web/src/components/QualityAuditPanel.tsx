import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bug, CheckCircle2, Clipboard, Download, RefreshCw, X, XCircle } from "lucide-react";
import { qaEventName, reportQaEvent, runQualityAudit, type QaResult } from "../lib/quality-audit";
import { useLocale } from "../lib/locale";

const enabled = import.meta.env.DEV || new URLSearchParams(window.location.search).get("qa") === "1";

function downloadReport(results: QaResult[], runtimeEvents: QaResult[]) {
  const payload = {
    app: "EduPath BD",
    generatedAt: new Date().toISOString(),
    location: window.location.href,
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
    results,
    runtimeEvents
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `edupath-qa-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function copyReport(report: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(report);
  const textarea = document.createElement("textarea");
  textarea.value = report;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function QualityAuditPanel() {
  const { text } = useLocale();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<QaResult[]>([]);
  const [runtimeEvents, setRuntimeEvents] = useState<QaResult[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onQaEvent = (event: Event) => {
      const detail = (event as CustomEvent<QaResult>).detail;
      if (detail) setRuntimeEvents((current) => [detail, ...current].slice(0, 50));
    };
    const onError = (event: ErrorEvent) => reportQaEvent({
      source: "runtime",
      severity: "fail",
      title: "JavaScript error",
      detail: `${event.message}${event.filename ? ` · ${event.filename}:${event.lineno}` : ""}`
    });
    const onRejection = (event: PromiseRejectionEvent) => reportQaEvent({
      source: "runtime",
      severity: "fail",
      title: "Unhandled promise rejection",
      detail: event.reason instanceof Error ? `${event.reason.message}\n${event.reason.stack || ""}` : String(event.reason)
    });
    const onResourceError = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement || target instanceof HTMLScriptElement || target instanceof HTMLLinkElement)) return;
      reportQaEvent({ source: "network", severity: "fail", title: "Resource failed to load", detail: target instanceof HTMLLinkElement ? target.href : target.src });
    };
    window.addEventListener(qaEventName, onQaEvent);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onResourceError, true);
    return () => {
      window.removeEventListener(qaEventName, onQaEvent);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onResourceError, true);
    };
  }, []);

  const summary = useMemo(() => ({
    pass: results.filter((item) => item.severity === "pass").length,
    warn: results.filter((item) => item.severity === "warn").length,
    fail: results.filter((item) => item.severity === "fail").length
  }), [results]);

  const run = async () => {
    setRunning(true);
    setCopied(false);
    try { setResults(await runQualityAudit(runtimeEvents)); }
    finally { setRunning(false); }
  };

  useEffect(() => {
    if (open && !results.length && !running) void run();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!enabled) return null;

  const reportText = JSON.stringify({ generatedAt: new Date().toISOString(), url: window.location.href, results, runtimeEvents }, null, 2);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="qa-launcher fixed right-4 z-[85] inline-flex min-h-11 items-center gap-2 rounded-full bg-fuchsia-700 px-4 py-2 text-xs font-black text-white shadow-2xl" aria-label={text("Open automatic quality audit", "স্বয়ংক্রিয় কোয়ালিটি অডিট খুলুন")}>
      <Bug size={17} /> QA {runtimeEvents.length > 0 && <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-fuchsia-800">{runtimeEvents.length}</span>}
    </button>
    {open && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="qa-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[1.7rem] bg-slate-50 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-fuchsia-700">{text("Development diagnostics", "ডেভেলপমেন্ট ডায়াগনস্টিকস")}</p><h2 id="qa-title" className="mt-1 text-xl font-black">{text("Automatic quality audit", "স্বয়ংক্রিয় কোয়ালিটি অডিট")}</h2><p className="mt-1 text-xs text-slate-500">{text("Runtime, API, navigation, accessibility and responsive checks.", "Runtime, API, navigation, accessibility ও responsive check।")}</p></div>
          <button type="button" className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100" onClick={() => setOpen(false)} aria-label={text("Close quality audit", "কোয়ালিটি অডিট বন্ধ করুন")}><X size={19} /></button>
        </header>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-2">
            <Summary tone="emerald" label={text("Passed", "পাস")} value={summary.pass} />
            <Summary tone="amber" label={text("Warnings", "সতর্কতা")} value={summary.warn} />
            <Summary tone="rose" label={text("Failed", "ব্যর্থ")} value={summary.fail} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void run()} disabled={running} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#071b2e] px-4 py-2 text-xs font-black text-white disabled:opacity-60"><RefreshCw className={running ? "animate-spin" : ""} size={16} />{running ? text("Checking...", "পরীক্ষা হচ্ছে...") : text("Run checks again", "আবার পরীক্ষা করুন")}</button>
            <button type="button" disabled={!results.length} onClick={async () => { await copyReport(reportText); setCopied(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black disabled:opacity-50"><Clipboard size={16} />{copied ? text("Copied", "কপি হয়েছে") : text("Copy report", "রিপোর্ট কপি করুন")}</button>
            <button type="button" disabled={!results.length} onClick={() => downloadReport(results, runtimeEvents)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black disabled:opacity-50"><Download size={16} />{text("Download JSON", "JSON ডাউনলোড")}</button>
            <button type="button" disabled={!runtimeEvents.length} onClick={() => { setRuntimeEvents([]); setResults([]); }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black disabled:opacity-50">{text("Clear captured errors", "ধরা error মুছুন")}</button>
          </div>
          <div className="mt-5 grid gap-2">
            {results.map((item) => <ResultCard key={item.id} item={item} />)}
          </div>
          <div className="mt-6">
            <div className="flex items-center justify-between"><h3 className="text-sm font-black">{text("Captured live errors", "ধরা পড়া লাইভ error")}</h3><span className="text-xs text-slate-500">{runtimeEvents.length}/50</span></div>
            {!runtimeEvents.length ? <p className="mt-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">{text("No live runtime or resource errors captured yet.", "এখনো কোনো live runtime বা resource error ধরা পড়েনি।")}</p> : <div className="mt-2 grid gap-2">{runtimeEvents.map((item) => <ResultCard key={item.id} item={item} />)}</div>}
          </div>
          <p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">{text("Automatic checks find technical failures, but visual quality and whether information feels correct still need a final human review.", "Automatic check প্রযুক্তিগত সমস্যা ধরবে, তবে design ও তথ্য বাস্তবে ঠিক মনে হচ্ছে কি না—সেটার final manual review লাগবে।")}</p>
        </div>
      </section>
    </div>}
  </>;
}

function Summary({ tone, label, value }: { tone: "emerald" | "amber" | "rose"; label: string; value: number }) {
  const tones = { emerald: "bg-emerald-50 text-emerald-800", amber: "bg-amber-50 text-amber-800", rose: "bg-rose-50 text-rose-800" };
  return <div className={`rounded-xl p-3 text-center ${tones[tone]}`}><strong className="block text-2xl font-black">{value}</strong><span className="text-[11px] font-bold">{label}</span></div>;
}

function ResultCard({ item }: { item: QaResult }) {
  const Icon = item.severity === "pass" ? CheckCircle2 : item.severity === "warn" ? AlertTriangle : XCircle;
  const tone = item.severity === "pass" ? "border-emerald-100 bg-emerald-50/60 text-emerald-700" : item.severity === "warn" ? "border-amber-100 bg-amber-50/60 text-amber-700" : "border-rose-100 bg-rose-50/60 text-rose-700";
  return <article className={`flex gap-3 rounded-xl border p-3 ${tone}`}><Icon className="mt-0.5 shrink-0" size={17} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-xs text-slate-900">{item.title}</strong><span className="rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-black uppercase">{item.source}</span></div><p className="mt-1 break-words text-[11px] leading-5 text-slate-600">{item.detail}</p></div></article>;
}
