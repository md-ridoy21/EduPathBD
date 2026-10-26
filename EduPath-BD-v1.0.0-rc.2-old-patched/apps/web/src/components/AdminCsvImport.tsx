import { useRef, useState } from "react";
import { Download, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { apiRequest } from "../lib/api";

type Props = { token: string; onImported: () => void };
type ImportResult = { imported: Array<{ row: number; id: string; name: string }>; errors: Array<{ row: number; message: string }>; totalRows: number };

const template = "name,slug,type,district,websiteUrl,sourceUrl\nExample University,example-university,PUBLIC_UNIVERSITY,Dhaka,https://example.edu.bd,https://example.edu.bd/admission\n";

export function AdminCsvImport({ token, onImported }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState("");

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([template], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "edupath-institution-import-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true); setMessage(""); setResult(null);
    try {
      if (file.size > 200_000) throw new Error("CSV file must be smaller than 200 KB.");
      const csv = await file.text();
      const imported = await apiRequest<ImportResult>("/api/admin/import/institutions", { method: "POST", token, body: JSON.stringify({ csv }) });
      setResult(imported);
      setMessage(`${imported.imported.length} of ${imported.totalRows} row(s) imported as drafts.`);
      if (imported.imported.length) onImported();
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import CSV");
    } finally { setBusy(false); }
  };

  return <section className="mt-7 rounded-[1.7rem] border border-slate-200 bg-white p-5 sm:p-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><FileSpreadsheet size={20} /></span><div><h3 className="text-xl font-black">Bulk CSV import</h3><p className="mt-1 text-xs leading-5 text-slate-500">Import up to 100 institutions at once. Every valid record enters the verification queue as a draft.</p></div></div>
      <button type="button" onClick={downloadTemplate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black"><Download size={15} />Download template</button>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <label className="admin-field"><span>Institution CSV file</span><input ref={fileInput} type="file" accept=".csv,text/csv" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); setMessage(""); }} /></label>
      <button type="button" disabled={!file || busy} onClick={upload} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071b2e] px-5 py-3 text-xs font-black text-white disabled:opacity-40">{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}Import drafts</button>
    </div>
    {message && <p role="status" className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-xs font-bold text-slate-700">{message}</p>}
    {!!result?.errors.length && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-xs font-black text-rose-800">Rows needing correction</p><ul className="mt-2 grid gap-1 text-xs text-rose-700">{result.errors.map((error) => <li key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</li>)}</ul></div>}
  </section>;
}
