type Environment = Record<string, string | undefined>;

function booleanFromEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  throw new Error(`Expected a boolean environment value, received: ${value}`);
}

function listFromEnv(value: string | undefined) {
  return [...new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean))];
}

function requireUrl(name: string, value: string | undefined, protocols: string[]) {
  if (!value) throw new Error(`${name} is required outside demo mode.`);
  let parsed: URL;
  try { parsed = new URL(value); }
  catch { throw new Error(`${name} must be a valid URL.`); }
  if (!protocols.includes(parsed.protocol)) throw new Error(`${name} must use ${protocols.join(" or ")}.`);
  return value;
}

function validateOrigin(value: string, allowInsecure: boolean) {
  let parsed: URL;
  try { parsed = new URL(value); }
  catch { throw new Error(`WEB_ORIGINS contains an invalid origin: ${value}`); }
  if (!allowInsecure && parsed.protocol === "http:") throw new Error("Production WEB_ORIGINS must use HTTPS. Set ALLOW_INSECURE_WEB_ORIGINS=true only for a controlled LAN test.");
  if (!["https:", "http:", "capacitor:"].includes(parsed.protocol)) throw new Error(`WEB_ORIGINS contains an unsupported protocol: ${parsed.protocol}`);
  if (!["", "/"].includes(parsed.pathname) || parsed.search || parsed.hash) throw new Error(`WEB_ORIGINS entries must not include a path, query or fragment: ${value}`);
}

const blockedJwtFragments = ["change-before", "replace-with", "example", "demo-secret", "local-docker"];

export function loadConfig(env: Environment = process.env) {
  const nodeEnv = env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  const demoMode = booleanFromEnv(env.DEMO_MODE, !isProduction);
  const allowInsecureOrigins = booleanFromEnv(env.ALLOW_INSECURE_WEB_ORIGINS, false);
  const jwtSecret = env.JWT_SECRET ?? (demoMode ? "edupath-local-demo-secret-change-before-production" : "");
  const databaseUrl = env.DATABASE_URL;
  const explicitOrigins = env.WEB_ORIGINS ?? env.WEB_ORIGIN;
  const webOrigins = listFromEnv(explicitOrigins ?? (demoMode ? "http://localhost:5173,http://127.0.0.1:5173,https://localhost,capacitor://localhost" : undefined));

  if (isProduction && demoMode) throw new Error("DEMO_MODE must be false when NODE_ENV=production.");
  if (!demoMode) {
    if (!databaseUrl) throw new Error("DATABASE_URL is required outside demo mode.");
    if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) throw new Error("DATABASE_URL must be a PostgreSQL connection URL.");
    if (jwtSecret.length < 32 || blockedJwtFragments.some((fragment) => jwtSecret.toLowerCase().includes(fragment))) {
      throw new Error("JWT_SECRET must be at least 32 characters and must not use a documented placeholder.");
    }
    if (!explicitOrigins || webOrigins.length === 0) throw new Error("WEB_ORIGINS must be explicitly configured outside demo mode.");
    webOrigins.forEach((origin) => validateOrigin(origin, allowInsecureOrigins));
    if (!env.FIREBASE_PROJECT_ID) throw new Error("FIREBASE_PROJECT_ID is required outside demo mode.");
    requireUrl("SUPABASE_URL", env.SUPABASE_URL, ["https:"]);
    if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required outside demo mode.");
  }

  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be an integer between 1 and 65535.");

  const shutdownTimeoutMs = Number(env.SHUTDOWN_TIMEOUT_MS ?? 10_000);
  if (!Number.isInteger(shutdownTimeoutMs) || shutdownTimeoutMs < 1_000 || shutdownTimeoutMs > 120_000) throw new Error("SHUTDOWN_TIMEOUT_MS must be an integer between 1000 and 120000.");

  return {
    nodeEnv,
    isProduction,
    demoMode,
    port,
    webOrigin: webOrigins[0],
    webOrigins,
    trustProxy: booleanFromEnv(env.TRUST_PROXY, isProduction),
    logRequests: booleanFromEnv(env.LOG_REQUESTS, isProduction),
    shutdownTimeoutMs,
    jwtSecret,
    databaseUrl,
    firebaseProjectId: env.FIREBASE_PROJECT_ID,
    firebaseServiceAccountJson: env.FIREBASE_SERVICE_ACCOUNT_JSON,
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseStorageBucket: env.SUPABASE_STORAGE_BUCKET ?? "edupath-media",
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL ?? "gemini-2.5-flash-lite"
  } as const;
}

export const config = loadConfig();

export const integrationStatus = {
  database: !config.demoMode && Boolean(config.databaseUrl),
  databaseProvider: config.demoMode ? "demo-memory" : /(?:supabase\.co|pooler\.supabase\.com)/i.test(config.databaseUrl ?? "") ? "supabase-postgresql" : config.databaseUrl ? "postgresql" : "not-configured",
  firebase: Boolean(config.firebaseProjectId),
  phoneOtp: Boolean(config.firebaseProjectId),
  supabaseStorage: Boolean(config.supabaseUrl && config.supabaseServiceRoleKey),
  generativeAi: Boolean(config.geminiApiKey),
  demoMode: config.demoMode
};
