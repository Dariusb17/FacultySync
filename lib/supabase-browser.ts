import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (anon key, respects RLS). For 'use client' components.
 * 30-day cookie maxAge, mirroring dental-saas `lib/supabase-browser.ts`.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 30, // 30 days
      },
    }
  );
}
