import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronLeft, ChevronRight, Flag, LoaderCircle, MessageCircle, Radio, Reply, Send, Star, ThumbsDown, ThumbsUp, UsersRound, X } from "lucide-react";
import { API_URL, apiRequest } from "../lib/api";
import { useLocale } from "../lib/locale";
import type { AppSession } from "../types/auth";
import type { Institution, Paginated } from "../types/catalog";
import type { CommunityComment, Discussion, RatingSummary, VoteUpdate } from "../types/community";

type Props = { session: AppSession | null; onRequireAuth: () => void };
export function CommunityHub({ session, onRequireAuth }: Props) {
  const { localeCode, text } = useLocale();
  const [institutionId, setInstitutionId] = useState("inst_du");
  const [communityInstitutions, setCommunityInstitutions] = useState<Array<Pick<Institution, "id" | "name">>>([]);
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [rating, setRating] = useState<RatingSummary>({ average: 0, count: 0, distribution: {} });
  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [busy, setBusy] = useState(false);
  const [ratingConnected, setRatingConnected] = useState(false);
  const [discussionConnected, setDiscussionConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [reportTarget, setReportTarget] = useState<CommunityComment | null>(null);
  const [reportReason, setReportReason] = useState("VERIFY_SOURCE");
  const [reportDetails, setReportDetails] = useState("");
  const connected = ratingConnected || discussionConnected;

  useEffect(() => {
    apiRequest<Paginated<Institution>>("/api/institutions?limit=20").then((result) => {
      setCommunityInstitutions(result.data.map(({ id, name }) => ({ id, name })));
      setInstitutionId((current) => result.data.some((item) => item.id === current) ? current : result.data[0]?.id ?? "");
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  const loadComments = async (post: Discussion, targetPage = page) => {
    const result = await apiRequest<{ data: CommunityComment[]; pagination: { pages: number } }>(`/api/discussions/${post.id}/comments?page=${targetPage}&limit=6`, { token: session?.token });
    setComments(result.data); setPages(Math.max(1, result.pagination.pages));
  };

  useEffect(() => {
    if (!institutionId) return;
    setBusy(true); setMessage(""); setPage(1); setReplyTo(null); setReportTarget(null);
    Promise.all([
      apiRequest<Discussion | null>(`/api/institutions/${institutionId}/discussion`, { token: session?.token }),
      apiRequest<RatingSummary>(`/api/institutions/${institutionId}/rating`, { token: session?.token })
    ]).then(async ([post, ratingResult]) => {
      setDiscussion(post); setRating(ratingResult);
      if (post) await loadComments(post, 1); else setComments([]);
    }).catch((error: Error) => setMessage(error.message)).finally(() => setBusy(false));
  }, [institutionId, session?.token]);

  useEffect(() => {
    setRatingConnected(false);
    if (!institutionId) return;
    const source = new EventSource(`${API_URL}/api/realtime/institution/${institutionId}`);
    source.addEventListener("connected", () => setRatingConnected(true));
    source.addEventListener("rating:updated", (event) => setRating(JSON.parse((event as MessageEvent).data) as RatingSummary));
    source.onerror = () => setRatingConnected(false);
    return () => { source.close(); setRatingConnected(false); };
  }, [institutionId]);

  useEffect(() => {
    setDiscussionConnected(false);
    if (!discussion) return;
    const source = new EventSource(`${API_URL}/api/realtime/discussion/${discussion.id}`);
    source.addEventListener("connected", () => setDiscussionConnected(true));
    source.addEventListener("comment:created", () => { void loadComments(discussion, page); });
    source.addEventListener("vote:updated", (event) => {
      const vote = JSON.parse((event as MessageEvent).data) as VoteUpdate;
      setComments((current) => current.map((item) => item.id === vote.commentId ? { ...item, likes: vote.likes, dislikes: vote.dislikes, ...(session ? { userVote: vote.userVote } : {}) } : item));
    });
    source.onerror = () => setDiscussionConnected(false);
    return () => { source.close(); setDiscussionConnected(false); };
  }, [discussion?.id, page, session]);

  const startDiscussion = async () => {
    if (!session) { onRequireAuth(); return; }
    setBusy(true);
    try {
      const name = communityInstitutions.find((item) => item.id === institutionId)?.name ?? "Institution";
      const post = await apiRequest<Discussion>(`/api/institutions/${institutionId}/discussion`, { method: "POST", token: session.token, body: JSON.stringify({ title: `${name} admission discussion`, body: "Ask questions and share source-based admission guidance." }) });
      setDiscussion(post); setComments([]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not start discussion"); }
    finally { setBusy(false); }
  };

  const submitComment = async () => {
    if (!session) { onRequireAuth(); return; }
    if (!discussion || commentBody.trim().length < 2) return;
    setBusy(true); setMessage("");
    try {
      const comment = await apiRequest<CommunityComment>(`/api/discussions/${discussion.id}/comments`, { method: "POST", token: session.token, body: JSON.stringify({ body: commentBody, ...(replyTo ? { parentId: replyTo.id } : {}) }) });
      setComments((current) => current.some((item) => item.id === comment.id) ? current : [...current, comment]);
      setCommentBody(""); setReplyTo(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not post comment"); }
    finally { setBusy(false); }
  };

  const vote = async (comment: CommunityComment, type: "LIKE" | "DISLIKE") => {
    if (!session) { onRequireAuth(); return; }
    setBusy(true); setMessage("");
    try {
      const result = await apiRequest<VoteUpdate>(`/api/comments/${comment.id}/vote`, { method: "POST", token: session.token, body: JSON.stringify({ type: comment.userVote === type ? null : type }) });
      setComments((current) => current.map((item) => item.id === comment.id ? { ...item, likes: result.likes, dislikes: result.dislikes, userVote: result.userVote } : item));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update vote"); }
    finally { setBusy(false); }
  };

  const rate = async (score: number) => {
    if (!session) { onRequireAuth(); return; }
    setBusy(true); setMessage("");
    try {
      const result = await apiRequest<RatingSummary>(`/api/institutions/${institutionId}/rating`, { method: "POST", token: session.token, body: JSON.stringify({ score }) });
      setRating(result);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit rating"); }
    finally { setBusy(false); }
  };

  const submitReport = async () => {
    if (!session) { setReportTarget(null); onRequireAuth(); return; }
    if (!reportTarget) return;
    setBusy(true); setMessage("");
    try {
      await apiRequest(`/api/comments/${reportTarget.id}/report`, { method: "POST", token: session.token, body: JSON.stringify({ reason: reportReason, ...(reportDetails.trim() ? { details: reportDetails.trim() } : {}) }) });
      setMessage(text("Report submitted to the moderation queue. Thank you for helping keep guidance reliable.", "রিপোর্ট moderation queue-তে পাঠানো হয়েছে। তথ্য নির্ভরযোগ্য রাখতে সাহায্য করার জন্য ধন্যবাদ।"));
      setReportTarget(null); setReportDetails(""); setReportReason("VERIFY_SOURCE");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit report"); }
    finally { setBusy(false); }
  };

  const changePage = async (next: number) => {
    if (!discussion) return;
    setBusy(true); setMessage("");
    try {
      await loadComments(discussion, next);
      setPage(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("Could not load this comment page.", "কমেন্টের এই পৃষ্ঠা লোড করা যায়নি।"));
    } finally {
      setBusy(false);
    }
  };

  return <section id="community" className="bg-[#eaf7f5] py-16 lg:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[.2em] text-teal-700">{text("Live student community", "লাইভ শিক্ষার্থী কমিউনিটি")}</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{text("Discuss with real-time trust signals", "রিয়েল-টাইম বিশ্বাসযোগ্যতায় আলোচনা করুন")}</h2><p className="mt-4 text-sm leading-7 text-slate-600">{text("Comments, replies, votes and ratings are stored first, then broadcast live to connected users.", "কমেন্ট, রিপ্লাই, ভোট ও রেটিং প্রথমে ডাটাবেজে সেভ হয়ে সংযুক্ত ব্যবহারকারীদের কাছে লাইভ যায়।")}</p></div><div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold shadow-sm"><Radio size={14} className={connected ? "text-emerald-600" : "text-slate-400"} />{connected ? text("Live connected", "লাইভ সংযুক্ত") : text("Reconnecting", "পুনঃসংযোগ হচ্ছে")}</div></div>

    <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_310px]">
      <div className="rounded-[1.7rem] border border-teal-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><label className="admin-field w-full max-w-sm"><span>{text("Discussion room", "আলোচনা কক্ষ")}</span><select value={institutionId} onChange={(event) => setInstitutionId(event.target.value)}>{communityInstitutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{discussion && <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500"><UsersRound size={16} /> {text(`${comments.length} visible comments`, `${comments.length}টি দৃশ্যমান কমেন্ট`)}</span>}</div>
        {message && <p role="status" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">{message}</p>}
        {busy && discussion && <p role="status" aria-live="polite" className="mt-4 flex items-center gap-2 rounded-xl bg-cyan-50 px-4 py-3 text-xs font-bold text-cyan-900"><LoaderCircle className="animate-spin" size={15} />{text("Updating the community…", "কমিউনিটি আপডেট হচ্ছে…")}</p>}
        {busy && !discussion ? <div className="grid min-h-56 place-items-center"><LoaderCircle className="animate-spin text-teal-700" /></div> : discussion ? <>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4"><h3 className="font-black">{discussion.title}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{discussion.body}</p></div>
          <div className="mt-5 grid gap-3"><AnimatePresence initial={false}>{comments.map((comment) => <motion.article key={comment.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border p-4 ${comment.parentId ? "ml-6 border-cyan-100 bg-cyan-50/40 sm:ml-12" : "border-slate-200"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black">{comment.author.displayName}</p><p className="mt-0.5 text-[10px] text-slate-400">@{comment.author.username} · {new Date(comment.createdAt).toLocaleString(localeCode)}</p></div>{comment.isVerified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700"><CheckCircle2 size={11} /> {text("Verified", "যাচাইকৃত")}</span>}</div><p className="mt-3 text-sm leading-6 text-slate-700">{comment.body}</p><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" aria-label={text("Like", "পছন্দ")} onClick={() => vote(comment, "LIKE")} className={`vote-button ${comment.userVote === "LIKE" ? "bg-teal-700 text-white" : "bg-slate-100"}`}><ThumbsUp size={13} /> {comment.likes}</button><button type="button" aria-label={text("Dislike", "অপছন্দ")} onClick={() => vote(comment, "DISLIKE")} className={`vote-button ${comment.userVote === "DISLIKE" ? "bg-rose-600 text-white" : "bg-slate-100"}`}><ThumbsDown size={13} /> {comment.dislikes}</button><button type="button" onClick={() => { setReplyTo(comment); setCommentBody(""); }} className="vote-button bg-slate-100"><Reply size={13} /> {text("Reply", "উত্তর")}</button><button type="button" onClick={() => session ? setReportTarget(comment) : onRequireAuth()} className="vote-button bg-rose-50 text-rose-700"><Flag size={13} /> {text("Report", "রিপোর্ট")}</button></div></motion.article>)}</AnimatePresence>{!comments.length && <p className="rounded-2xl bg-slate-50 p-8 text-center text-xs text-slate-500">{text("Be the first to add a source-aware question or answer.", "উৎসভিত্তিক প্রথম প্রশ্ন বা উত্তরটি যোগ করুন।")}</p>}</div>
          {pages > 1 && <div className="mt-4 flex items-center justify-center gap-3"><button type="button" className="pagination-button" disabled={busy || page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft size={14} /> {text("Previous", "আগের")}</button><span className="text-xs text-slate-500">{page}/{pages}</span><button type="button" className="pagination-button" disabled={busy || page >= pages} onClick={() => changePage(page + 1)}>{text("Next", "পরের")} <ChevronRight size={14} /></button></div>}
          <div className="mt-6 border-t border-slate-100 pt-5">{replyTo && <div className="mb-3 flex items-center justify-between rounded-xl bg-cyan-50 px-3 py-2 text-xs"><span>{text("Replying to", "উত্তর দিচ্ছেন")} <strong>@{replyTo.author.username}</strong></span><button type="button" className="min-h-11 px-2 font-black text-cyan-800" onClick={() => setReplyTo(null)}>{text("Cancel", "বাতিল")}</button></div>}<div className="flex gap-3"><textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder={session ? text("Write a helpful comment...", "সহায়ক কমেন্ট লিখুন...") : text("Sign in to join the discussion", "আলোচনায় যোগ দিতে সাইন ইন করুন")} className="min-h-24 flex-1 resize-none rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-teal-600" /><button type="button" aria-label={text("Send comment", "কমেন্ট পাঠান")} disabled={busy || !commentBody.trim()} onClick={submitComment} className="grid min-w-12 place-items-center rounded-2xl bg-[#071b2e] text-white disabled:opacity-40"><Send size={18} /></button></div></div>
        </> : <div className="grid min-h-64 place-items-center text-center"><div><MessageCircle className="mx-auto text-teal-700" size={34} /><h3 className="mt-4 font-black">{text("No room yet", "এখনও আলোচনা কক্ষ নেই")}</h3><p className="mt-2 text-xs text-slate-500">{text("Start the first moderated admission discussion.", "প্রথম moderated ভর্তি আলোচনা শুরু করুন।")}</p><button type="button" onClick={startDiscussion} className="mt-4 min-h-11 rounded-xl bg-[#071b2e] px-5 py-3 text-xs font-black text-white">{text("Start discussion", "আলোচনা শুরু করুন")}</button></div></div>}
      </div>

      <aside className="h-fit rounded-[1.7rem] bg-[#071b2e] p-6 text-white shadow-xl"><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-300">{text("Live rating", "লাইভ রেটিং")}</p><div className="mt-5 flex items-end gap-2"><strong className="text-5xl font-black">{rating.average.toFixed(1)}</strong><span className="pb-1 text-sm text-slate-400">/ 5</span></div><div className="mt-3 flex gap-1">{[1, 2, 3, 4, 5].map((score) => <button type="button" className="grid size-11 place-items-center rounded-xl transition hover:bg-white/10" key={score} onClick={() => rate(score)} aria-label={text(`Rate ${score}`, `${score} রেটিং দিন`)}><Star size={24} className={score <= (rating.userScore ?? Math.round(rating.average)) ? "text-amber-300" : "text-slate-600"} fill="currentColor" /></button>)}</div><p className="mt-3 text-xs text-slate-400">{text(`${rating.count} community ratings · one rating per account`, `${rating.count}টি কমিউনিটি রেটিং · প্রতি অ্যাকাউন্টে একটি`)}</p><div className="mt-6 grid gap-2">{[5, 4, 3, 2, 1].map((score) => { const count = rating.distribution[String(score)] ?? 0; const width = rating.count ? (count / rating.count) * 100 : 0; return <div key={score} className="grid grid-cols-[12px_1fr_20px] items-center gap-2 text-[10px] text-slate-400"><span>{score}</span><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-amber-300" style={{ width: `${width}%` }} /></div><span>{count}</span></div>; })}</div><p className="mt-6 border-t border-white/10 pt-5 text-[11px] leading-5 text-slate-400">{text("Ratings express student experience. Eligibility and official information remain separately verified.", "রেটিং শিক্ষার্থীর অভিজ্ঞতা প্রকাশ করে; যোগ্যতা ও অফিসিয়াল তথ্য আলাদাভাবে যাচাই হয়।")}</p></aside>
    </div>
    <AnimatePresence>{reportTarget && <motion.div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setReportTarget(null)}><motion.div role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" initial={{ scale: .96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .96, y: 10 }} className="w-full max-w-md rounded-[1.7rem] bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-rose-700">{text("Community safety", "কমিউনিটি নিরাপত্তা")}</p><h3 id="report-dialog-title" className="mt-1 text-xl font-black">{text("Report this comment", "এই কমেন্ট রিপোর্ট করুন")}</h3></div><button type="button" aria-label={text("Close report dialog", "রিপোর্ট ডায়ালগ বন্ধ করুন")} onClick={() => setReportTarget(null)} className="grid size-11 place-items-center rounded-xl bg-slate-100"><X size={17} /></button></div><p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">“{reportTarget.body.slice(0, 140)}”</p><label className="admin-field mt-4 block"><span>{text("Reason", "কারণ")}</span><select value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option value="VERIFY_SOURCE">{text("Source needs verification", "উৎস যাচাই প্রয়োজন")}</option><option value="MISINFORMATION">{text("Misinformation", "ভুল তথ্য")}</option><option value="HARASSMENT">{text("Harassment", "হয়রানি")}</option><option value="SPAM">{text("Spam", "স্প্যাম")}</option><option value="PRIVACY">{text("Privacy concern", "গোপনীয়তার সমস্যা")}</option><option value="OTHER">{text("Other", "অন্যান্য")}</option></select></label><label className="mt-4 block"><span className="text-xs font-bold text-slate-600">{text("Details (optional)", "বিস্তারিত (ঐচ্ছিক)")}</span><textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} className="mt-2 min-h-24 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-rose-500" maxLength={500} /></label><button type="button" onClick={submitReport} disabled={busy} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Flag size={17} />} {text("Submit report", "রিপোর্ট পাঠান")}</button></motion.div></motion.div>}</AnimatePresence>
  </div></section>;
}
