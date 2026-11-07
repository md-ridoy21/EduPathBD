export type DeadlineReminder = { id: string; title: string; institution: string; deadline: string };

const storageKey = "edupath_deadline_reminders";
const notifiedKey = "edupath_deadline_notified";
const timers = new Map<string, number>();

function notificationId(id: string) {
  let hash = 0;
  for (const character of id) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash || 1) % 1_000_000_000;
}

async function scheduleNativeReminder(reminder: DeadlineReminder, requestPermission = false, confirmation = false) {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return false;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display === "prompt" && requestPermission) permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") return false;
  await LocalNotifications.createChannel({ id: "deadlines", name: "Admission deadlines", description: "Saved EduPath admission deadline reminders", importance: 4 }).catch(() => undefined);
  const id = notificationId(reminder.id);
  await LocalNotifications.cancel({ notifications: [{ id }, { id: id + 1 }] });
  const deadline = new Date(reminder.deadline).getTime();
  const dueAt = Math.max(Date.now() + 2_000, deadline - 24 * 60 * 60 * 1000);
  const notifications = deadline > Date.now() ? [{
    id,
    title: "Admission deadline approaching",
    body: `${reminder.institution}: ${reminder.title}`,
    schedule: { at: new Date(dueAt), allowWhileIdle: true },
    channelId: "deadlines",
    extra: { reminderId: reminder.id, url: "/#deadlines" }
  }] : [];
  if (confirmation) notifications.push({
    id: id + 1,
    title: "EduPath reminder enabled",
    body: `${reminder.institution}: ${new Date(reminder.deadline).toLocaleDateString()}`,
    schedule: { at: new Date(Date.now() + 750), allowWhileIdle: true },
    channelId: "deadlines",
    extra: { reminderId: reminder.id, url: "/#deadlines" }
  });
  if (notifications.length) await LocalNotifications.schedule({ notifications });
  return true;
}

async function showReminder(reminder: DeadlineReminder, confirmation = false) {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || Notification.permission !== "granted") return false;
  const registration = await navigator.serviceWorker.register("/sw.js");
  await registration.showNotification(confirmation ? "EduPath reminder enabled" : "Admission deadline approaching", {
    body: `${reminder.institution}: deadline ${new Date(reminder.deadline).toLocaleDateString()}`,
    tag: `edupath-${confirmation ? "enabled" : "due"}-${reminder.id}`,
    data: { url: "/#deadlines" }
  });
  return true;
}

function scheduleReminder(reminder: DeadlineReminder) {
  const existing = timers.get(reminder.id);
  if (existing) window.clearTimeout(existing);
  let notified: Set<string>;
  try { notified = new Set<string>(JSON.parse(localStorage.getItem(notifiedKey) || "[]") as string[]); }
  catch { notified = new Set<string>(); }
  if (notified.has(reminder.id)) return;
  const deadline = new Date(reminder.deadline).getTime();
  const target = deadline - 24 * 60 * 60 * 1000;
  if (deadline <= Date.now()) return;
  const delay = target - Date.now();
  if (delay <= 0) {
    void showReminder(reminder).then((shown) => {
      if (shown) { notified.add(reminder.id); localStorage.setItem(notifiedKey, JSON.stringify([...notified])); }
    });
    return;
  }
  const timer = window.setTimeout(() => scheduleReminder(reminder), Math.min(delay, 6 * 60 * 60 * 1000));
  timers.set(reminder.id, timer);
}

export function getReminderIds() {
  return getDeadlineReminders().map((item) => item.id);
}

export function getDeadlineReminders() {
  try { return JSON.parse(localStorage.getItem(storageKey) || "[]") as DeadlineReminder[]; }
  catch { return []; }
}

export function removeDeadlineReminder(id: string) {
  const remaining = getDeadlineReminders().filter((item) => item.id !== id);
  localStorage.setItem(storageKey, JSON.stringify(remaining));
  const timer = timers.get(id);
  if (timer) window.clearTimeout(timer);
  timers.delete(id);
  void import("@capacitor/core").then(async ({ Capacitor }) => {
    if (!Capacitor.isNativePlatform()) return;
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const nativeId = notificationId(id);
    await LocalNotifications.cancel({ notifications: [{ id: nativeId }, { id: nativeId + 1 }] });
  }).catch(() => undefined);
  window.dispatchEvent(new CustomEvent("edupath:reminders-changed"));
}

export async function enableDeadlineReminder(reminder: DeadlineReminder) {
  const current = (() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "[]") as DeadlineReminder[]; }
    catch { return []; }
  })();
  localStorage.setItem(storageKey, JSON.stringify([reminder, ...current.filter((item) => item.id !== reminder.id)]));
  window.dispatchEvent(new CustomEvent("edupath:reminders-changed"));

  scheduleReminder(reminder);
  if (await scheduleNativeReminder(reminder, true, true)) return "notification" as const;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "in-app" as const;
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return "in-app" as const;
  await showReminder(reminder, true);
  scheduleReminder(reminder);
  return "notification" as const;
}

export function activateDeadlineReminders() {
  try { (JSON.parse(localStorage.getItem(storageKey) || "[]") as DeadlineReminder[]).forEach((reminder) => { scheduleReminder(reminder); void scheduleNativeReminder(reminder).catch(() => undefined); }); }
  catch { localStorage.removeItem(storageKey); }
}

export async function clearAllDeadlineReminders() {
  const reminders = getDeadlineReminders();
  for (const timer of timers.values()) window.clearTimeout(timer);
  timers.clear();
  localStorage.removeItem(storageKey);
  localStorage.removeItem(notifiedKey);
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform() && reminders.length) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.cancel({ notifications: reminders.flatMap((reminder) => {
        const id = notificationId(reminder.id);
        return [{ id }, { id: id + 1 }];
      }) });
    }
  } catch {
    // Local account data is still cleared if native notification cleanup is unavailable.
  }
  window.dispatchEvent(new CustomEvent("edupath:reminders-changed"));
}
