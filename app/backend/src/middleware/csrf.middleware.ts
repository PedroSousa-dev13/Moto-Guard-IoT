import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const CSRF_COOKIE = "csrf-token";
const CSRF_HEADER = "x-csrf-token";
const CSRF_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 dias

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function generateToken(): string {
  return crypto.randomUUID();
}

function getCookieToken(req: Request): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Safe methods (GET, HEAD, OPTIONS): ensure the cookie is set but skip validation
  if (SAFE_METHODS.has(req.method)) {
    if (!getCookieToken(req)) {
      const token = generateToken();
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: CSRF_MAX_AGE,
      });
    }
    next();
    return;
  }

  // State-changing methods: validate X-CSRF-Token header
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;
  const cookieToken = getCookieToken(req);

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[CSRF] Rejeitado ${req.method} ${req.path} — header: ${!!headerToken}, cookie: ${!!cookieToken}`);
    }
    res.status(403).json({ error: "CSRF token inválido ou ausente" });
    return;
  }

  next();
}
