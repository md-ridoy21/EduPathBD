import { API_URL } from "./api";

export type QaSeverity = "pass" | "warn" | "fail";
export type QaSource = "runtime" | "network" | "dom" | "api" | "device";

export type QaResult = {
  id: string;
  source: QaSource;
  severity: QaSeverity;
  title: string;
  detail: string;
  timestamp: string;
};

export const qaEventName = "edupath:qa-event";

export function reportQaEvent(result: Omit<QaResult, "id" | "timestamp">) {
  window.dispatchEvent(new CustomEvent<QaResult>(qaEventName, {
    detail: {
      ...result,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString()
    }
  }));
}

function result(source: QaSource, severity: QaSeverity, title: string, detail: string): QaResult {
  return {
    id: `${source}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    source,
    severity,
    title,
    detail,
    timestamp: new Date().toISOString()
  };
}

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function accessibleName(element: HTMLElement) {
  const labelledBy = element.getAttribute("aria-labelledby");
  const labelledText = labelledBy
    ?.split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent?.trim())
    .filter(Boolean)
    .join(" ");
  const control = element as HTMLInputElement;
  const labelText = control.labels ? [...control.labels].map((label) => label.textContent?.trim()).filter(Boolean).join(" ") : "";
  return element.getAttribute("aria-label")?.trim()
    || labelledText
    || labelText
    || element.getAttribute("title")?.trim()
    || element.textContent?.trim()
    || control.placeholder?.trim()
    || control.value?.trim();
}

function brokenHashLinks() {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const broken = links.filter((link) => {
    const id = decodeURIComponent(link.hash.slice(1));
    return id && !document.getElementById(id);
  });
  return { links, broken };
}

async function waitForLazyNavigationTargets() {
  const deadline = performance.now() + 3000;
  let state = brokenHashLinks();
  while (state.broken.length && performance.now() < deadline) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    state = brokenHashLinks();
  }
  return state;
}

async function checkEndpoint(path: string, label: string): Promise<QaResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);
  const started = performance.now();
  try {
    const response = await fetch(`${API_URL}${path}`, { signal: controller.signal });
    if (!response.ok) return result("api", "fail", `${label} API`, `HTTP ${response.status} from ${path}`);
    await response.json();
    return result("api", "pass", `${label} API`, `HTTP ${response.status} · ${Math.round(performance.now() - started)} ms`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return result("api", "fail", `${label} API`, `${path} · ${message}`);
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function runQualityAudit(runtimeEvents: QaResult[]): Promise<QaResult[]> {
  const checks: QaResult[] = [];
  await document.fonts?.ready;
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
  const allIds = [...document.querySelectorAll<HTMLElement>("[id]")].map((element) => element.id);
  const duplicates = [...new Set(allIds.filter((id, index) => allIds.indexOf(id) !== index))];
  checks.push(result("dom", duplicates.length ? "fail" : "pass", "Unique element IDs", duplicates.length ? `Duplicate IDs: ${duplicates.join(", ")}` : `${allIds.length} IDs checked`));

  const { links: hashLinks, broken: brokenLinks } = await waitForLazyNavigationTargets();
  const brokenTargets = [...new Set(brokenLinks.map((link) => link.hash))];
  checks.push(result("dom", brokenTargets.length ? "fail" : "pass", "In-page navigation", brokenTargets.length ? `Broken links: ${brokenTargets.join(", ")}` : `${hashLinks.length} section links checked after lazy content settled`));

  const interactive = [...document.querySelectorAll<HTMLElement>('button, a[href], input:not([type="hidden"]), select, textarea')].filter(isVisible);
  const unnamed = interactive.filter((element) => !accessibleName(element));
  checks.push(result("dom", unnamed.length ? "fail" : "pass", "Accessible controls", unnamed.length ? `${unnamed.length} visible controls have no accessible name` : `${interactive.length} visible controls have names`));

  const smallTargets = interactive.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width < 40 || rect.height < 40;
  });
  const touchLayout = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 1024;
  const compactTargetDetails = smallTargets.slice(0, 12).map((element) => {
    const rect = element.getBoundingClientRect();
    const name = accessibleName(element)?.replace(/\s+/g, " ").slice(0, 45) || element.tagName.toLowerCase();
    return `${name} (${Math.round(rect.width)}×${Math.round(rect.height)})`;
  }).join(", ");
  checks.push(result(
    "device",
    touchLayout && smallTargets.length ? "warn" : "pass",
    "Touch target size",
    touchLayout
      ? (smallTargets.length ? `${smallTargets.length} compact controls: ${compactTargetDetails}` : `${interactive.length} visible controls meet the minimum size`)
      : `Fine-pointer desktop layout; touch sizing will be checked at tablet/mobile width${smallTargets.length ? ` (${smallTargets.length} compact mouse controls present)` : ""}`
  ));

  const images = [...document.querySelectorAll<HTMLImageElement>("img")];
  const missingAlt = images.filter((image) => !image.hasAttribute("alt"));
  checks.push(result("dom", missingAlt.length ? "fail" : "pass", "Image alternatives", missingAlt.length ? `${missingAlt.length} images are missing alt text` : `${images.length} images checked`));

  const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  checks.push(result("device", overflow > 2 ? "fail" : "pass", "Horizontal overflow", overflow > 2 ? `Page is ${overflow}px wider than the viewport` : `Viewport ${window.innerWidth}×${window.innerHeight}px fits`));

  const h1Count = document.querySelectorAll("h1").length;
  checks.push(result("dom", h1Count === 1 ? "pass" : "warn", "Heading structure", `${h1Count} visible page-level h1 element(s) found`));

  try {
    const key = "edupath_qa_storage_check";
    localStorage.setItem(key, "ok");
    const stored = localStorage.getItem(key) === "ok";
    localStorage.removeItem(key);
    checks.push(result("device", stored ? "pass" : "fail", "Local storage", stored ? "Read and write succeeded" : "Stored value could not be read"));
  } catch (error) {
    checks.push(result("device", "fail", "Local storage", error instanceof Error ? error.message : String(error)));
  }

  const newRuntimeFailures = runtimeEvents.filter((event) => event.severity === "fail");
  checks.push(result("runtime", newRuntimeFailures.length ? "fail" : "pass", "Captured runtime errors", newRuntimeFailures.length ? `${newRuntimeFailures.length} error(s) captured during this browser session` : "No runtime or network exception captured"));

  const endpointChecks = await Promise.all([
    checkEndpoint("/api/health", "Health"),
    checkEndpoint("/api/catalog/stats", "Catalog stats"),
    checkEndpoint("/api/institutions?page=1&limit=1", "Institutions"),
    checkEndpoint("/api/programs?limit=1", "Programs"),
    checkEndpoint("/api/circulars?limit=1", "Circulars")
  ]);
  return [...checks, ...endpointChecks];
}
