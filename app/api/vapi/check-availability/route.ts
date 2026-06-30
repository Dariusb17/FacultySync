import { NextRequest } from "next/server";
import {
  verifyVapiSecret,
  vapiUnauthorized,
  parseVapiBody,
  resolveOffice,
  vapiResult,
} from "@/lib/vapi-auth";
import { getAvailability } from "@/lib/availability";

export const dynamic = "force-dynamic";

/**
 * Vapi tool: check-availability.
 * Args: { date: "YYYY-MM-DD", meeting_type?: string } (+ office_id hint).
 * Returns free slots the agent can offer to the student.
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

  const date: string | undefined = parsed.args.date;
  const meetingType: string | undefined =
    parsed.args.meeting_type ?? parsed.args.meetingType;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return vapiResult(
      parsed.toolCallId,
      "Pentru ce dată doriți? Spuneți-mi vă rog ziua exactă."
    );
  }

  const avail = await getAvailability(office.id, date, { meetingType });

  if (avail.dayOff) {
    return vapiResult(
      parsed.toolCallId,
      `În acea zi nu sunt ore de birou la ${office.professor_name}. Doriți o altă zi?`,
      { dayOff: true, date }
    );
  }

  if (avail.free.length === 0) {
    return vapiResult(
      parsed.toolCallId,
      `Pentru ${date} nu mai sunt intervale libere. Doriți să încercăm o altă zi?`,
      { free: [], date }
    );
  }

  const offered = avail.free.slice(0, 6);
  const spoken = offered.join(", ");
  return vapiResult(
    parsed.toolCallId,
    `Pentru ${date} sunt disponibile orele: ${spoken}. La ce oră doriți să programez?`,
    { free: avail.free, durationMinutes: avail.durationMinutes, date }
  );
}
