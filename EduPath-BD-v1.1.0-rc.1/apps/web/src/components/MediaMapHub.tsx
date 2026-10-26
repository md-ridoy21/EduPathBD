import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { CloudUpload, Crosshair, ExternalLink, FileAudio, FileText, Film, Image, LoaderCircle, MapPin, PlayCircle, ShieldCheck, Volume2 } from "lucide-react";
import { apiRequest } from "../lib/api";
import { useLocale } from "../lib/locale";
import type { AppSession } from "../types/auth";

type Props = { session: AppSession | null; onRequireAuth: () => void };
type UploadedMedia = { fileName: string; mimeType: string; size: number; url: string; storagePath: string; mode: "demo" | "supabase" };
type MediaResource = { id: string; institutionId?: string; institutionName?: string; type: "YOUTUBE" | "AUDIO" | "IMAGE" | "DOCUMENT"; title: string; url: string; thumbnailUrl?: string; languageCode?: "en" | "bn"; verified: boolean; updatedAt: string };

const campuses = [
  { id: "inst_du", name: "University of Dhaka", district: "Dhaka", lat: 23.7338, lng: 90.3929, sourceUrl: "https://www.du.ac.bd" },
  { id: "inst_buet", name: "BUET", district: "Dhaka", lat: 23.7267, lng: 90.3925, sourceUrl: "https://www.buet.ac.bd" },
  { id: "inst_cu", name: "University of Chittagong", district: "Chattogram", lat: 22.4707, lng: 91.7877, sourceUrl: "https://cu.ac.bd" },
  { id: "inst_brur", name: "Begum Rokeya University", district: "Rangpur", lat: 25.7177, lng: 89.2588, sourceUrl: "https://brur.ac.bd" }
];

const uploadMimeByExtension: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg"
};
const acceptedUploadMimes = new Set(Object.values(uploadMimeByExtension));

function resolveUploadMime(file: File) {
  const browserMime = file.type.toLowerCase() === "audio/x-wav" ? "audio/wav" : file.type.toLowerCase();
  if (acceptedUploadMimes.has(browserMime)) return browserMime;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return uploadMimeByExtension[extension];
}

