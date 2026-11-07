import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const apiEnvironmentFile = fileURLToPath(new URL("../../apps/api/.env", import.meta.url));

// Deployment-provided variables remain authoritative. The local file only fills
// missing values for repository-level operational commands.
loadDotenv({ path: apiEnvironmentFile, override: false, quiet: true });
