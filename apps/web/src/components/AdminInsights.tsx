import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Download, Flag, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { API_URL, apiRequest } from "../lib/api";

type Metric = { label: string; value: number };
type RatingMetric = Metric & { count: number };
type Analytics = {
  overview: Record<string, number>;
  applicationStatuses: Metric[];
  reportStatuses: Metric[];
  topRatedInstitutions: RatingMetric[];
  activity: Record<string, number>;
};
type Report = { id: string; reporterUsername: string; targetType: string; targetId: string; reason: string; details?: string; status: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED"; createdAt: string };

export function AdminInsights({ token }: { token: string }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setBusy(true); setMessage("");
    try {
      const [analyticsResult, reportResult] = await Promise.all([
        apiRequest<Analytics>("/api/admin/analytics", { token }),
        apiRequest<{ data: Report[] }>("/api/admin/moderation/reports", { token })
      ]);
      setAnalytics(analyticsResult); setReports(reportResult.data);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load insights"); }
    finally { setBusy(false); }
  };

  useEffect(() => { void load(); }, [token]);

  const maxApplication = useMemo(() => Math.max(1, ...(analytics?.applicationStatuses.map((item) => item.value) ?? [1])), [analytics]);

  const decide = async (reportId: string, status: "REVIEWING" | "RESOLVED" | "DISMISSED") => {
    setActionBusy(`report:${reportId}`); setMessage("");
    try {
      const updated = await apiRequest<Report>(`/api/admin/moderation/reports/${reportId}`, { method: "PATCH", token, body: JSON.stringify({ status, resolution: status === "RESOLVED" ? "Reviewed and action recorded by the moderation team." : undefined }) });
      setReports((current) => current.map((item) => item.id === reportId ? updated : item));
      setAnalytics(await apiRequest<Analytics>("/api/admin/analytics", { token }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update report"); }
    finally { setActionBusy(""); }
  };

  const download = async (kind: "analytics" | "moderation") => {
    setActionBusy(`export:${kind}`); setMessage("");
    try {
      const response = await fetch(`${API_URL}/api/admin/reporting/export.csv?kind=${kind}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not export the report dataset");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `edupath-${kind}.csv`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not export the report dataset"); }
    finally { setActionBusy(""); }
  };

  return <section className="mt-7 rounded-[1.7rem] border border-slate-200 bg-white p-5 sm:p-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-black uppercase tracking-[.16em] text-violet-700">Phase 5 intelligence</p><h3 className="mt-2 text-xl font-black">Analytics, reports and moderation</h3><p className="mt-1 text-xs leading-5 text-slate-500">Live application metrics, AI usage audit, user reports and Crystal Reports-ready exports.</p></div><button onClick={load} disabled={busy} className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-700">{busy ? <LoaderCircle className="animate-spin" size={18} /> : <RefreshCw size={18} />}</button></div>
    {message && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">{message}</p>}
    {actionBusy && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-cyan-50 px-4 py-3 text-xs font-bold text-cyan-900"><LoaderCircle className="animate-spin" size={15} />Saving or preparing your download…</p>}
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl bg-slate-50 p-5"><div className="flex items-center justify-between"><h4 className="flex items-center gap-2 text-sm font-black"><BarChart3 size={17} className="text-teal-700" /> Application pipeline</h4><button onClick={() => download("analytics")} className="inline-flex items-center gap-1 text-[10px] font-black text-teal-700"><Download size={13} /> CSV</button></div><div className="mt-5 grid gap-3">{analytics?.applicationStatuses.length ? analytics.applicationStatuses.map((item) => <div key={item.label}><div className="flex justify-between text-[10px] font-bold text-slate-500"><span>{item.label.replaceAll("_", " ")}</span><span>{item.value}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal-600" style={{ width: `${(item.value / maxApplication) * 100}%` }} /></div></div>) : <p className="text-xs text-slate-500">Pipeline populates as students start applications.</p>}</div><div className="mt-5 grid grid-cols-2 gap-2">{Object.entries(analytics?.activity ?? {}).map(([label, value]) => <div key={label} className="rounded-xl bg-white p-3"><strong className="block text-lg">{value}</strong><span className="text-[10px] capitalize text-slate-500">{label.replaceAll("_", " ")}</span></div>)}</div></div>
      <div className="rounded-2xl bg-[#071b2e] p-5 text-white"><h4 className="flex items-center gap-2 text-sm font-black"><Sparkles size={17} className="text-violet-300" /> Quality signals</h4><div className="mt-5 grid gap-3">{analytics?.topRatedInstitutions.map((item) => <div key={item.label} className="rounded-xl bg-white/5 p-3"><div className="flex justify-between gap-3 text-xs"><span className="font-bold">{item.label}</span><strong className="text-amber-300">{item.value.toFixed(1)} / 5</strong></div><p className="mt-1 text-[10px] text-slate-400">{item.count} ratings</p></div>)}</div></div>
    </div>
    <div className="mt-5 rounded-2xl border border-rose-100 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="flex items-center gap-2 text-sm font-black"><Flag size={17} className="text-rose-600" /> Moderation queue</h4><button onClick={() => download("moderation")} className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700"><Download size={13} /> Export queue</button></div><div className="mt-4 grid gap-3">{reports.map((report) => <article key={report.id} className="rounded-xl bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-black">{report.reason.replaceAll("_", " ")}</p><p className="mt-1 text-[10px] text-slate-500">@{report.reporterUsername} · {report.targetType.toLowerCase()} {report.targetId}</p></div><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-slate-600">{report.status}</span></div>{report.details && <p className="mt-2 text-xs leading-5 text-slate-600">{report.details}</p>}<div className="mt-3 flex flex-wrap gap-2">{report.status === "OPEN" && <button onClick={() => decide(report.id, "REVIEWING")} className="rounded-lg bg-amber-100 px-3 py-2 text-[10px] font-black text-amber-800">Start review</button>}{(report.status === "OPEN" || report.status === "REVIEWING") && <><button onClick={() => decide(report.id, "RESOLVED")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-3 py-2 text-[10px] font-black text-emerald-800"><CheckCircle2 size={12} /> Resolve</button><button onClick={() => decide(report.id, "DISMISSED")} className="rounded-lg bg-slate-200 px-3 py-2 text-[10px] font-black text-slate-700">Dismiss</button></>}</div></article>)}{!reports.length && <p className="rounded-xl bg-emerald-50 p-4 text-xs text-emerald-800">No user reports are waiting.</p>}</div></div>
  </section>;
}
