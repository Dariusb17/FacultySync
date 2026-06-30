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
