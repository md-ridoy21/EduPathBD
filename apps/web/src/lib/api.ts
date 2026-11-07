import type { AppSession } from "../types/auth";

// Browser deployments use the current HTTPS origin and reverse-proxy /api.
// Native builds inject an explicit reachable API URL through build-android.mjs.
export const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

type ApiOptions = RequestInit & { token?: string };
type CacheEnvelope<T> = { storedAt: string; data: T };
const publicCachePrefix = "edupath_public_api:";
let sessionExpiryDispatched = false;

function canUsePublicCache(path: string, options: ApiOptions) {
  const method = (options.method ?? "GET").toUpperCase();
  return method === "GET" && !options.token && ["/api/institutions", "/api/programs", "/api/circulars", "/api/scholarships", "/api/catalog/stats"].some((prefix) => path.startsWith(prefix));
}

function readCached<T>(path: string) {
  try { return (JSON.parse(localStorage.getItem(`${publicCachePrefix}${path}`) || "null") as CacheEnvelope<T> | null)?.data; }
  catch { return undefined; }
}

function writeCached<T>(path: string, data: T) {
  try { localStorage.setItem(`${publicCachePrefix}${path}`, JSON.stringify({ storedAt: new Date().toISOString(), data } satisfies CacheEnvelope<T>)); }
  catch { /* Storage can be unavailable or full; live data still works. */ }
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers, ...requestOptions } = options;
  const cacheable = canUsePublicCache(path, options);
  let handledExpiredSession = false;
  if (cacheable && !navigator.onLine) {
    const cached = readCached<T>(path);
    if (cached !== undefined) return cached;
  }
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      headers: {
        ...(requestOptions.body ? { "Content-Type": "application/json" } : {}),
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    const payload = (await response.json().catch(() => ({ message: "Unexpected server response" }))) as T & { message?: string };
    if (response.status === 401 && token) {
      handledExpiredSession = true;
      localStorage.removeItem("edupath_session");
      if (!sessionExpiryDispatched) {
        sessionExpiryDispatched = true;
        window.dispatchEvent(new CustomEvent("edupath:session-expired"));
        window.dispatchEvent(new CustomEvent("edupath:qa-event", { detail: {
          id: `${Date.now()}-session-expired`, source: "network", severity: "warn", title: "Expired session cleared", detail: "The saved session was rejected and removed before continuing.", timestamp: new Date().toISOString()
        } }));
      }
    } else if (response.ok && token) {
      sessionExpiryDispatched = false;
    }
    if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
    if (cacheable) writeCached(path, payload);
    return payload;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (handledExpiredSession) throw error;
    if (cacheable) {
      const cached = readCached<T>(path);
      if (cached !== undefined) {
        window.dispatchEvent(new CustomEvent("edupath:qa-event", { detail: {
          id: `${Date.now()}-api-cache`, source: "network", severity: "warn", title: `Cached API fallback: ${path}`, detail, timestamp: new Date().toISOString()
        } }));
        return cached;
      }
    }
    const bangla = document.documentElement.lang === "bn";
    const finalError = !navigator.onLine ? new Error(bangla ? "অফলাইনে এই তথ্য আগে সংরক্ষিত হয়নি।" : "This information has not been saved for offline use yet.") : error;
    window.dispatchEvent(new CustomEvent("edupath:qa-event", { detail: {
      id: `${Date.now()}-api`, source: "network", severity: "fail", title: `API request failed: ${path}`, detail: finalError instanceof Error ? finalError.message : String(finalError), timestamp: new Date().toISOString()
    } }));
    throw finalError;
  }
}

export function demoLogin(username: string) {
  return apiRequest<AppSession>("/api/auth/demo-login", {
    method: "POST",
    body: JSON.stringify({ username })
  });
}

export function reserveRegistration(idToken: string, username: string, displayName: string) {
  return apiRequest<{ user: AppSession["user"]; reserved: boolean; emailVerificationRequired: boolean }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ idToken, username, displayName })
  });
}

export function createServerSession(idToken: string, username: string | undefined, displayName: string) {
  return apiRequest<AppSession>("/api/auth/session", {
    method: "POST",
    body: JSON.stringify({ idToken, ...(username ? { username } : {}), displayName })
  });
}
