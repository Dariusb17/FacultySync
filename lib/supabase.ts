import { createClient } from "@supabase/supabase-js";

/**
 * Admin (service-role) Supabase client. Bypasses RLS.
 *
 * SERVER-ONLY. Never import this into a 'use client' component — it carries the
 * service-role key. Use it in webhooks, cron routes, and server components that
 * have already scoped their access by office_id.
 *
 * Mirrors dental-saas `lib/supabase.ts`.
 */
const supabaseUrl = process.env.SUPABASE_URL ?? "http://localhost:54321";
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "service-role-key-not-set";

export const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: {
    // Bypass Next.js's fetch Data Cache so reads are always fresh. Without this,
    // Supabase queries with stable URLs (e.g. the bookings list) get cached and
    // return stale data after a new booking is written.
    fetch: (input: any, init?: any) =>
      fetch(input, { ...init, cache: "no-store" }),
  },
});
