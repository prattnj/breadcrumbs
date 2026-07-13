import { timingSafeEqual, randomBytes } from "crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import cookieSession from "cookie-session";

const PASSWORD = process.env.BREADCRUMBS_PASSWORD;
const SESSION_SECRET =
  process.env.BREADCRUMBS_SESSION_SECRET || randomBytes(32).toString("hex");

if (!PASSWORD) {
  console.warn(
    "WARNING: BREADCRUMBS_PASSWORD is not set — the app will reject every login. " +
      "Set it to enable authentication."
  );
}
if (!process.env.BREADCRUMBS_SESSION_SECRET) {
  console.warn(
    "WARNING: BREADCRUMBS_SESSION_SECRET is not set — using a random secret. " +
      "Existing sessions will be invalidated on every restart. Set it to a fixed value to persist logins."
  );
}

/** Constant-time comparison that never short-circuits on length. */
function passwordMatches(input: string): boolean {
  if (!PASSWORD) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(PASSWORD);
  if (a.length !== b.length) {
    // Still run a comparison to keep timing roughly constant.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export const sessionMiddleware: RequestHandler = cookieSession({
  name: "breadcrumbs_session",
  keys: [SESSION_SECRET],
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  httpOnly: true,
  sameSite: "lax",
  // Secure cookies require HTTPS. Disable only when explicitly running plain HTTP locally.
  secure: process.env.BREADCRUMBS_INSECURE_COOKIES !== "true",
});

const LOGIN_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Breadcrumbs — Sign in</title>
  <style>
    body { margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center;
           font-family: system-ui, sans-serif; background: #111827; color: #e5e7eb; }
    form { display: flex; flex-direction: column; gap: 1rem; width: 280px;
           background: #1f2937; padding: 2rem; border-radius: 12px; border: 1px solid #374151; }
    h1 { margin: 0 0 .5rem; font-size: 1.5rem; }
    input { padding: .6rem .75rem; border-radius: 8px; border: 1px solid #4b5563;
            background: #111827; color: #e5e7eb; font-size: 1rem; }
    button { padding: .6rem; border-radius: 8px; border: none; background: #2563eb; color: white;
             font-size: 1rem; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    .error { color: #fca5a5; font-size: .85rem; min-height: 1rem; }
  </style>
</head>
<body>
  <form id="f">
    <h1>Breadcrumbs</h1>
    <input type="password" id="p" placeholder="Password" autocomplete="current-password" autofocus />
    <button type="submit">Sign in</button>
    <div class="error" id="e"></div>
  </form>
  <script>
    const f = document.getElementById("f");
    const e = document.getElementById("e");
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      e.textContent = "";
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: document.getElementById("p").value }),
      });
      if (res.ok) { window.location.reload(); }
      else { e.textContent = "Incorrect password"; }
    });
  </script>
</body>
</html>`;

/** POST /api/login — validates the password and starts a session. */
export function login(req: Request, res: Response): void {
  const password = (req.body && req.body.password) || "";
  if (typeof password === "string" && passwordMatches(password)) {
    if (req.session) req.session.authed = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: "Incorrect password" });
  }
}

/** POST /api/logout — clears the session. */
export function logout(req: Request, res: Response): void {
  req.session = null;
  res.json({ ok: true });
}

/**
 * Gate everything behind a valid session. Unauthenticated requests get the login
 * page (for navigations) or a 401 (for API calls). The login route itself is open.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session && req.session.authed) {
    next();
    return;
  }
  if (req.path.startsWith("/api/")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(401).type("html").send(LOGIN_PAGE);
}
