import { lazy, Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Compass,
  FileCheck2,
  GraduationCap,
  Heart,
  Home,
  Languages,
  LoaderCircle,
  MapPin,
  Menu,
  MessageCircle,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  X
} from "lucide-react";
import { ReminderCenter } from "./components/ReminderCenter";
import { NetworkStatusBanner, SectionLoader } from "./components/AppStatus";
import { pathways, type Pathway } from "./data/demo";
import { activateDeadlineReminders } from "./lib/reminders";
import { apiRequest } from "./lib/api";
import { LOCAL_MODEL_INFO, predictPathwayFit } from "./lib/local-pathway-model";
import { useLocale } from "./lib/locale";
import type { AppSession } from "./types/auth";
import type { CatalogStats } from "./types/catalog";

const AuthModal = lazy(() => import("./components/AuthModal").then((module) => ({ default: module.AuthModal })));
const AdmissionWorkspace = lazy(() => import("./components/AdmissionWorkspace").then((module) => ({ default: module.AdmissionWorkspace })));
const AdminDashboard = lazy(() => import("./components/AdminDashboard").then((module) => ({ default: module.AdminDashboard })));
const CommunityHub = lazy(() => import("./components/CommunityHub").then((module) => ({ default: module.CommunityHub })));
const MediaMapHub = lazy(() => import("./components/MediaMapHub").then((module) => ({ default: module.MediaMapHub })));
const ScholarshipHub = lazy(() => import("./components/ScholarshipHub").then((module) => ({ default: module.ScholarshipHub })));
const AiGuidanceHub = lazy(() => import("./components/AiGuidanceHub").then((module) => ({ default: module.AiGuidanceHub })));
const DeviceCheckModal = lazy(() => import("./components/DeviceCheckModal").then((module) => ({ default: module.DeviceCheckModal })));

type Profile = {
  level: string;
  group: string;
  gpa: string;
  sscGpa: string;
  hscGpa: string;
  interest: string;
  location: string;
};

type EligibilityProgram = { id: string; name: string; institutionName: string; academicSession: string; sourceUrl: string; reasons: string[] };
type EligibilityPathway = { id: string; name: string; eligible: boolean; matchingPrograms: number; programsEvaluated: number; reason: string; programs: EligibilityProgram[] };
type EligibilityResponse = { rulesEvaluated: number; engine: string; results: EligibilityPathway[]; disclaimer: string };
type Recommendation = Pathway & { score: number; reasons: string[]; modelVersion: string; rule: EligibilityPathway };

const initialProfile: Profile = {
  level: "HSC",
  group: "Science",
  gpa: "4.80",
  sscGpa: "4.75",
  hscGpa: "4.80",
  interest: "Engineering & Technology",
  location: "Any district"
};

const profileStorageKey = "edupath_pathway_profile";
const pathwayBangla: Record<string, { title: string; category: string; description: string }> = {
  engineering: { title: "ইঞ্জিনিয়ারিং ও প্রযুক্তি", category: "স্নাতক", description: "ইঞ্জিনিয়ারিং বিশ্ববিদ্যালয়, প্রযুক্তি প্রোগ্রাম ও কম্পিউটিংয়ের পথগুলো দেখুন।" },
  medical: { title: "মেডিকেল ও স্বাস্থ্যবিজ্ঞান", category: "স্নাতক", description: "মেডিকেল, ডেন্টাল, নার্সিং ও স্বাস্থ্যশিক্ষার পথ তুলনা করুন।" },
  business: { title: "ব্যবসা ও ব্যবস্থাপনা", category: "উচ্চশিক্ষা", description: "ব্যবসা, ফাইন্যান্স, মার্কেটিং ও উদ্যোক্তা হওয়ার প্রোগ্রাম খুঁজুন।" },
  technical: { title: "ডিপ্লোমা ও কারিগরি দক্ষতা", category: "SSC-পরবর্তী", description: "পলিটেকনিক, ডিপ্লোমা ও চাকরিমুখী কারিগরি শিক্ষার অপশন দেখুন।" },
  general: { title: "সাধারণ ও বহুমুখী শিক্ষা", category: "উচ্চশিক্ষা", description: "মানবিক, সামাজিক বিজ্ঞান ও বহুমুখী ডিগ্রির পথগুলো দেখুন।" }
};

function localizedPathway(id: string, fallback: string, locale: "en" | "bn", field: "title" | "category" | "description" = "title") {
  return locale === "bn" ? pathwayBangla[id]?.[field] ?? fallback : fallback;
}

