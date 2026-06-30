import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase";
import { verifyCronSecret } from "@/lib/cron-auth";
import {
  bucharestHour,
  bucharestDateStr,
  bucharestLocalToUtc,
  addDaysStr,
  formatDateTimeRo,
} from "@/lib/format";
import {
  sendReminder24h,
  sendReminderMorning,
  sendFeedbackRequest,
  type ConfirmationPayload,
} from "@/lib/sms-notify";

export const dynamic = "force-dynamic";

/**
 * Cron-secured reminder fan-out. Invoked by an external scheduler with the
 * x-cron-secret header. Mirrors dental-saas POST /api/send-reminders.
 *
 * Branches on the current Bucharest hour:
 *  - Morning (07:00-11:59): today's bookings w/ reminder_morning_sent=false ->
 *    sendReminderMorning, set reminder_morning_sent=true.
 *  - Otherwise: tomorrow's bookings w/ reminder_24h_sent=false -> sendReminder24h
 *    (with cancel-by-token link), set reminder_24h_sent=true.
 *  - Always: post-meeting feedback for bookings that finished ~2-4h ago with
 *    feedback_sent=false and an office feedback_link.
 *
 * Idempotency flags prevent double sends. Each booking processed in its own
 * try/catch so one failure can't abort the batch.
 */
export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get("x-cron-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const hour = bucharestHour(now);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";

  let sent = 0;
  const morningWindow = hour >= 7 && hour < 12;

  // Office cache so we don't refetch per booking.
  const officeCache = new Map<string, any>();
  async function getOffice(id: string) {
    if (officeCache.has(id)) return officeCache.get(id);
    const { data } = await adminSupabase
      .from("offices")
      .select("id, name, professor_name, feedback_link")
      .eq("id", id)
      .maybeSingle();
    officeCache.set(id, data);
    return data;
  }

  if (morningWindow) {
    const today = bucharestDateStr(now);
    const dayStart = bucharestLocalToUtc(today, "00:00").toISOString();
    const dayEnd = bucharestLocalToUtc(addDaysStr(today, 1), "00:00").toISOString();

    const { data: bookings } = await adminSupabase
      .from("bookings")
      .select("*")
      .eq("cancelled", false)
      .eq("reminder_morning_sent", false)
      .gte("slot_time", dayStart)
      .lt("slot_time", dayEnd);

    for (const b of bookings ?? []) {
      try {
        const office = await getOffice(b.office_id);
        if (b.student_phone && office) {
          await sendReminderMorning(b.student_phone, payloadFor(b, office));
        }
        await adminSupabase
          .from("bookings")
          .update({ reminder_morning_sent: true })
          .eq("id", b.id);
        sent++;
      } catch (e) {
        console.error("[send-reminders] morning failed for", b.id, e);
      }
    }
  } else {
    const tomorrow = addDaysStr(bucharestDateStr(now), 1);
    const dayStart = bucharestLocalToUtc(tomorrow, "00:00").toISOString();
    const dayEnd = bucharestLocalToUtc(addDaysStr(tomorrow, 1), "00:00").toISOString();

    const { data: bookings } = await adminSupabase
      .from("bookings")
      .select("*")
      .eq("cancelled", false)
      .eq("reminder_24h_sent", false)
      .gte("slot_time", dayStart)
      .lt("slot_time", dayEnd);

    for (const b of bookings ?? []) {
      try {
        const office = await getOffice(b.office_id);
        // Ensure a cancel token exists (booking creates one, but be defensive).
        let token = b.cancel_token as string | null;
        if (!token) {
          token = crypto.randomBytes(16).toString("hex");
          await adminSupabase
            .from("bookings")
            .update({ cancel_token: token })
            .eq("id", b.id);
        }
        const cancelLink = baseUrl ? `${baseUrl}/c/${token}` : "";
        if (b.student_phone && office) {
          await sendReminder24h(b.student_phone, {
            ...payloadFor(b, office),
            cancelLink,
          });
        }
        await adminSupabase
          .from("bookings")
          .update({ reminder_24h_sent: true })
          .eq("id", b.id);
        sent++;
      } catch (e) {
        console.error("[send-reminders] 24h failed for", b.id, e);
      }
    }
  }

  // Post-meeting feedback requests (finished 2-4h ago).
  let feedback = 0;
  const fourAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
  const twoAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const { data: finished } = await adminSupabase
    .from("bookings")
    .select("*")
    .eq("cancelled", false)
    .eq("feedback_sent", false)
    .gte("end_time", fourAgo)
    .lte("end_time", twoAgo);

  for (const b of finished ?? []) {
    try {
      const office = await getOffice(b.office_id);
      if (b.student_phone && office?.feedback_link) {
        await sendFeedbackRequest(b.student_phone, {
          studentName: b.student_name,
          officeName: office.name,
          feedbackLink: office.feedback_link,
        });
      }
      await adminSupabase
        .from("bookings")
        .update({ feedback_sent: true })
        .eq("id", b.id);
      feedback++;
    } catch (e) {
      console.error("[send-reminders] feedback failed for", b.id, e);
    }
  }

  return NextResponse.json({
    ok: true,
    window: morningWindow ? "morning" : "day-before",
    sent,
    feedback,
  });
}

function payloadFor(b: any, office: any): ConfirmationPayload {
  return {
    studentName: b.student_name,
    officeName: office.name,
    professorName: office.professor_name,
    meetingType: b.meeting_type,
    formattedTime: formatDateTimeRo(new Date(b.slot_time)),
  };
}
