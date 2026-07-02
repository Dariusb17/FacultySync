import { NextRequest } from "next/server";
import {
  verifyVapiSecret,
  vapiUnauthorized,
  parseVapiBody,
  resolveOffice,
  vapiResult,
} from "@/lib/vapi-auth";
import { adminSupabase } from "@/lib/supabase";
import { formatDateTimeRo, spokenProfessorName } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Vapi tool: cancel.
 * Args: { student_name }. Identifies the student by name and cancels their
 * soonest upcoming non-cancelled booking (freeing the slot).
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

  const studentName: string | undefined =
    parsed.args.student_name ?? parsed.args.studentName ?? parsed.args.name;
  if (!studentName) {
    return vapiResult(
      parsed.toolCallId,
      "Spuneți-mi vă rog numele complet ca să găsesc programarea."
    );
  }

  // Find the soonest upcoming, non-cancelled booking for this student (by name).
  const nowIso = new Date().toISOString();
  const { data: bookings } = await adminSupabase
    .from("bookings")
    .select("*")
    .eq("office_id", office.id)
    .ilike("student_name", studentName.trim())
    .eq("cancelled", false)
    .gte("slot_time", nowIso)
    .order("slot_time", { ascending: true })
    .limit(1);

  const booking = bookings?.[0];
  if (!booking) {
    return vapiResult(
      parsed.toolCallId,
      `Nu am găsit nicio programare viitoare pe numele ${studentName}.`
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

  return vapiResult(
    parsed.toolCallId,
    `Am anulat programarea pentru ${booking.student_name} din ${formattedTime}, ` +
      `${booking.meeting_type} la profesorul ${spokenProfessorName(
        office.professor_name
      )}. Intervalul este acum liber. Mai pot face altceva?`,
    { cancelled_booking_id: booking.id }
  );
}
