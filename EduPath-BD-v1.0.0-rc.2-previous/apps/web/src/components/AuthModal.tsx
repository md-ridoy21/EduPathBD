import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, LoaderCircle, MailCheck, MessageSquareText, Phone, ShieldCheck, UserRound, X, XCircle } from "lucide-react";
import { createUserWithEmailAndPassword, deleteUser, RecaptchaVerifier, sendEmailVerification, signInWithEmailAndPassword, signInWithPhoneNumber, updateProfile } from "firebase/auth";
import type { ConfirmationResult } from "firebase/auth";
import { API_URL, createServerSession, demoLogin, reserveRegistration } from "../lib/api";
import { firebaseConfigured, getFirebaseAuth } from "../lib/firebase";
import { useLocale } from "../lib/locale";
import type { AppSession } from "../types/auth";

type Props = {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (session: AppSession) => void;
};

type Mode = "login" | "register";
type AuthMethod = "email" | "phone";

export function AuthModal({ open, onClose, onAuthenticated }: Props) {
  const { text } = useLocale();
  const [mode, setMode] = useState<Mode>("login");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("email");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("+880");
  const [otp, setOtp] = useState("");
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const [usernameState, setUsernameState] = useState<"idle" | "checking" | "available" | "unavailable">("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const firebaseSubmitDisabled = busy || !firebaseConfigured || !email.trim() || password.length < 6 || (mode === "register" && (!displayName.trim() || usernameState !== "available"));
  const phoneTestMode = import.meta.env.VITE_FIREBASE_PHONE_TEST_MODE === "true";

  useEffect(() => {
    if (mode !== "register" || username.length < 4) {
      setUsernameState("idle");
      return;
    }
    if (!/^[a-z][a-z0-9_]{3,19}$/.test(username)) {
      setUsernameState("unavailable");
      return;
    }
    setUsernameState("checking");
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/auth/username-availability?username=${encodeURIComponent(username)}`, { signal: controller.signal });
        const result = await response.json() as { available: boolean };
        setUsernameState(result.available ? "available" : "unavailable");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setUsernameState("unavailable");
      }
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mode, username]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    verifierRef.current?.clear();
    verifierRef.current = null;
    setPhoneConfirmation(null);
    setOtp("");
  }, [open]);

  const submitFirebase = async () => {
    setBusy(true);
    setMessage("");
    try {
      const auth = getFirebaseAuth();
      if (mode === "register") {
        if (usernameState !== "available") throw new Error("Choose an available username first.");
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        try {
          await updateProfile(credential.user, { displayName });
          const idToken = await credential.user.getIdToken(true);
          await reserveRegistration(idToken, username, displayName);
        } catch (error) {
          await deleteUser(credential.user).catch(() => undefined);
          throw error;
        }
        await sendEmailVerification(credential.user);
        setMessage("Verification email sent. Verify it, then return and sign in.");
        setMode("login");
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await credential.user.reload();
        if (!credential.user.emailVerified) {
          await sendEmailVerification(credential.user);
          throw new Error("Email is not verified. We sent a new verification link.");
        }
        const idToken = await credential.user.getIdToken(true);
        const candidateUsername = (username || credential.user.email?.split("@")[0]?.replace(/[^a-z0-9_]/g, "").slice(0, 20) || "").toLowerCase();
        const preferredUsername = /^[a-z][a-z0-9_]{3,19}$/.test(candidateUsername) ? candidateUsername : undefined;
        const session = await createServerSession(idToken, preferredUsername, credential.user.displayName || displayName || "EduPath Student");
        onAuthenticated(session);
        onClose();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const submitDemo = async (admin = false) => {
    setBusy(true);
    setMessage("");
    try {
      const session = await demoLogin(admin ? "admin_demo" : (username || "student_demo"));
      onAuthenticated(session);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Demo sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const sendPhoneOtp = async () => {
    setBusy(true); setMessage("");
    try {
      if (!firebaseConfigured) throw new Error("Firebase is not configured.");
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("Use an E.164 phone number, for example +8801XXXXXXXXX.");
      if (!/^[a-z][a-z0-9_]{3,19}$/.test(username)) throw new Error("Enter a valid EduPath username.");
      if (displayName.trim().length < 2) throw new Error("Enter your full name.");
      const auth = getFirebaseAuth();
      auth.settings.appVerificationDisabledForTesting = phoneTestMode;
      verifierRef.current?.clear();
      verifierRef.current = new RecaptchaVerifier(auth, "edupath-phone-recaptcha", { size: "invisible" });
      const confirmation = await signInWithPhoneNumber(auth, phone, verifierRef.current);
      setPhoneConfirmation(confirmation);
      setMessage(phoneTestMode ? text("Test OTP requested. Enter the code configured for this fictional Firebase number.", "Test OTP চাওয়া হয়েছে। Firebase-এ fictional নম্বরের জন্য সেট করা code দিন।") : text("OTP sent by Firebase SMS.", "Firebase SMS-এ OTP পাঠানো হয়েছে।"));
    } catch (error) {
      verifierRef.current?.clear(); verifierRef.current = null;
      setMessage(error instanceof Error ? error.message : "Could not request OTP");
    } finally { setBusy(false); }
  };

  const verifyPhoneOtp = async () => {
    if (!phoneConfirmation) return;
    setBusy(true); setMessage("");
    try {
      if (!/^\d{6}$/.test(otp)) throw new Error("Enter the 6-digit OTP.");
      const credential = await phoneConfirmation.confirm(otp);
      await updateProfile(credential.user, { displayName: displayName.trim() });
      const session = await createServerSession(await credential.user.getIdToken(true), username, displayName.trim());
      onAuthenticated(session);
      onClose();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Phone verification failed"); }
    finally { setBusy(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div data-testid="auth-modal-overlay" className="fixed inset-0 z-[80] grid place-items-center bg-[#041321]/75 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl sm:p-7" initial={{ y: 24, opacity: 0, scale: .97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 16, opacity: 0 }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><span className="text-xs font-black uppercase tracking-[.18em] text-teal-700">{text("Secure access", "নিরাপদ প্রবেশ")}</span><h2 id="auth-dialog-title" className="mt-2 text-2xl font-black">{mode === "login" ? text("Welcome back", "স্বাগতম") : text("Create student account", "শিক্ষার্থী অ্যাকাউন্ট তৈরি করুন")}</h2></div>
              <button type="button" className="grid size-11 place-items-center rounded-xl bg-slate-100" onClick={onClose} aria-label={text("Close", "বন্ধ করুন")}><X size={18} /></button>
            </div>

            <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-bold">
              <button type="button" className={`min-h-11 rounded-lg py-2.5 ${mode === "login" ? "bg-white shadow-sm" : "text-slate-500"}`} onClick={() => { setMode("login"); setMessage(""); }}>{text("Sign in", "সাইন ইন")}</button>
              <button type="button" className={`min-h-11 rounded-lg py-2.5 ${mode === "register" ? "bg-white shadow-sm" : "text-slate-500"}`} onClick={() => { setMode("register"); setAuthMethod("email"); setMessage(""); }}>{text("Register", "নিবন্ধন")}</button>
            </div>

            {mode === "login" && <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black"><button type="button" onClick={() => { setAuthMethod("email"); setPhoneConfirmation(null); setMessage(""); }} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border ${authMethod === "email" ? "border-teal-700 bg-teal-50 text-teal-800" : "border-slate-200"}`}><MailCheck size={15} />{text("Email", "ইমেইল")}</button><button type="button" onClick={() => { setAuthMethod("phone"); setMessage(""); }} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border ${authMethod === "phone" ? "border-teal-700 bg-teal-50 text-teal-800" : "border-slate-200"}`}><Phone size={15} />{text("Phone OTP", "ফোন OTP")}</button></div>}

            {authMethod === "email" || mode === "register" ? <div className="mt-5 grid gap-4">
              {mode === "register" && <label className="auth-field"><span>{text("Full name", "পুরো নাম")}</span><div><UserRound size={17} /><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={text("Your full name", "আপনার পুরো নাম")} autoComplete="name" /></div></label>}
              <label className="auth-field"><span>{text("Username", "ইউজারনেম")} {mode === "login" && <small>{text("(needed on first verified login)", "(প্রথম যাচাইকৃত লগইনে প্রয়োজন)")}</small>}</span><div><UserRound size={17} /><input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} placeholder="e.g. rayhan_24" autoComplete="username" />{mode === "register" && usernameState === "checking" && <LoaderCircle className="animate-spin text-slate-400" size={17} />}{mode === "register" && usernameState === "available" && <CheckCircle2 className="text-emerald-600" size={17} />}{mode === "register" && usernameState === "unavailable" && <XCircle className="text-rose-500" size={17} />}</div>{mode === "register" && <small className={usernameState === "available" ? "text-emerald-700" : "text-slate-500"}>{usernameState === "available" ? text("Username is available", "ইউজারনেমটি পাওয়া যাচ্ছে") : text("4–20 lowercase letters, numbers or underscore", "৪–২০টি ছোট হাতের অক্ষর, সংখ্যা বা আন্ডারস্কোর")}</small>}</label>
              <label className="auth-field"><span>{text("Email address", "ইমেইল ঠিকানা")}</span><div><MailCheck size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></div></label>
              <label className="auth-field"><span>{text("Password", "পাসওয়ার্ড")}</span><div><ShieldCheck size={17} /><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={text("Minimum 6 characters", "কমপক্ষে ৬ অক্ষর")} autoComplete={mode === "login" ? "current-password" : "new-password"} /><button aria-label={text("Toggle password visibility", "পাসওয়ার্ড দেখান বা লুকান")} type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            </div> : <div className="mt-5 grid gap-4">
              <label className="auth-field"><span>{text("Full name", "পুরো নাম")}</span><div><UserRound size={17} /><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={text("Required on first phone sign-in", "প্রথম phone sign-in-এ প্রয়োজন")} autoComplete="name" /></div></label>
              <label className="auth-field"><span>{text("Username", "ইউজারনেম")}</span><div><UserRound size={17} /><input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} placeholder="e.g. rayhan_24" autoComplete="username" /></div><small>{text("Used to create your profile on first phone sign-in", "প্রথম phone sign-in-এ profile তৈরিতে ব্যবহৃত হবে")}</small></label>
              <label className="auth-field"><span>{text("Phone number", "ফোন নম্বর")}</span><div><Phone size={17} /><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/[\s()-]/g, ""))} placeholder="+8801XXXXXXXXX" autoComplete="tel" /></div></label>
              {phoneConfirmation && <label className="auth-field"><span>{text("6-digit OTP", "৬ সংখ্যার OTP")}</span><div><MessageSquareText size={17} /><input inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="123456" autoComplete="one-time-code" /></div></label>}
              <div id="edupath-phone-recaptcha" />
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-5 text-amber-900">{phoneTestMode ? text("Free academic demo mode: use only a fictional phone number and OTP configured in Firebase Console. No SMS is sent.", "ফ্রি academic demo mode: Firebase Console-এ সেট করা fictional phone number ও OTP ব্যবহার করুন। কোনো SMS পাঠানো হয় না।") : text("Real Firebase SMS may require the Blaze billing plan. Email and demo access remain available.", "Real Firebase SMS-এর জন্য Blaze billing লাগতে পারে। Email ও demo access চালু থাকবে।")}</p>
            </div>}

            {message && <p role="status" aria-live="polite" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">{message}</p>}
            {authMethod === "email" || mode === "register" ? <button type="button" disabled={firebaseSubmitDisabled} onClick={submitFirebase} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#071b2e] px-5 py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45">{busy && <LoaderCircle className="animate-spin" size={17} />}{mode === "login" ? text("Sign in securely", "নিরাপদভাবে সাইন ইন") : text("Register & verify email", "নিবন্ধন ও ইমেইল যাচাই")}</button> : <button type="button" disabled={busy || !firebaseConfigured} onClick={phoneConfirmation ? verifyPhoneOtp : sendPhoneOtp} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#071b2e] px-5 py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45">{busy && <LoaderCircle className="animate-spin" size={17} />}{phoneConfirmation ? text("Verify OTP & sign in", "OTP যাচাই করে সাইন ইন") : text("Request phone OTP", "ফোন OTP নিন")}</button>}
            {!firebaseConfigured && <p className="mt-2 text-center text-[11px] text-slate-500">{text("Firebase keys are not configured locally. Demo access remains fully testable.", "Firebase key সেট করা নেই; demo access সম্পূর্ণ পরীক্ষা করা যাবে।")}</p>}

            <div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />{text("Demo access", "ডেমো প্রবেশ")}<span className="h-px flex-1 bg-slate-200" /></div>
            <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => submitDemo(false)} disabled={busy} className="min-h-11 rounded-xl border border-slate-200 px-3 py-3 text-xs font-black hover:bg-slate-50">{text("Student demo", "শিক্ষার্থী ডেমো")}</button><button type="button" onClick={() => submitDemo(true)} disabled={busy} className="min-h-11 rounded-xl border border-teal-200 bg-teal-50 px-3 py-3 text-xs font-black text-teal-800 hover:bg-teal-100">{text("Admin demo", "অ্যাডমিন ডেমো")}</button></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
