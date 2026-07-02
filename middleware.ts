import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Edge middleware: auth gate + naive in-memory rate limiting.
 * Mirrors dental-saas `middleware.ts`.
 *
 * The Vapi tool webhooks (/api/vapi/*) and the cron route (/api/send-reminders)
 * are PUBLIC at the network level (Vapi and the scheduler call them
 * unauthenticated). They are instead secured inside the route by the Vapi
 * webhook secret / cron secret. Everything else requires a Supabase user.
 */

// --- naive sliding-window rate limiter (per Edge instance) ---
const hits = new Map<string, number[]>();
function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length <= limit;
}

const RATE_RULES: { prefix: string; limit: number; windowMs: number }[] = [
  { prefix: "/api/vapi/book", limit: 30, windowMs: 60_000 },
  { prefix: "/api/vapi/cancel", limit: 20, windowMs: 60_000 },
  { prefix: "/api/vapi/check-availability", limit: 60, windowMs: 60_000 },
  { prefix: "/api/auth/register-request", limit: 5, windowMs: 600_000 },
];

const PUBLIC_EXACT = new Set(["/"]);
const PUBLIC_PREFIXES = [
  "/login",
  "/api/vapi",
  "/api/send-reminders",
  "/api/cancel",
  "/c",
  "/api/auth",
  "/auth/callback",
  "/accept-invite",
  "/privacy",
];

function isPublic(path: string): boolean {
  if (PUBLIC_EXACT.has(path)) return true;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/") || path === p);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  for (const rule of RATE_RULES) {
    if (pathname.startsWith(rule.prefix)) {
      if (!rateLimit(`${ip}:${rule.prefix}`, rule.limit, rule.windowMs)) {
        return new NextResponse("Too Many Requests", { status: 429 });
      }
      break;
    }
  }

  if (isPublic(pathname)) return NextResponse.next();

  // Auth gate for everything else (dashboard, admin, dashboard APIs).
  // Fail safe: without Supabase env we can't authenticate — send to login
  // rather than throwing a 500.
  const url = req.nextUrl.clone();
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(toSet: { name: string; value: string; options?: any }[]) {
          toSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
