import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase";
import { formatDateTimeRo } from "@/lib/format";
import { sendCancellationNotice } from "@/lib/sms-notify";

export const dynamic = "force-dynamic";

/**
 * Public cancel-by-opaque-token. Looks the booking up ONLY by token (never by
 * raw id — that would be an IDOR), mirroring dental-saas /api/cancel.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token: string | undefined = body.token;
  if (!token) {
    return NextResponse.json({ error: "missing token" }, { status: 400 });
  }

  const { data: booking } = await adminSupabase
    .from("bookings")
    .select("*")
    .eq("cancel_token", token)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (booking.cancelled) {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }
  if (new Date(booking.slot_time).getTime() < Date.now()) {
    return NextResponse.json({ error: "past booking" }, { status: 400 });
  }

  await adminSupabase
    .from("bookings")
    .update({ cancelled: true })
    .eq("id", booking.id);

  const { data: office } = await adminSupabase
    .from("offices")
    .select("name, professor_name")
    .eq("id", booking.office_id)
    .maybeSingle();

  if (booking.student_phone && office) {
    try {
      await sendCancellationNotice(booking.student_phone, {
        studentName: booking.student_name,
        officeName: office.name,
        professorName: office.professor_name,
        meetingType: booking.meeting_type,
        formattedTime: formatDateTimeRo(new Date(booking.slot_time)),
      });
    } catch (e) {
      console.error("[cancel] notice failed:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
