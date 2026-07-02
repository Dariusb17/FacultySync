import crypto from "crypto";
import { NextRequest } from "next/server";
import {
  verifyVapiSecret,
  vapiUnauthorized,
  parseVapiBody,
  resolveOffice,
  vapiResult,
} from "@/lib/vapi-auth";
import { adminSupabase } from "@/lib/supabase";
import { getAvailability, resolveMeetingDuration } from "@/lib/availability";
import {
  bucharestLocalToUtc,
  bucharestHHMM,
  formatDateTimeRo,
  spokenProfessorName,
} from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Vapi tool: book.
 * Args: { student_name, faculty, topic?, meeting_type?,
 *         slot (ISO) | date ("YYYY-MM-DD") + time ("HH:MM") }.
 *
 * Resolves duration from meeting_types, validates against working hours +
 * existing bookings/blocks, and inserts the booking. No matricol number and no
 * phone/SMS (we don't send SMS in this deployment).
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

  const a = parsed.args;
  const studentName: string | undefined = a.student_name ?? a.studentName;
  const faculty: string | null = a.faculty ?? a.facultate ?? null;
  const topic: string | null = a.topic ?? null;
  const meetingType: string =
    a.meeting_type ?? a.meetingType ?? "Consultație ore de birou";

  if (!studentName || !faculty) {
    return vapiResult(
      parsed.toolCallId,
      "Am nevoie de numele complet și de facultatea de la care sunteți pentru a face programarea."
    );
  }

  // Resolve the slot start (UTC).
  const slotStart = resolveSlotStart(a);
  if (!slotStart) {
    return vapiResult(
      parsed.toolCallId,
      "Nu am înțeles data și ora. Vă rog spuneți ziua și ora exactă."
    );
  }

  const durationMinutes = await resolveMeetingDuration(office.id, meetingType);
  const label = bucharestHHMM(slotStart);
  const dateStr = isoDateInBucharest(slotStart);

  // Validate against working hours + existing bookings/blocks via availability.
  const avail = await getAvailability(office.id, dateStr, { meetingType });
  if (avail.dayOff) {
    return vapiResult(
      parsed.toolCallId,
      "În acea zi nu sunt ore de birou. Doriți o altă zi?"
    );
  }
  if (!avail.free.includes(label)) {
    const reason = avail.booked.includes(label)
      ? "Acel interval tocmai a fost ocupat."
      : "Acel interval este în afara orelor de birou.";
    const alt = avail.free.slice(0, 4).join(", ");
    return vapiResult(
      parsed.toolCallId,
      alt
        ? `${reason} Sunt libere în schimb: ${alt}. Care vă convine?`
        : `${reason} Din păcate nu mai sunt alte intervale în acea zi.`,
      { conflict: true, free: avail.free }
    );
  }

  const endTime = new Date(slotStart.getTime() + durationMinutes * 60_000);
  const cancelToken = crypto.randomBytes(16).toString("hex");

  const { data: booking, error } = await adminSupabase
    .from("bookings")
    .insert({
      office_id: office.id,
      student_name: studentName,
      faculty,
      meeting_type: meetingType,
      topic,
      slot_time: slotStart.toISOString(),
      end_time: endTime.toISOString(),
      duration_minutes: durationMinutes,
      source: "voice",
      cancel_token: cancelToken,
    })
    .select("id")
    .single();

  if (error || !booking) {
    console.error("[book] insert failed:", error);
    return vapiResult(
      parsed.toolCallId,
      "A apărut o eroare la salvarea programării. Vă rog reveniți mai târziu."
    );
  }

  const formattedTime = formatDateTimeRo(slotStart);

  // Confirmation: office/professor name, student name, faculty, type, slot time.
  return vapiResult(
    parsed.toolCallId,
    `Gata! Am programat-o pe ${studentName}, de la ${faculty}, la profesorul ${spokenProfessorName(
      office.professor_name
    )}, ${meetingType}, pe ${formattedTime}. Mai pot face altceva pentru dumneavoastră?`,
    { booking_id: booking.id, slot_time: slotStart.toISOString() }
  );
}

/** Resolve a UTC slot start from either an ISO `slot` or `date` + `time`. */
function resolveSlotStart(a: Record<string, any>): Date | null {
  const slot: string | undefined = a.slot ?? a.slot_time ?? a.datetime;
  if (slot && typeof slot === "string") {
    if (slot.includes("T")) {
      const d = new Date(slot);
      if (!isNaN(d.getTime())) return d;
    }
    // "YYYY-MM-DD HH:MM"
    const m = slot.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
    if (m) return bucharestLocalToUtc(m[1], m[2]);
  }
  const date: string | undefined = a.date;
  const time: string | undefined = a.time;
  if (date && time && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}/.test(time)) {
    return bucharestLocalToUtc(date, time.slice(0, 5));
  }
  return null;
}

/** "YYYY-MM-DD" of a UTC instant rendered in Bucharest. */
function isoDateInBucharest(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
