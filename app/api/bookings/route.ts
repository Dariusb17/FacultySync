import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { adminSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * List the office's non-cancelled bookings (for the dashboard calendar).
 * Office-scoped via the authenticated staff profile.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await adminSupabase
    .from("bookings")
    .select(
      "id, student_name, student_id_number, meeting_type, topic, slot_time, end_time, duration_minutes, student_phone"
    )
    .eq("office_id", ctx.profile.office_id)
    .eq("cancelled", false)
    .order("slot_time", { ascending: true })
    .limit(500);

  return NextResponse.json({ bookings: data ?? [] });
}
