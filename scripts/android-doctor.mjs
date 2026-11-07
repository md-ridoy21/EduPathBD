import { existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

function command(command, args = []) {
  try { return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch { return ""; }
}

function firstExisting(paths) {
  return paths.filter(Boolean).find((candidate) => existsSync(candidate));
}

const home = os.homedir();
const javaBinary = firstExisting([
  process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java") : "",
  process.platform === "win32" ? "C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\java.exe" : "",
  "/opt/android-studio/jbr/bin/java",
  path.join(home, "android-studio", "jbr", "bin", "java"),
  command(process.platform === "win32" ? "where" : "which", ["java"])
]) ?? "java";
const javaResult = spawnSync(javaBinary, ["-version"], { encoding: "utf8" });
const javaOutput = `${javaResult.stdout ?? ""}\n${javaResult.stderr ?? ""}`;
const javaMajor = Number(javaOutput.match(/version "(\d+)/)?.[1] ?? 0);
const sdkRoot = firstExisting([
  process.env.ANDROID_SDK_ROOT,
  process.env.ANDROID_HOME,
  process.platform === "win32" ? path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk") : "",
  path.join(home, "Android", "Sdk"),
  "/opt/android-sdk",
  "/usr/lib/android-sdk"
]);
const adb = firstExisting([
  sdkRoot ? path.join(sdkRoot, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb") : "",
  command(process.platform === "win32" ? "where" : "which", ["adb"])
]);
const androidProject = path.resolve("apps/web/android");
const checks = [
  { name: "Node.js 22+", ok: Number(process.versions.node.split(".")[0]) >= 22, detail: process.version },
  { name: "Java 21–24", ok: javaMajor >= 21 && javaMajor <= 24, detail: javaMajor ? `Java ${javaMajor} · ${javaBinary}` : "not found" },
  { name: "Android SDK", ok: Boolean(sdkRoot), detail: sdkRoot ?? "not found" },
  { name: "Android API 36", ok: Boolean(sdkRoot && existsSync(path.join(sdkRoot, "platforms", "android-36"))), detail: "required by compileSdk 36" },
  { name: "Android platform-tools", ok: Boolean(adb), detail: adb ?? "adb not found" },
  { name: "Capacitor Android project", ok: existsSync(path.join(androidProject, "gradlew")), detail: androidProject }
];

console.log("EduPath BD Android Doctor\n");
for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name} — ${item.detail}`);

if (adb) {
  const devices = command(adb, ["devices"]).split(/\r?\n/).slice(1).filter((line) => /\tdevice$/.test(line));
  console.log(`${devices.length ? "PASS" : "WARN"}  USB device — ${devices.length ? `${devices.length} authorized device(s)` : "connect phone and authorize USB debugging"}`);
}

const blockers = checks.filter((item) => !item.ok);
if (blockers.length) {
  console.log("\nSetup action: install SDK Platform 36 and JDK 21. Gradle 8.14.3 cannot run on Java 25; set JAVA_HOME to the JDK 21 installation. Open apps/web/android once so Android Studio can create local.properties.");
  process.exitCode = 1;
} else {
  console.log("\nAndroid build environment is ready.");
}
