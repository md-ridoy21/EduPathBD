import type { AppTokenPayload } from "../auth/jwt.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AppTokenPayload;
    }
  }
}

export {};