export function MediaMapHub({ session, onRequireAuth }: Props) {
  const { locale, localeCode, text } = useLocale();
  const [campusId, setCampusId] = useState("inst_du");
  const [upload, setUpload] = useState<UploadedMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [mapProvider, setMapProvider] = useState<"leaflet" | "google">("leaflet");
  const [media, setMedia] = useState<MediaResource[]>([]);
  const [mediaBusy, setMediaBusy] = useState(true);
  const [mediaError, setMediaError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY as string | undefined;
  const campus = campuses.find((item) => item.id === campusId) ?? campuses[0]!;
  const googleMapUrl = googleMapsKey ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(googleMapsKey)}&q=${campus.lat},${campus.lng}&zoom=15` : "";
  const video = useMemo(() => media.find((item) => item.type === "YOUTUBE" && item.institutionId === campus.id)
    ?? media.find((item) => item.type === "YOUTUBE" && !item.institutionId), [campus.id, media]);
  const audio = useMemo(() => {
    const candidates = media.filter((item) => item.type === "AUDIO");
    return candidates.find((item) => item.institutionId === campus.id && item.languageCode === locale)
      ?? candidates.find((item) => item.institutionId === campus.id && !item.languageCode)
      ?? candidates.find((item) => !item.institutionId && item.languageCode === locale)
      ?? candidates.find((item) => !item.institutionId && !item.languageCode);
  }, [campus.id, locale, media]);
  const localGuideAudioUrl = (locale === "bn" ? import.meta.env.VITE_GUIDE_AUDIO_BN_URL : import.meta.env.VITE_GUIDE_AUDIO_EN_URL) as string | undefined;
  const isGlobalVideo = Boolean(video && !video.institutionId);

  useEffect(() => {
    let active = true;
    setMediaBusy(true); setMediaError("");
    apiRequest<{ data: MediaResource[] }>(`/api/institutions/${campus.id}/media`).then((result) => {
      if (active) setMedia(result.data);
    }).catch((error: Error) => {
      if (active) { setMedia([]); setMediaError(error.message); }
    }).finally(() => { if (active) setMediaBusy(false); });
    return () => { active = false; };
  }, [campus.id]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  useEffect(() => { window.speechSynthesis?.cancel(); setSpeaking(false); }, [campus.id]);

  const speakCampusGuide = () => {
    if (!("speechSynthesis" in window)) { setMediaError(text("Audio guidance is not supported by this browser.", "এই ব্রাউজারে অডিও গাইডেন্স সমর্থিত নয়।")); return; }
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const guide = text(
      `${campus.name} is in ${campus.district}. Before applying, compare program eligibility, current deadlines, fees and the official source. Use EduPath recommendations as guidance, then confirm every requirement on the institution website.`,
      `${campus.name} ${campus.district}-এ অবস্থিত। আবেদন করার আগে প্রোগ্রামের যোগ্যতা, বর্তমান সময়সীমা, ফি এবং অফিসিয়াল উৎস মিলিয়ে দেখুন। EduPath-এর পরামর্শকে গাইড হিসেবে ব্যবহার করুন এবং প্রতিষ্ঠানের ওয়েবসাইটে প্রতিটি শর্ত নিশ্চিত করুন।`
    );
    const utterance = new SpeechSynthesisUtterance(guide);
    utterance.lang = localeCode;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => { setSpeaking(false); setMediaError(text("The device could not play the generated guide.", "ডিভাইসটি তৈরি করা গাইড চালাতে পারেনি।")); };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const findNearestCampus = () => {
    if (!("geolocation" in navigator)) { setLocationMessage(text("Location is not supported on this device.", "এই ডিভাইসে location support নেই।")); return; }
    setLocationMessage(text("Finding your nearest listed campus…", "আপনার কাছের তালিকাভুক্ত ক্যাম্পাস খোঁজা হচ্ছে…"));
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const position = { lat: coords.latitude, lng: coords.longitude };
      const nearest = [...campuses].sort((a, b) => Math.hypot(a.lat - position.lat, a.lng - position.lng) - Math.hypot(b.lat - position.lat, b.lng - position.lng))[0]!;
      setUserPosition(position);
      setCampusId(nearest.id);
      setLocationMessage(text(`${nearest.name} is the nearest campus in the current verified map list.`, `বর্তমান যাচাইকৃত map list-এ ${nearest.name} সবচেয়ে কাছের ক্যাম্পাস।`));
    }, () => setLocationMessage(text("Location permission was unavailable. Select a campus manually.", "Location permission পাওয়া যায়নি। নিজে ক্যাম্পাস নির্বাচন করুন।")), { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 });
  };

  const uploadFile = async (file?: File) => {
    if (!file) return;
    if (!session) { onRequireAuth(); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage(text("File must be 5 MB or smaller.", "ফাইলটি ৫ MB বা তার কম হতে হবে।")); return; }
    if (file.size === 0) { setMessage(text("The selected file is empty.", "নির্বাচিত ফাইলটি খালি।")); return; }
    const mimeType = resolveUploadMime(file);
    if (!mimeType) { setMessage(text("Choose a PDF, JPG, PNG, WebP, MP3, WAV or OGG file.", "PDF, JPG, PNG, WebP, MP3, WAV অথবা OGG ফাইল নির্বাচন করুন।")); return; }
    setBusy(true); setMessage("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error(text("Could not read this file.", "ফাইলটি পড়া যায়নি।")));
        reader.readAsDataURL(file);
      });
      const result = await apiRequest<UploadedMedia>("/api/media/upload", { method: "POST", token: session.token, body: JSON.stringify({ fileName: file.name, mimeType, base64, institutionId: campus.id }) });
      setUpload(result);
      setMessage(result.mode === "demo" ? text("Demo upload complete and submitted for admin review.", "ডেমো আপলোড সম্পন্ন এবং admin review-এর জন্য পাঠানো হয়েছে।") : text("Cloud upload complete and submitted for admin review.", "ক্লাউড আপলোড সম্পন্ন এবং admin review-এর জন্য পাঠানো হয়েছে।"));
    } catch (error) { setMessage(error instanceof Error ? error.message : text("Upload failed.", "আপলোড ব্যর্থ হয়েছে।")); }
    finally { setBusy(false); }
  };

  return <section id="media-map" className="bg-white py-16 lg:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[.2em] text-teal-700">{text("Campus and learning resources", "ক্যাম্পাস ও শেখার রিসোর্স")}</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{text("See the place, watch and listen", "স্থান দেখুন, ভিডিও দেখুন ও অডিও শুনুন")}</h2><p className="mt-4 text-sm leading-7 text-slate-600">{text("OpenStreetMap needs no paid key. External media and secure cloud uploads keep institution resources useful without making the app package heavy.", "OpenStreetMap-এর কোনো paid key লাগে না। External media ও নিরাপদ cloud upload অ্যাপকে ভারী না করে প্রয়োজনীয় রিসোর্স দেখায়।")}</p></div>
    <div className="mt-9 grid gap-5 lg:grid-cols-2">
      <article className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-slate-50"><div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div><p className="text-xs font-black uppercase tracking-wider text-teal-700">{mapProvider === "google" ? "Google Maps Embed API" : text("Interactive Leaflet map", "ইন্টারঅ্যাকটিভ Leaflet ম্যাপ")}</p><h3 className="mt-1 text-lg font-black">{campus.name}</h3><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={13} /> {campus.district}</p><div className="mt-3 flex rounded-lg bg-white p-1 text-[10px] font-black"><button type="button" onClick={() => setMapProvider("leaflet")} className={`min-h-11 rounded-md px-3 py-2 ${mapProvider === "leaflet" ? "bg-[#071b2e] text-white" : "text-slate-500"}`}>Leaflet / OSM</button><button type="button" disabled={!googleMapsKey} title={googleMapsKey ? "" : "Set VITE_GOOGLE_MAPS_EMBED_KEY to enable"} onClick={() => setMapProvider("google")} className={`min-h-11 rounded-md px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40 ${mapProvider === "google" ? "bg-[#071b2e] text-white" : "text-slate-500"}`}>Google Embed</button></div></div><div className="grid gap-2"><label className="admin-field min-w-56"><span>{text("Select campus", "ক্যাম্পাস নির্বাচন করুন")}</span><select value={campusId} onChange={(event) => { setCampusId(event.target.value); setUserPosition(null); setLocationMessage(""); }}>{campuses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" onClick={findNearestCampus} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-teal-700"><Crosshair size={15} />{text("Find nearest listed campus", "কাছের তালিকাভুক্ত ক্যাম্পাস")}</button></div></div>{locationMessage && <p role="status" className="mx-5 mb-4 rounded-xl bg-white px-3 py-2 text-xs text-slate-600">{locationMessage}</p>}{mapProvider === "google" && googleMapUrl ? <iframe src={googleMapUrl} className="h-[340px] w-full border-0" loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" title={`${campus.name} Google Maps`} /> : <MapContainer key={`${campus.id}-${userPosition?.lat ?? "campus"}`} center={userPosition ? [userPosition.lat, userPosition.lng] : [campus.lat, campus.lng]} zoom={userPosition ? 10 : 15} scrollWheelZoom className="h-[340px] w-full" aria-label={`${campus.name} interactive OpenStreetMap`}><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><CircleMarker center={[campus.lat, campus.lng]} radius={10} pathOptions={{ color: "#0f766e", fillColor: "#34d399", fillOpacity: 0.9 }}><Popup><strong>{campus.name}</strong><br />{campus.district}</Popup></CircleMarker>{userPosition && <CircleMarker center={[userPosition.lat, userPosition.lng]} radius={8} pathOptions={{ color: "#1d4ed8", fillColor: "#60a5fa", fillOpacity: 0.9 }}><Popup>{text("Your approximate location", "আপনার আনুমানিক অবস্থান")}</Popup></CircleMarker>}</MapContainer>}<a href={`https://www.openstreetmap.org/?mlat=${campus.lat}&mlon=${campus.lng}#map=16/${campus.lat}/${campus.lng}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 border-t border-slate-200 bg-white p-3 text-xs font-black text-teal-700">{text("Open full map", "সম্পূর্ণ ম্যাপ খুলুন")} <ExternalLink size={13} /></a></article>

      <div className="grid gap-5">
        <article className="overflow-hidden rounded-[1.7rem] bg-[#071b2e] text-white">
          {mediaBusy ? <div className="grid aspect-video place-items-center"><LoaderCircle className="animate-spin text-emerald-300" size={28} aria-label={text("Loading verified media", "যাচাইকৃত মিডিয়া লোড হচ্ছে")} /></div> : video ? <div className="aspect-video"><iframe className="size-full border-0" src={video.url} title={video.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div> : <div className="aspect-video"><video className="size-full bg-slate-950 object-cover" src="/media/edupath-admission-guide-en.mp4" controls preload="metadata" aria-label={text("EduPath admission planning guide", "EduPath ভর্তি পরিকল্পনা গাইড")} /></div>}
          <div className="flex items-start gap-3 p-5"><PlayCircle className="shrink-0 text-emerald-300" size={22} /><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{video?.title ?? text("EduPath admission planning guide", "EduPath ভর্তি পরিকল্পনা গাইড")}</h3><span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-200">{video && !isGlobalVideo ? text("Institution", "প্রতিষ্ঠান") : text("Fallback", "ফলব্যাক")}</span></div><p className="mt-1 text-xs leading-5 text-slate-400">{video && !isGlobalVideo ? text("This institution-specific video passed the admin verification workflow.", "এই প্রতিষ্ঠানভিত্তিক ভিডিও admin verification workflow-তে অনুমোদিত।") : text("No institution-specific video is published, so a verified global or bundled EduPath admission guide is shown.", "প্রতিষ্ঠানভিত্তিক ভিডিও প্রকাশিত না হওয়ায় যাচাইকৃত global অথবা bundled EduPath ভর্তি গাইড দেখানো হচ্ছে।")}</p></div></div>
        </article>
        <article className="rounded-[1.7rem] border border-slate-200 p-5"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700"><FileAudio size={20} /></span><div><h3 className="font-black">{audio?.title ?? text("Campus admission audio guide", "ক্যাম্পাস ভর্তি অডিও গাইড")}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{audio ? text("The best verified recording for the selected institution and app language is loaded.", "নির্বাচিত প্রতিষ্ঠান ও app language-এর জন্য সবচেয়ে উপযুক্ত যাচাইকৃত recording load হয়েছে।") : localGuideAudioUrl ? text("The local EduPath guide matching the current app language is loaded.", "বর্তমান app language অনুযায়ী local EduPath guide load হয়েছে।") : text("Until a verified recording is configured, the device reads a relevant institution-specific guide aloud.", "যাচাইকৃত recording configure না হওয়া পর্যন্ত ডিভাইস প্রাসঙ্গিক প্রতিষ্ঠানভিত্তিক গাইড পড়ে শোনাবে।")}</p></div></div>{audio ? <audio key={audio.id} src={audio.url} className="mt-4 w-full" controls preload="metadata" /> : localGuideAudioUrl ? <audio key={`${locale}-${localGuideAudioUrl}`} src={localGuideAudioUrl} className="mt-4 w-full" controls preload="metadata" /> : <button type="button" onClick={speakCampusGuide} aria-pressed={speaking} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-50 px-4 py-3 text-xs font-black text-violet-800"><Volume2 size={16} />{speaking ? text("Stop audio guide", "অডিও গাইড বন্ধ করুন") : text("Listen to planning guide", "পরিকল্পনা গাইড শুনুন")}</button>}{mediaError && <p role="alert" className="mt-3 text-xs leading-5 text-rose-700">{mediaError}</p>}<a href={campus.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs font-black text-teal-700">{text("Verify on institution website", "প্রতিষ্ঠানের ওয়েবসাইটে যাচাই করুন")} <ExternalLink size={13} /></a></article>
      </div>
    </div>

    <article className="mt-5 rounded-[1.7rem] border border-dashed border-teal-300 bg-teal-50/50 p-5 sm:p-7"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-center"><div className="flex items-start gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-teal-700 shadow-sm"><CloudUpload size={22} /></span><div><h3 className="text-lg font-black">{text("Cloud resource upload", "ক্লাউড রিসোর্স আপলোড")}</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">{text("Verified users can upload PDF, image or audio files up to 5 MB. Production mode stores them in the configured Supabase bucket; demo mode provides an immediate local preview.", "যাচাইকৃত ব্যবহারকারী সর্বোচ্চ ৫ MB PDF, ছবি বা অডিও আপলোড করতে পারবেন। Production mode-এ Supabase bucket-এ সংরক্ষণ হবে; demo mode-এ সঙ্গে সঙ্গে preview দেখা যাবে।")}</p></div></div>{session ? <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#071b2e] px-5 py-3 text-xs font-black text-white">{busy ? <LoaderCircle className="animate-spin" size={16} /> : <CloudUpload size={16} />}{text("Choose file", "ফাইল নির্বাচন করুন")}<input className="hidden" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/ogg" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void uploadFile(file); }} /></label> : <button type="button" onClick={onRequireAuth} className="min-h-11 rounded-xl bg-[#071b2e] px-5 py-3 text-xs font-black text-white">{text("Sign in to upload", "আপলোড করতে সাইন ইন করুন")}</button>}</div>
      {message && <p className="mt-4 rounded-xl bg-white px-4 py-3 text-xs text-slate-700">{message}</p>}
      {upload && <div className="mt-5 rounded-2xl border border-teal-100 bg-white p-4"><div className="flex items-center gap-3">{upload.mimeType.startsWith("image/") ? <Image size={20} className="text-teal-700" /> : upload.mimeType.startsWith("audio/") ? <FileAudio size={20} className="text-violet-700" /> : <FileText size={20} className="text-rose-700" />}<div className="min-w-0"><p className="truncate text-sm font-black">{upload.fileName}</p><p className="text-[10px] text-slate-500">{Math.ceil(upload.size / 1024)} KB · {upload.mode === "supabase" ? text("Cloud stored", "ক্লাউডে সংরক্ষিত") : text("Demo preview", "ডেমো প্রিভিউ")}</p></div><ShieldCheck className="ml-auto text-emerald-600" size={18} /></div>{upload.mimeType.startsWith("image/") && <img src={upload.url} alt={upload.fileName} className="mt-4 max-h-64 rounded-xl object-contain" />}{upload.mimeType.startsWith("audio/") && <audio src={upload.url} controls className="mt-4 w-full" />}{upload.mimeType === "application/pdf" && <a href={upload.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-black">{text("Open uploaded PDF", "আপলোড করা PDF খুলুন")} <ExternalLink size={13} /></a>}</div>}
    </article>
  </div></section>;
}
