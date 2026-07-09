import { NextRequest, NextResponse } from "next/server";
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
      "id, student_name, faculty, meeting_type, topic, slot_time, end_time, duration_minutes"
    )
    .eq("office_id", ctx.profile.office_id)
    .eq("cancelled", false)
    .order("slot_time", { ascending: true })
    .limit(500);

  return NextResponse.json({ bookings: data ?? [] });
}

/**
 * Cancel a booking from the dashboard (soft cancel -> frees the slot).
 * Body: { id }. Office-scoped so a professor can only cancel their own bookings.
 */
export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const { error } = await adminSupabase
    .from("bookings")
    .update({ cancelled: true })
    .eq("id", body.id)
    .eq("office_id", ctx.profile.office_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
