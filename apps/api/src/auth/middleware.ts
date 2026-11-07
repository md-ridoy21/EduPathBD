import type { NextFunction, Request, Response } from "express";
import type { AppRole } from "./jwt.js";
import { verifyAppToken } from "./jwt.js";

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const header = request.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    response.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    request.auth = verifyAppToken(token);
    next();
  } catch {
    response.status(401).json({ message: "Session is invalid or expired" });
  }
}

export function optionalAuth(request: Request, _response: Response, next: NextFunction) {
  const header = request.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (token) {
    try { request.auth = verifyAppToken(token); } catch { request.auth = undefined; }
  }
  next();
}

export function requireRole(...allowedRoles: AppRole[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.auth || !allowedRoles.includes(request.auth.role)) {
      response.status(403).json({ message: "You do not have permission to access this resource" });
      return;
    }
    next();
  };
}
