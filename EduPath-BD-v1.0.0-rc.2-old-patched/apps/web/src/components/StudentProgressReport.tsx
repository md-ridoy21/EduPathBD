import { useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";
import { useLocale } from "../lib/locale";
import type { AppSession } from "../types/auth";
import type { Institution, StudentApplication } from "../types/catalog";

type Props = {
  session: AppSession;
  shortlisted: Institution[];
  applications: StudentApplication[];
};

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "student";
}

export function StudentProgressReport({ session, shortlisted, applications }: Props) {
  const { text } = useLocale();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const createReport = async () => {
    setBusy(true);
    setMessage("");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      let y = 18;

      const addPageIfNeeded = (needed = 18) => {
        if (y + needed <= 280) return;
        pdf.addPage();
        y = 18;
      };
      const paragraph = (value: string, size = 10, color: [number, number, number] = [51, 65, 85]) => {
        addPageIfNeeded(14);
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        const lines = pdf.splitTextToSize(value, contentWidth) as string[];
        pdf.text(lines, margin, y);
        y += lines.length * (size * 0.42) + 3;
      };
      const heading = (value: string) => {
        addPageIfNeeded(16);
        pdf.setFont("helvetica", "bold");
        paragraph(value, 13, [6, 95, 70]);
        pdf.setFont("helvetica", "normal");
      };

      pdf.setFillColor(7, 27, 46);
      pdf.roundedRect(margin, y, contentWidth, 30, 3, 3, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.text("EduPath BD", margin + 7, y + 11);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("Student Admission Progress Report", margin + 7, y + 20);
      y += 39;

      pdf.setFont("helvetica", "bold");
      paragraph(session.user.displayName, 15, [15, 23, 42]);
      pdf.setFont("helvetica", "normal");
      paragraph(`Username: @${session.user.username}  |  Generated: ${new Date().toLocaleString("en-BD")}`, 9, [100, 116, 139]);

      heading(`Shortlisted institutions (${shortlisted.length})`);
      if (!shortlisted.length) paragraph("No institution has been shortlisted yet.");
      shortlisted.forEach((institution, index) => {
        paragraph(`${index + 1}. ${institution.name} - ${institution.type.replaceAll("_", " ")} - ${institution.district}`);
      });

      heading(`Tracked applications (${applications.length})`);
      if (!applications.length) paragraph("No application is currently being tracked.");
      applications.forEach((application, index) => {
        addPageIfNeeded(30);
        const completed = application.documents.filter((document) => document.isCompleted).length;
        pdf.setFont("helvetica", "bold");
        paragraph(`${index + 1}. ${application.programName}`, 11, [15, 23, 42]);
        pdf.setFont("helvetica", "normal");
        paragraph(`${application.institutionName} | Status: ${application.status.replaceAll("_", " ")} | Documents: ${completed}/${application.documents.length}`, 9);
        const missing = application.documents.filter((document) => !document.isCompleted).map((document) => document.title);
        paragraph(missing.length ? `Next documents: ${missing.join(", ")}` : "Document checklist complete.", 9, missing.length ? [180, 83, 9] : [5, 150, 105]);
      });

      heading("Important note");
      paragraph("This planning report is generated from the student's EduPath BD workspace. Admission criteria and dates must always be rechecked using the official source linked in the application.", 9, [71, 85, 105]);

      const pages = pdf.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        pdf.setPage(page);
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`EduPath BD | Page ${page} of ${pages}`, margin, 291);
      }

      const fileName = `EduPath-${safeFileName(session.user.username)}-progress.pdf`;
      const blob = pdf.output("blob");
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "EduPath BD progress report", text: "My admission planning progress from EduPath BD.", files: [file] });
        setMessage(text("Report created and shared.", "রিপোর্ট তৈরি ও শেয়ার করা হয়েছে।"));
      } else {
        pdf.save(fileName);
        setMessage(text("PDF report downloaded.", "PDF রিপোর্ট ডাউনলোড হয়েছে।"));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage(text("Sharing was cancelled. You can create the report again.", "শেয়ার বাতিল হয়েছে। আবার রিপোর্ট তৈরি করতে পারবেন।"));
      } else {
        setMessage(error instanceof Error ? error.message : text("Could not create the report.", "রিপোর্ট তৈরি করা যায়নি।"));
      }
    } finally {
      setBusy(false);
    }
  };

  return <aside className="rounded-[1.5rem] border border-teal-200 bg-teal-50 p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-teal-700"><FileText size={20} /></span>
        <div><h3 className="font-black">{text("Parent / guardian progress report", "অভিভাবকের জন্য অগ্রগতি রিপোর্ট")}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{text("Create a shareable PDF from your shortlist, application status and document checklist.", "শর্টলিস্ট, আবেদনের অবস্থা ও ডকুমেন্ট চেকলিস্ট থেকে শেয়ারযোগ্য PDF তৈরি করুন।")}</p></div>
      </div>
      <button type="button" disabled={busy} onClick={createReport} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#071b2e] px-5 py-3 text-xs font-black text-white disabled:opacity-60">
        {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Download size={16} />}
        {busy ? text("Creating…", "তৈরি হচ্ছে…") : text("Create PDF report", "PDF রিপোর্ট তৈরি করুন")}
      </button>
    </div>
    {message && <p role="status" className="mt-4 rounded-xl bg-white px-4 py-3 text-xs font-bold text-slate-700">{message}</p>}
  </aside>;
}
