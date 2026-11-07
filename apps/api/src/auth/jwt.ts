import jwt from "jsonwebtoken";
import { config } from "../config.js";

export type AppRole = "STUDENT" | "MODERATOR" | "ADMIN";

export type AppTokenPayload = {
  sub: string;
  username: string;
  email: string;
  displayName: string;
  role: AppRole;
  emailVerified: boolean;
  phoneVerified: boolean;
};

export function issueAppToken(payload: AppTokenPayload) {
  return jwt.sign(payload, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: "2h",
    issuer: "edupath-api",
    audience: "edupath-app"
  });
}

export function verifyAppToken(token: string) {
  return jwt.verify(token, config.jwtSecret, {
    algorithms: ["HS256"],
    issuer: "edupath-api",
    audience: "edupath-app"
  }) as AppTokenPayload;
}
