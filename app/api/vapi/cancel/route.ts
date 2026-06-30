import { NextRequest } from "next/server";
import {
  verifyVapiSecret,
  vapiUnauthorized,
  parseVapiBody,
  resolveOffice,
  vapiResult,
} from "@/lib/vapi-auth";
import { adminSupabase } from "@/lib/supabase";
import { formatDateTimeRo } from "@/lib/format";
import { sendCancellationNotice } from "@/lib/sms-notify";

export const dynamic = "force-dynamic";

/**
 * Vapi tool: cancel.
 * Args: { student_id }. Identifies the student by matricol number and cancels
 * their soonest upcoming non-cancelled booking (freeing the slot).
 * Mirrors dental-saas cancellation (here keyed by student id, not opaque token).
 */
export async function POST(req: NextRequest) {
  if (!verifyVapiSecret(req)) return vapiUnauthorized();

  const body = await req.json().catch(() => ({}));
  const parsed = parseVapiBody(body);
  const office = await resolveOffice(parsed);
  if (!office) {
    return vapiResult(
      parsed.toolCallId,
      "Îmi pare rău, nu am putut identifica biroul. Vă rog reveniți mai târziu."
    );
  }

  const studentIdNumber: string | undefined =
    parsed.args.student_id ?? parsed.args.studentId ?? parsed.args.student_id_number;
  if (!studentIdNumber) {
    return vapiResult(
      parsed.toolCallId,
      "Spuneți-mi vă rog numărul dumneavoastră de matricol ca să găsesc programarea."
    );
  }

  // Find the soonest upcoming, non-cancelled booking for this student.
  const nowIso = new Date().toISOString();
  const { data: bookings } = await adminSupabase
    .from("bookings")
    .select("*")
    .eq("office_id", office.id)
    .eq("student_id_number", studentIdNumber)
    .eq("cancelled", false)
    .gte("slot_time", nowIso)
    .order("slot_time", { ascending: true })
    .limit(1);

  const booking = bookings?.[0];
  if (!booking) {
    return vapiResult(
      parsed.toolCallId,
      "Nu am găsit nicio programare viitoare pe numărul dumneavoastră de matricol."
    );
  }

  const { error } = await adminSupabase
    .from("bookings")
    .update({ cancelled: true })
    .eq("id", booking.id)
    .eq("office_id", office.id);

  if (error) {
    console.error("[cancel] update failed:", error);
    return vapiResult(
      parsed.toolCallId,
      "A apărut o eroare la anularea programării. Vă rog reveniți mai târziu."
    );
  }

  const formattedTime = formatDateTimeRo(new Date(booking.slot_time));

  if (booking.student_phone) {
    try {
      await sendCancellationNotice(booking.student_phone, {
        studentName: booking.student_name,
        officeName: office.name,
        professorName: office.professor_name,
        meetingType: booking.meeting_type,
        formattedTime,
      });
    } catch (e) {
      console.error("[cancel] notice SMS failed:", e);
    }
  }

  return vapiResult(
    parsed.toolCallId,
    `Am anulat programarea pentru ${booking.student_name} din ${formattedTime}, ` +
      `${booking.meeting_type} la ${office.professor_name}. Intervalul este acum liber. ` +
      `Mai pot face altceva?`,
    { cancelled_booking_id: booking.id }
  );
}