function loadProfile(): Profile {
  try { return { ...initialProfile, ...JSON.parse(localStorage.getItem(profileStorageKey) || "{}") as Partial<Profile> }; }
  catch { return initialProfile; }
}

function loadStoredSession(): AppSession | null {
  try {
    const saved = localStorage.getItem("edupath_session");
    if (!saved) return null;
    const session = JSON.parse(saved) as AppSession;
    const payloadPart = session.token?.split(".")[1];
    if (!payloadPart) throw new Error("Malformed session token");
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");
    const payload = JSON.parse(atob(normalized)) as { exp?: number };
    if (!payload.exp || payload.exp * 1000 <= Date.now() + 5_000) throw new Error("Expired session token");
    return session;
  } catch {
    localStorage.removeItem("edupath_session");
    return null;
  }
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 }
};

function App() {
  const { locale, setLocale, text } = useLocale();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [profile, setProfile] = useState(loadProfile);
  const [showResults, setShowResults] = useState(false);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityError, setEligibilityError] = useState("");
  const [eligibilityResult, setEligibilityResult] = useState<EligibilityResponse | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [deviceCheckOpen, setDeviceCheckOpen] = useState(false);
  const [reminderCenterOpen, setReminderCenterOpen] = useState(false);
  const [appMessage, setAppMessage] = useState("");
  const [catalogStats, setCatalogStats] = useState<CatalogStats | null>(null);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [activeSection, setActiveSection] = useState("top");
  const [session, setSession] = useState<AppSession | null>(loadStoredSession);

  useEffect(() => {
    if (session) localStorage.setItem("edupath_session", JSON.stringify(session));
    else localStorage.removeItem("edupath_session");
  }, [session]);

  useEffect(() => {
    if (!appMessage) return;
    const timeout = window.setTimeout(() => setAppMessage(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [appMessage]);

  useEffect(() => localStorage.setItem(profileStorageKey, JSON.stringify(profile)), [profile]);

  useEffect(() => activateDeadlineReminders(), []);

  useEffect(() => {
    apiRequest<CatalogStats>("/api/catalog/stats").then(setCatalogStats).catch(() => setCatalogStats(null));
  }, [catalogRevision]);

  useEffect(() => {
    const sectionIds = ["top", "eligibility", "pathways", "institutions", "deadlines", "scholarships", "ai-guide", "media-map", "community"];
    const observed = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActiveSection(visible.target.id);
    }, { rootMargin: "-20% 0px -65%", threshold: [0, .1, .25] });
    const observeAvailableSections = () => sectionIds.forEach((id) => {
      const section = document.getElementById(id);
      if (section && !observed.has(section)) {
        observed.add(section);
        observer.observe(section);
      }
    });
    observeAvailableSections();
    const mutationObserver = new MutationObserver(observeAvailableSections);
    mutationObserver.observe(document.getElementById("main-content") ?? document.body, { childList: true, subtree: true });
    return () => { mutationObserver.disconnect(); observer.disconnect(); };
  }, []);

  useEffect(() => {
    const expired = () => {
      setSession(null);
      setAdminOpen(false);
      setAppMessage(text("Your session expired. Sign in again to continue.", "আপনার সেশন শেষ হয়েছে। চালিয়ে যেতে আবার সাইন ইন করুন।"));
    };
    window.addEventListener("edupath:session-expired", expired);
    return () => window.removeEventListener("edupath:session-expired", expired);
  }, [text]);

  const openDashboard = () => {
    if (!session) setAuthOpen(true);
    else if (session.user.role === "ADMIN" || session.user.role === "MODERATOR") setAdminOpen(true);
    else document.querySelector("#institutions")?.scrollIntoView({ behavior: "smooth" });
  };

  const signOut = () => {
    setSession(null);
    setAdminOpen(false);
    setMobileMenu(false);
    setAppMessage(text("Signed out successfully.", "সফলভাবে সাইন আউট হয়েছে।"));
  };

  const handleAuthenticated = (nextSession: AppSession) => {
    setAppMessage("");
    setSession(nextSession);
  };

  const explorePathway = (title: string) => {
    setProfile((current) => ({ ...current, interest: title }));
    setShowResults(false);
    document.querySelector("#eligibility")?.scrollIntoView({ behavior: "smooth" });
  };

  const generatePathway = async () => {
    const level = profile.level === "Undergraduate" ? "UNDERGRADUATE" : profile.level;
    const group = profile.group.toUpperCase().replaceAll(" ", "_");
    const currentGpa = level === "SSC" ? Number(profile.sscGpa) : Number(profile.hscGpa);
    const sscGpa = Number(profile.sscGpa);
    const hscGpa = Number(profile.hscGpa);
    if (!Number.isFinite(currentGpa) || currentGpa < 0 || currentGpa > 5 || !Number.isFinite(sscGpa) || sscGpa < 0 || sscGpa > 5 || (level !== "SSC" && (!Number.isFinite(hscGpa) || hscGpa < 0 || hscGpa > 5))) {
      setEligibilityError(text("Enter valid GPA values between 0 and 5.", "০ থেকে ৫-এর মধ্যে সঠিক GPA দিন।"));
      setShowResults(false);
      return;
    }
    setEligibilityLoading(true);
    setEligibilityError("");
    try {
      const rules = await apiRequest<EligibilityResponse>("/api/eligibility/evaluate", {
        method: "POST",
        body: JSON.stringify({ level, group, gpa: currentGpa, sscGpa, ...(level !== "SSC" ? { hscGpa } : {}), interest: profile.interest })
      });
      const fits = await Promise.all(pathways.map(async (path) => ({
        ...path,
        ...await predictPathwayFit({ ...profile, gpa: String(currentGpa) }, path),
        rule: rules.results.find((result) => result.id === path.id)
      })));
      const eligible = fits.filter((item): item is Recommendation => Boolean(item.rule?.eligible)).sort((a, b) => b.score - a.score);
      setEligibilityResult(rules);
      setRecommendations(eligible);
      setShowResults(true);
    } catch (error) {
      setEligibilityResult(null);
      setRecommendations([]);
      setShowResults(false);
      setEligibilityError(error instanceof Error ? error.message : text("Eligibility check failed.", "যোগ্যতা যাচাই ব্যর্থ হয়েছে।"));
    } finally {
      setEligibilityLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <a href="#main-content" className="skip-link">{text("Skip to main content", "মূল কনটেন্টে যান")}</a>
      <NetworkStatusBanner />
      {appMessage && <div role="alert" className="fixed bottom-24 left-1/2 z-[80] flex w-[min(92vw,420px)] -translate-x-1/2 items-center justify-between gap-3 rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white shadow-2xl"><span>{appMessage}</span><button type="button" className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-white/10" onClick={() => setAppMessage("")} aria-label={text("Dismiss message", "বার্তা বন্ধ করুন")}><X size={15} /></button></div>}
      <header className="app-header sticky z-50 border-b border-white/10 bg-[#071b2e]/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <a className="flex items-center gap-3" href="#top" aria-label="EduPath BD home">
            <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-emerald-300 to-cyan-400 text-[#071b2e] shadow-lg shadow-cyan-500/20">
              <GraduationCap size={23} strokeWidth={2.2} />
            </span>
            <span>
              <strong className="block text-base tracking-tight">EduPath BD</strong>
              <small className="block text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-100/70">{text("Plan with confidence", "আত্মবিশ্বাসের সাথে পরিকল্পনা")}</small>
            </span>
          </a>

          <nav className="hidden items-center gap-5 text-sm font-medium text-slate-200 lg:flex">
            <a className="transition hover:text-emerald-300" href="#pathways">{text("Pathways", "পথসমূহ")}</a>
            <a className="transition hover:text-emerald-300" href="#eligibility">{text("Eligibility", "যোগ্যতা")}</a>
            <a className="transition hover:text-emerald-300" href="#institutions">{text("Institutions", "প্রতিষ্ঠান")}</a>
            <a className="transition hover:text-emerald-300" href="#scholarships">{text("Scholarships", "স্কলারশিপ")}</a>
            <a className="transition hover:text-emerald-300" href="#media-map">{text("Campus media", "ক্যাম্পাস মিডিয়া")}</a>
            <a className="transition hover:text-emerald-300" href="#community">{text("Community", "কমিউনিটি")}</a>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <button type="button" onClick={() => setLocale(locale === "en" ? "bn" : "en")} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-3 text-xs font-black text-slate-200 transition hover:border-emerald-300 hover:text-emerald-300" aria-label={text("Switch to Bangla", "Switch to English")}><Languages size={17} />{locale === "en" ? "বাংলা" : "EN"}</button>
            <button type="button" onClick={() => setReminderCenterOpen(true)} className="grid size-11 place-items-center rounded-full border border-white/15 text-slate-200 transition hover:border-emerald-300 hover:text-emerald-300" aria-label={text("Open reminders", "রিমাইন্ডার খুলুন")}>
              <Bell size={18} />
            </button>
            {session && <button type="button" onClick={signOut} className="grid size-11 place-items-center rounded-full border border-white/15 text-slate-200 transition hover:border-rose-300 hover:text-rose-300" aria-label={text("Sign out", "সাইন আউট")}><LogOut size={17} /></button>}
            <button type="button" data-testid="desktop-auth-action" onClick={openDashboard} className="min-h-11 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#071b2e] transition hover:bg-emerald-200">{session ? (session.user.role === "STUDENT" ? session.user.displayName : text("Admin dashboard", "অ্যাডমিন ড্যাশবোর্ড")) : text("Sign in", "সাইন ইন")}</button>
          </div>

          <button type="button" data-testid="mobile-navigation-toggle" className="grid size-11 touch-manipulation place-items-center rounded-xl border border-white/15 transition active:scale-95 lg:hidden" onClick={() => setMobileMenu((open) => !open)} aria-label={text("Toggle navigation", "নেভিগেশন খুলুন বা বন্ধ করুন")} aria-expanded={mobileMenu} aria-controls="mobile-navigation">
            {mobileMenu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {mobileMenu && (
          <div id="mobile-navigation" className="border-t border-white/10 px-4 py-4 lg:hidden">
            <nav className="grid gap-2 text-sm text-slate-200">
              {[["pathways", text("Pathways", "পথসমূহ")], ["eligibility", text("Eligibility", "যোগ্যতা")], ["institutions", text("Institutions", "প্রতিষ্ঠান")], ["deadlines", text("Deadlines", "সময়সীমা")], ["scholarships", text("Scholarships", "স্কলারশিপ")], ["media-map", text("Campus map, video and audio", "ক্যাম্পাস ম্যাপ, ভিডিও ও অডিও")], ["community", text("Community", "কমিউনিটি")]].map(([id, label]) => (
                <a key={id} className="flex min-h-11 items-center rounded-xl px-3 py-2 hover:bg-white/10" href={`#${id}`} onClick={() => setMobileMenu(false)}>{label}</a>
              ))}
              <button type="button" onClick={() => { setLocale(locale === "en" ? "bn" : "en"); setMobileMenu(false); }} className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-left font-bold"><Languages size={16} />{locale === "en" ? "বাংলায় দেখুন" : "View in English"}</button>
              <button type="button" onClick={() => { setMobileMenu(false); setReminderCenterOpen(true); }} className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-left font-bold"><Bell size={16} />{text("Deadline reminders", "ডেডলাইন রিমাইন্ডার")}</button>
              <button type="button" data-testid="mobile-auth-action" onClick={() => { setMobileMenu(false); openDashboard(); }} className="mt-2 min-h-11 rounded-xl bg-white px-3 py-2.5 text-left font-bold text-[#071b2e]">{session ? (session.user.role === "STUDENT" ? text("Open admission workspace", "অ্যাডমিশন ওয়ার্কস্পেস খুলুন") : text("Open admin dashboard", "অ্যাডমিন ড্যাশবোর্ড খুলুন")) : text("Sign in / Register", "সাইন ইন / রেজিস্টার")}</button>
              {session && <button type="button" onClick={signOut} className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-rose-300/40 bg-rose-400/10 px-3 py-2.5 text-left font-bold text-rose-100"><LogOut size={16} />{text("Sign out", "সাইন আউট")}</button>}
            </nav>
          </div>
        )}
      </header>

      <main id="main-content" tabIndex={-1}>
        <section id="top" className="relative overflow-hidden bg-[#071b2e] text-white">
          <div className="hero-grid absolute inset-0 opacity-30" />
          <div className="absolute -left-24 top-32 size-72 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute -right-16 top-8 size-80 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-8 lg:py-28">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.55 }}>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3.5 py-2 text-xs font-semibold text-emerald-200">
                <Sparkles size={14} /> {text("AI-powered guidance for Bangladesh", "বাংলাদেশের জন্য AI-চালিত গাইডেন্স")}
              </div>
              {session && <div className="mb-5 flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200"><ShieldCheck size={15} className="text-emerald-300" /> {text("Signed in as", "সাইন ইন করেছেন")} <strong>{session.user.username}</strong></div>}
              <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
                {text("Your education journey,", "তোমার শিক্ষা যাত্রা,")}
                <span className="text-gradient block">{text("planned around you.", "পরিকল্পিত তোমাকে ঘিরে।")}</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                {text("Check eligibility, compare institutions, discover scholarships and turn your academic goals into a clear, trackable pathway.", "যোগ্যতা যাচাই করো, প্রতিষ্ঠান তুলনা করো, স্কলারশিপ খুঁজে নাও এবং শিক্ষার লক্ষ্যকে স্পষ্ট ও ট্র্যাকযোগ্য পরিকল্পনায় রূপ দাও।")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-6 py-3.5 text-sm font-black text-[#071b2e] shadow-xl shadow-emerald-500/10 transition hover:-translate-y-0.5 hover:bg-emerald-200" href="#eligibility">
                  {text("Check my eligibility", "আমার যোগ্যতা যাচাই করুন")} <ChevronRight size={17} />
                </a>
                <a className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-bold transition hover:bg-white/10" href="#pathways">
                  <Compass size={17} /> {text("Explore pathways", "শিক্ষার পথগুলো দেখুন")}
                </a>
              </div>
              <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 border-t border-white/10 pt-6">
                {[[catalogStats ? String(catalogStats.institutions) : "—", text("Verified institutions", "যাচাইকৃত প্রতিষ্ঠান")], [catalogStats ? String(catalogStats.programs) : "—", text("Verified programs", "যাচাইকৃত প্রোগ্রাম")], [catalogStats ? String(catalogStats.circulars) : "—", text("Verified circulars", "যাচাইকৃত সার্কুলার")]].map(([value, label]) => (
                  <div key={label}>
                    <strong className="block text-xl font-black text-white sm:text-2xl">{value}</strong>
                    <span className="text-xs text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }} className="relative">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-3 shadow-2xl backdrop-blur-xl">
                <div className="rounded-[1.5rem] bg-white p-5 text-slate-950 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">{text("Today’s plan", "আজকের পরিকল্পনা")}</span>
                      <h2 className="mt-1 text-2xl font-black tracking-tight">{text("Good morning", "শুভ সকাল")}, {session?.user.displayName || text("Student", "শিক্ষার্থী")}</h2>
                    </div>
                    <span className="grid size-11 place-items-center rounded-2xl bg-slate-100"><UserRound size={20} /></span>
                  </div>
                  <div className="mt-6 rounded-2xl bg-gradient-to-r from-[#0c2943] to-[#104a59] p-5 text-white">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200"><Target size={15} /> {text("Planning workspace", "পরিকল্পনা ওয়ার্কস্পেস")}</div>
                    <div className="mt-3 flex items-end justify-between gap-4"><strong className="text-2xl">{text("Choose your next step", "পরবর্তী ধাপ বেছে নিন")}</strong><span className="text-xs text-slate-300">{text("5 tools ready", "৫টি টুল প্রস্তুত")}</span></div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <DashboardTile href="#profile" icon={<FileCheck2 size={18} />} title={text("Update profile", "প্রোফাইল আপডেট") } text={text("Check your eligibility", "যোগ্যতা যাচাই করুন")} tone="cyan" />
                    <DashboardTile href="#deadlines" icon={<CalendarDays size={18} />} title={text("Admission deadlines", "ভর্তির সময়সীমা")} text={text("Set a reminder", "রিমাইন্ডার সেট করুন")} tone="amber" />
                    <DashboardTile href="#institutions" icon={<Heart size={18} />} title={text("Shortlist choices", "পছন্দ শর্টলিস্ট") } text={text("Compare institutions", "প্রতিষ্ঠান তুলনা করুন")} tone="rose" />
                    <DashboardTile href="#ai-guide" icon={<Bot size={18} />} title={text("Ask Edu AI", "Edu AI-কে জিজ্ঞেস করুন")} text={text("Get a sourced answer", "উৎসসহ উত্তর পান")} tone="violet" />
                    <DashboardTile href="#media-map" icon={<MapPin size={18} />} title={text("Explore campuses", "ক্যাম্পাস দেখুন")} text={text("Map, video and audio", "ম্যাপ, ভিডিও ও অডিও")} tone="cyan" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="eligibility" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <SectionHeading eyebrow={text("Start with your profile", "প্রোফাইল দিয়ে শুরু করুন")} title={text("Find pathways you are eligible for", "তোমার যোগ্য শিক্ষার পথ খুঁজে নাও")} text={text("A verified rules engine checks your academic profile first. AI then explains the best-fit options in simple language.", "Verified rules engine প্রথমে তোমার academic profile যাচাই করে। এরপর AI সহজ ভাষায় সবচেয়ে উপযুক্ত অপশনগুলো ব্যাখ্যা করে।")} />
          <div className="mt-10 grid gap-6 lg:grid-cols-[.92fr_1.08fr]">
            <div id="profile" className="scroll-mt-28 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={text("Current stage", "বর্তমান শিক্ষাস্তর")}>
                  <select value={profile.level} onChange={(event) => setProfile({ ...profile, level: event.target.value })}><option value="SSC">SSC</option><option value="HSC">HSC</option><option value="Undergraduate">{text("Undergraduate", "স্নাতক")}</option></select>
                </Field>
                <Field label={text("Academic group", "শিক্ষা বিভাগ")}>
                  <select value={profile.group} onChange={(event) => setProfile({ ...profile, group: event.target.value })}><option value="Science">{text("Science", "বিজ্ঞান")}</option><option value="Business Studies">{text("Business Studies", "ব্যবসায় শিক্ষা")}</option><option value="Humanities">{text("Humanities", "মানবিক")}</option><option value="Vocational">{text("Vocational", "ভোকেশনাল")}</option></select>
                </Field>
                <Field label={text("SSC GPA", "SSC জিপিএ")}>
                  <input type="number" min="0" max="5" step="0.01" value={profile.sscGpa} onChange={(event) => setProfile({ ...profile, sscGpa: event.target.value, ...(profile.level === "SSC" ? { gpa: event.target.value } : {}) })} />
                </Field>
                {profile.level !== "SSC" && <Field label={text("HSC GPA", "HSC জিপিএ")}>
                  <input type="number" min="0" max="5" step="0.01" value={profile.hscGpa} onChange={(event) => setProfile({ ...profile, hscGpa: event.target.value, gpa: event.target.value })} />
                </Field>}
                <Field label={text("Preferred location", "পছন্দের স্থান")}>
                  <select value={profile.location} onChange={(event) => setProfile({ ...profile, location: event.target.value })}><option value="Any district">{text("Any district", "যেকোনো জেলা")}</option><option>Dhaka</option><option>Chattogram</option><option>Rangpur</option><option>Rajshahi</option></select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label={text("Primary interest", "প্রধান আগ্রহ")}>
                    <select value={profile.interest} onChange={(event) => setProfile({ ...profile, interest: event.target.value })}>{pathways.map((path) => <option key={path.id} value={path.title}>{localizedPathway(path.id, path.title, locale)}</option>)}</select>
                  </Field>
                </div>
              </div>
              <button type="button" disabled={eligibilityLoading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#071b2e] px-5 py-3.5 text-sm font-black text-white transition hover:bg-[#0d3655] disabled:cursor-wait disabled:opacity-70" onClick={generatePathway}>
                {eligibilityLoading ? <LoaderCircle className="animate-spin" size={17} /> : <Sparkles size={17} />} {eligibilityLoading ? text("Checking verified rules…", "যাচাইকৃত নিয়ম দেখা হচ্ছে…") : text("Generate my pathway", "আমার শিক্ষার পথ তৈরি করুন")}
              </button>
              {eligibilityError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-center text-xs font-semibold text-rose-700">{eligibilityError}</p>}
              <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">{text(`${LOCAL_MODEL_INFO.name} v${LOCAL_MODEL_INFO.version} uses TensorFlow.js on-device inference. Eligibility comes from verified database rules.`, `${LOCAL_MODEL_INFO.name} v${LOCAL_MODEL_INFO.version} TensorFlow.js দিয়ে অন-ডিভাইস inference চালায়। যোগ্যতা যাচাইকৃত database rule থেকে আসে।`)}</p>
            </div>

            <div id="recommendations" className="min-h-[420px] scroll-mt-28 rounded-[2rem] bg-[#eaf7f5] p-5 sm:p-7">
              {!showResults ? (
                <div className="grid h-full min-h-[360px] place-items-center text-center">
                  <div className="max-w-sm">
                    <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-white text-teal-700 shadow-sm"><Compass size={28} /></span>
                    <h3 className="mt-5 text-xl font-black">{text("Your recommendations will appear here", "তোমার সুপারিশগুলো এখানে দেখা যাবে")}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{text("Complete the profile to see verified eligible pathways and personalized fit scores.", "যোগ্য পথ ও ব্যক্তিগত fit score দেখতে প্রোফাইলটি সম্পূর্ণ করুন।")}</p>
                  </div>
                </div>
              ) : (
                <motion.div initial="hidden" animate="visible" variants={fadeUp}>
                  <div className="flex items-center justify-between gap-4">
                    <div><span className="text-xs font-bold uppercase tracking-wider text-teal-700">{text("Your result", "তোমার ফলাফল")}</span><h3 className="mt-1 text-2xl font-black">{text("Best-fit pathways", "সবচেয়ে উপযুক্ত শিক্ষার পথ")}</h3></div>
                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-teal-700">{recommendations.length} {text("pathways", "পথ")}</span>
                  </div>
                  {eligibilityResult && <p className="mt-2 text-[11px] text-slate-500">{text(`${eligibilityResult.rulesEvaluated} current database rules checked`, `${eligibilityResult.rulesEvaluated}টি বর্তমান database rule যাচাই হয়েছে`)} · {eligibilityResult.engine}</p>}
                  <div className="mt-5 grid gap-3">
                    {recommendations.length ? recommendations.slice(0, 3).map((path, index) => (
                      <motion.article key={path.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-4">
                          <span className={`grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${path.color} text-white`}><GraduationCap size={20} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3"><h4 className="font-black">{localizedPathway(path.id, path.title, locale)}</h4><strong className="text-sm text-teal-700">{path.score}% {text("fit", "ফিট")}</strong></div>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{localizedPathway(path.id, path.description, locale, "description")}</p>
                            <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 size={13} /> {path.rule.matchingPrograms} {text("verified program rules matched", "যাচাইকৃত program rule মিলেছে")} · TF.js v{path.modelVersion}</div>
                            <p className="mt-1 text-[10px] text-slate-400">{path.reasons.slice(0, 2).join(" · ")}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">{path.rule.programs.slice(0, 3).map((program) => <a key={program.id} href={program.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold leading-4 text-slate-600 underline decoration-slate-300">{program.institutionName} · {program.name}</a>)}</div>
                          </div>
                        </div>
                      </motion.article>
                    )) : <div className="rounded-2xl bg-white p-5 text-sm text-slate-600">{text("No current verified admission rule matched this profile. Change the stage/group/GPA or open the latest official circular.", "বর্তমান যাচাইকৃত কোনো admission rule এই প্রোফাইলের সাথে মেলেনি। শিক্ষাস্তর/বিভাগ/GPA পরিবর্তন করুন অথবা সর্বশেষ official circular দেখুন।")}</div>}
                  </div>
                  {eligibilityResult && <p className="mt-4 text-[10px] leading-5 text-slate-500">{eligibilityResult.disclaimer}</p>}
                </motion.div>
              )}
            </div>
          </div>
        </section>

        <section id="pathways" className="bg-white py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow={text("Explore every route", "সব পথ অনুসন্ধান করুন")} title={text("One place for every academic decision", "শিক্ষার প্রতিটি সিদ্ধান্ত এক জায়গায়")} text={text("From school subject choices to higher study and early-career planning, each pathway stays connected to verified requirements and next actions.", "স্কুলের বিষয় নির্বাচন থেকে উচ্চশিক্ষা ও ক্যারিয়ার পরিকল্পনা পর্যন্ত প্রতিটি পথ verified requirement এবং পরবর্তী করণীয়ের সাথে যুক্ত।")} />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {pathways.map((path, index) => (
                <motion.article key={path.id} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }} className="group rounded-[1.7rem] border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/60">
                  <span className={`grid size-12 place-items-center rounded-2xl bg-gradient-to-br ${path.color} text-white shadow-lg`}><BookOpen size={21} /></span>
                  <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{localizedPathway(path.id, path.category, locale, "category")}</p>
                  <h3 className="mt-2 text-lg font-black leading-6">{localizedPathway(path.id, path.title, locale)}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{localizedPathway(path.id, path.description, locale, "description")}</p>
                  <button type="button" onClick={() => explorePathway(path.title)} className="mt-5 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-teal-700">{text("Explore", "বিস্তারিত দেখুন")} <ChevronRight size={15} className="transition group-hover:translate-x-1" /></button>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <Suspense fallback={<SectionLoader />}>
          <AdmissionWorkspace session={session} refreshKey={catalogRevision} onRequireAuth={() => setAuthOpen(true)} />
          <ScholarshipHub />
          <AiGuidanceHub session={session} onRequireAuth={() => setAuthOpen(true)} />
          <CommunityHub session={session} onRequireAuth={() => setAuthOpen(true)} />
          <MediaMapHub session={session} onRequireAuth={() => setAuthOpen(true)} />
        </Suspense>
      </main>

      <nav className="mobile-bottom-nav fixed inset-x-3 z-40 grid grid-cols-5 rounded-2xl border border-slate-200 bg-white/95 px-2 py-2 shadow-2xl backdrop-blur lg:hidden">
        <MobileNav icon={<Home size={19} />} label={text("Home", "হোম")} href="#top" active={activeSection === "top"} />
        <MobileNav icon={<Compass size={19} />} label={text("Explore", "অনুসন্ধান")} href="#institutions" active={activeSection === "institutions" || activeSection === "pathways"} />
        <MobileNav icon={<Target size={19} />} label={text("Match", "ম্যাচ")} href="#eligibility" active={activeSection === "eligibility"} />
        <MobileNav icon={<CalendarDays size={19} />} label={text("Plan", "পরিকল্পনা")} href="#deadlines" active={activeSection === "deadlines"} />
        <MobileNav icon={<MessageCircle size={19} />} label={text("Community", "কমিউনিটি")} href="#community" active={activeSection === "community"} />
      </nav>

      <footer className="bg-[#041321] px-4 py-8 text-center text-xs text-slate-500"><p>{text("EduPath BD · Verified guidance for informed decisions", "EduPath BD · সঠিক সিদ্ধান্তের জন্য যাচাইকৃত গাইডেন্স")}</p><button type="button" onClick={() => setDeviceCheckOpen(true)} className="mt-3 min-h-11 rounded-full border border-slate-700 px-4 py-2 font-bold text-slate-300 transition hover:border-emerald-300 hover:text-emerald-300">{text("Device check", "ডিভাইস যাচাই")}</button></footer>

      <Suspense fallback={null}>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={handleAuthenticated} />
        <DeviceCheckModal open={deviceCheckOpen} onClose={() => setDeviceCheckOpen(false)} />
        <ReminderCenter open={reminderCenterOpen} onClose={() => setReminderCenterOpen(false)} />
        {session && (session.user.role === "ADMIN" || session.user.role === "MODERATOR") && <AdminDashboard session={session} open={adminOpen} onClose={() => setAdminOpen(false)} onContentChanged={() => setCatalogRevision((current) => current + 1)} />}
      </Suspense>
    </div>
  );
}

function SectionHeading({ eyebrow, title, text, dark = false }: { eyebrow: string; title: string; text: string; dark?: boolean }) {
  return <div className="max-w-2xl"><p className={`text-xs font-black uppercase tracking-[0.2em] ${dark ? "text-emerald-300" : "text-teal-700"}`}>{eyebrow}</p><h2 className={`mt-3 text-3xl font-black tracking-[-0.025em] sm:text-4xl ${dark ? "text-white" : "text-slate-950"}`}>{title}</h2><p className={`mt-4 text-sm leading-7 sm:text-base ${dark ? "text-slate-300" : "text-slate-600"}`}>{text}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold text-slate-600">{label}</span><div className="field-shell">{children}</div></label>;
}

function DashboardTile({ icon, title, text, tone, href }: { icon: React.ReactNode; title: string; text: string; tone: "cyan" | "amber" | "rose" | "violet"; href: string }) {
  const tones = { cyan: "bg-cyan-50 text-cyan-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700", violet: "bg-violet-50 text-violet-700" };
  return <a href={href} className="rounded-2xl border border-slate-100 p-3.5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"><span className={`grid size-9 place-items-center rounded-xl ${tones[tone]}`}>{icon}</span><strong className="mt-3 block text-sm">{title}</strong><span className="mt-1 block text-[11px] text-slate-500">{text}</span></a>;
}

function MobileNav({ icon, label, href, active = false }: { icon: React.ReactNode; label: string; href: string; active?: boolean }) {
  return <a href={href} className={`grid place-items-center gap-1 rounded-xl py-1.5 text-[10px] font-bold ${active ? "bg-[#071b2e] text-white" : "text-slate-500"}`}>{icon}<span>{label}</span></a>;
}

export default App;
