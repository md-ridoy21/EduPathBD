import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetsAt: number };
type Options = { windowMs: number; max: number; keyPrefix: string };

export function rateLimit({ windowMs, max, keyPrefix }: Options) {
  const buckets = new Map<string, Bucket>();
  let requestsSinceCleanup = 0;

  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    requestsSinceCleanup += 1;
    if (requestsSinceCleanup >= 500 || buckets.size > 10_000) {
      requestsSinceCleanup = 0;
      for (const [storedKey, storedBucket] of buckets) {
        if (storedBucket.resetsAt <= now) buckets.delete(storedKey);
      }
      while (buckets.size > 10_000) {
        const oldestKey = buckets.keys().next().value as string | undefined;
        if (!oldestKey) break;
        buckets.delete(oldestKey);
      }
    }
    const key = `${keyPrefix}:${request.auth?.sub ?? request.ip ?? "unknown"}`;
    const existing = buckets.get(key);
    const bucket = !existing || existing.resetsAt <= now
      ? { count: 1, resetsAt: now + windowMs }
      : { count: existing.count + 1, resetsAt: existing.resetsAt };
    buckets.set(key, bucket);

    response.setHeader("RateLimit-Limit", String(max));
    response.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    response.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetsAt / 1000)));

    if (bucket.count > max) {
      response.setHeader("Retry-After", String(Math.ceil((bucket.resetsAt - now) / 1000)));
      response.status(429).json({ message: "Too many requests. Please wait and try again." });
      return;
    }
    next();
  };
}
