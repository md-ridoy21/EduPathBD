import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, createReadStream, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import os from "node:os";

const args = process.argv.slice(2);
const readArg = (name) => {
  const equals = args.find((item) => item.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const apiUrl = readArg("--api-url") ?? args.find((item) => /^https?:\/\//.test(item));
const prepareOnly = args.includes("--prepare-only");
const install = args.includes("--install");

if (!apiUrl) {
  console.error("Usage: npm run android:debug -- --api-url http://LAPTOP_IP:4000 [--prepare-only] [--install]");
  process.exit(1);
}

let parsedUrl;
try { parsedUrl = new URL(apiUrl); } catch { console.error("The API URL is invalid."); process.exit(1); }
if (!["http:", "https:"].includes(parsedUrl.protocol)) {
  console.error("The API URL must use http:// or https://.");
  process.exit(1);
}
if (["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
  console.error("A physical phone cannot reach the laptop through localhost. Use the laptop LAN IP or a deployed HTTPS API.");
  process.exit(1);
}
if (!prepareOnly && parsedUrl.protocol !== "https:" && !/^((10\.)|(192\.168\.)|(172\.(1[6-9]|2\d|3[01])\.))/.test(parsedUrl.hostname)) {
  console.error("Debug HTTP builds accept only private LAN addresses. Use HTTPS for a public API.");
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  console.log(`\n> ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, { stdio: "inherit", shell: process.platform === "win32", ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function firstExisting(paths) {
  return paths.filter(Boolean).find((candidate) => existsSync(candidate));
}

function javaMajor(javaBinary) {
  const result = spawnSync(javaBinary, ["-version"], { encoding: "utf8" });
  return Number(`${result.stdout ?? ""}\n${result.stderr ?? ""}`.match(/version "(\d+)/)?.[1] ?? 0);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
run(npm, ["run", "build", "--workspace", "@edupath/web"], { env: { ...process.env, VITE_API_URL: parsedUrl.href.replace(/\/$/, "") } });
run(npm, ["run", "cap:sync", "--workspace", "@edupath/web"], {
  env: { ...process.env, CAPACITOR_ALLOW_MIXED_CONTENT: parsedUrl.protocol === "http:" ? "true" : "false" }
});

if (prepareOnly) {
  console.log("\nAndroid project prepared. Open apps/web/android in Android Studio and press Run.");
  process.exit(0);
}

const androidDir = path.resolve("apps/web/android");
const wrapper = path.join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const home = os.homedir();
const javaHomes = [
  process.env.JAVA_HOME,
  process.platform === "win32" ? "" : "/usr/lib/jvm/java-21-openjdk-amd64",
  process.platform === "win32" ? "C:\\Program Files\\Android\\Android Studio\\jbr" : "",
  "/opt/android-studio/jbr",
  path.join(home, "android-studio", "jbr")
].filter(Boolean);
const javaHome = javaHomes.find((candidate) => {
  const binary = path.join(candidate, "bin", process.platform === "win32" ? "java.exe" : "java");
  const major = existsSync(binary) ? javaMajor(binary) : 0;
  return major >= 21 && major <= 24;
});
if (!javaHome) {
  console.error("A Gradle-compatible JDK was not found. Install JDK 21 and set JAVA_HOME to it; Gradle 8.14.3 cannot run on Java 25.");
  process.exit(1);
}
const sdkRoot = firstExisting([
  process.env.ANDROID_SDK_ROOT,
  process.env.ANDROID_HOME,
  process.platform === "win32" ? path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk") : "",
  path.join(home, "Android", "Sdk"),
  "/opt/android-sdk",
  "/usr/lib/android-sdk"
]);
if (!sdkRoot && !existsSync(path.join(androidDir, "local.properties"))) {
  console.error("Android SDK was not found. Install SDK Platform 36 in Android Studio and open the Android project once.");
  process.exit(1);
}
const buildEnv = { ...process.env, JAVA_HOME: javaHome, ...(sdkRoot ? { ANDROID_HOME: sdkRoot, ANDROID_SDK_ROOT: sdkRoot } : {}) };
run(wrapper, ["assembleDebug"], { cwd: androidDir, env: buildEnv });

const sourceApk = path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
if (!existsSync(sourceApk)) {
  console.error("Gradle completed but app-debug.apk was not found.");
  process.exit(1);
}
const outputDir = path.resolve("output/android");
mkdirSync(outputDir, { recursive: true });
const outputApk = path.join(outputDir, "EduPath-BD-v1.1.0-rc.1-debug.apk");
copyFileSync(sourceApk, outputApk);
const hash = createHash("sha256");
await new Promise((resolve, reject) => createReadStream(outputApk).on("data", (chunk) => hash.update(chunk)).on("end", resolve).on("error", reject));
console.log(`\nAPK ready: ${outputApk}`);
console.log(`SHA-256: ${hash.digest("hex")}`);

if (install) {
  try {
    const adb = firstExisting([
      sdkRoot ? path.join(sdkRoot, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb") : "",
      process.platform === "win32" ? "adb.exe" : "/usr/bin/adb"
    ]) ?? "adb";
    const devices = execFileSync(adb, ["devices"], { encoding: "utf8" }).split(/\r?\n/).slice(1).filter((line) => /\tdevice$/.test(line));
    if (devices.length !== 1) throw new Error(`Expected one authorized phone, found ${devices.length}.`);
    run(adb, ["install", "-r", outputApk]);
    console.log("EduPath BD installed on the connected phone.");
  } catch (error) {
    console.error(`APK was built, but automatic installation failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
