import { cache } from "react";
import { createSupabaseServerClient } from "./supabase-server";
import type { StaffProfile } from "./types";

/**
 * Resolve the current authenticated staff member + their office.
 * Wrapped in React cache() so layout + page dedupe to one DB hit per request.
 * Mirrors dental-saas `lib/auth.ts → getAuthContext()`.
 *
 * Returns null when: no user, no profile, or is_active === false.
 */
export const getAuthContext = cache(
  async (): Promise<{ userId: string; email: string | null; profile: StaffProfile } | null> => {
    // TEMPORARY design/demo mode: when DASHBOARD_PUBLIC=true, skip auth and act
    // as the default office's owner. Remove the env var to re-enable login.
    if (process.env.DASHBOARD_PUBLIC === "true" && process.env.DEFAULT_OFFICE_ID) {
      return {
        userId: "demo",
        email: null,
        profile: {
          id: "demo",
          office_id: process.env.DEFAULT_OFFICE_ID,
          full_name: "Demo",
          role: "owner",
          is_active: true,
        },
      };
    }

    const supabase = createSupabaseServerClient();

    // Validate the JWT against the Supabase auth server (not getSession()).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("staff_profiles")
      .select("id, office_id, full_name, role, is_active")
      .eq("id", user.id)
      .single();

    if (!profile || profile.is_active === false) return null;

    return {
      userId: user.id,
      email: user.email ?? null,
      profile: profile as StaffProfile,
    };
  }
);
