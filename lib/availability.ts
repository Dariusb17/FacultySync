import { adminSupabase } from "./supabase";
import {
  bucharestWeekday,
  bucharestLocalToUtc,
  bucharestHHMM,
} from "./format";

/**
 * Availability algorithm — the algorithmic core, ported from dental-saas
 * `GET /api/availability` (§9 of DENTAL_SAAS_REFERENCE).
 *
 * Duration-aware: a 30-min meeting blocks more slots than a 15-min one.
 * Multi-tenant: always scoped by office_id. Times handled in Europe/Bucharest.
 *
 * The voice agent calls this (via /api/vapi/check-availability) to offer slots;
 * the dashboard uses it to render availability.
 */

const SLOT_STEP_MIN = 30;

export type AvailabilityResult = {
  date: string;
  /** true when the office has a schedule but none for this weekday. */
  dayOff: boolean;
  /** Local working windows for the weekday, or null when unrestricted. */
  workingHours: { start: string; end: string }[] | null;
  slotMinutes: number;
  durationMinutes: number;
  /** Slot start times "HH:MM" (Bucharest) that are taken / unavailable. */
  booked: string[];
  /** Slot start times "HH:MM" (Bucharest) that are free for the requested duration. */
  free: string[];
};

function hhmmToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Resolve the duration (minutes) for a meeting type from the office's
 * meeting_types table. Never trust a client-supplied duration.
 * Falls back to 15 minutes if the type is unknown.
 */
export async function resolveMeetingDuration(
  officeId: string,
  meetingType: string | null | undefined
): Promise<number> {
  if (!meetingType) return 15;
  const { data } = await adminSupabase
    .from("meeting_types")
    .select("name, duration_minutes")
    .eq("office_id", officeId);
  const match = (data ?? []).find(
    (mt) => mt.name.toLowerCase().trim() === meetingType.toLowerCase().trim()
  );
  return match?.duration_minutes ?? 15;
}

export async function getAvailability(
  officeId: string,
  date: string, // YYYY-MM-DD
  opts: { meetingType?: string; durationMinutes?: number } = {}
): Promise<AvailabilityResult> {
  const durationMinutes =
    opts.durationMinutes ??
    (await resolveMeetingDuration(officeId, opts.meetingType));

  // 1. Working hours for this weekday (weekday computed at noon Bucharest).
  const weekday = bucharestWeekday(bucharestLocalToUtc(date, "12:00"));
  const { data: allHours } = await adminSupabase
    .from("office_hours")
    .select("day_of_week, start_time, end_time")
    .eq("office_id", officeId);

  const hasAnySchedule = (allHours ?? []).length > 0;
  const dayWindows = (allHours ?? [])
    .filter((h) => h.day_of_week === weekday)
    .map((h) => ({
      startMin: hhmmToMinutes(h.start_time),
      endMin: hhmmToMinutes(h.end_time),
      start: h.start_time.slice(0, 5),
      end: h.end_time.slice(0, 5),
    }))
    .sort((a, b) => a.startMin - b.startMin);

  const dayOff = hasAnySchedule && dayWindows.length === 0;
  if (dayOff) {
    return {
      date,
      dayOff: true,
      workingHours: [],
      slotMinutes: SLOT_STEP_MIN,
      durationMinutes,
      booked: [],
      free: [],
    };
  }

  const unrestricted = !hasAnySchedule;

  // 2. Full-day UTC window from Bucharest local midnight.
  const dayStartUtc = bucharestLocalToUtc(date, "00:00");
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  // 3. Non-cancelled bookings for the day + office blocks overlapping the day.
  const { data: bookings } = await adminSupabase
    .from("bookings")
    .select("slot_time, end_time, duration_minutes")
    .eq("office_id", officeId)
    .eq("cancelled", false)
    .gte("slot_time", dayStartUtc.toISOString())
    .lt("slot_time", dayEndUtc.toISOString());

  const { data: blocks } = await adminSupabase
    .from("office_blocks")
    .select("start_time, end_time")
    .eq("office_id", officeId)
    .lt("start_time", dayEndUtc.toISOString())
    .gt("end_time", dayStartUtc.toISOString());

  // 4. Booked ranges as [startMs, endMs).
  const bookedRanges: { start: number; end: number }[] = [];
  for (const b of bookings ?? []) {
    const start = new Date(b.slot_time).getTime();
    const end = b.end_time
      ? new Date(b.end_time).getTime()
      : start + (b.duration_minutes ?? 15) * 60_000;
    bookedRanges.push({ start, end });
  }
  for (const bl of blocks ?? []) {
    bookedRanges.push({
      start: new Date(bl.start_time).getTime(),
      end: new Date(bl.end_time).getTime(),
    });
  }

  const overlaps = (start: number, end: number) =>
    bookedRanges.some((r) => start < r.end && end > r.start);

  // 5. Walk the day in 30-min slots.
  const booked: string[] = [];
  const free: string[] = [];

  for (let mins = 0; mins < 24 * 60; mins += SLOT_STEP_MIN) {
    const hh = String(Math.floor(mins / 60)).padStart(2, "0");
    const mm = String(mins % 60).padStart(2, "0");
    const label = `${hh}:${mm}`;

    const slotStart = bucharestLocalToUtc(date, label);
    const slotStartMs = slotStart.getTime();
    const slotEndMs = slotStartMs + durationMinutes * 60_000;

    // Within working hours? (restricted offices only)
    let withinHours = true;
    if (!unrestricted) {
      withinHours = dayWindows.some(
        (w) => mins >= w.startMin && mins + durationMinutes <= w.endMin
      );
    }

    if (!withinHours) {
      // Outside hours — not offered, but don't list as "booked" noise unless restricted.
      continue;
    }

    if (overlaps(slotStartMs, slotEndMs)) {
      booked.push(label);
    } else {
      free.push(label);
    }
  }

  return {
    date,
    dayOff: false,
    workingHours: unrestricted
      ? null
      : dayWindows.map((w) => ({ start: w.start, end: w.end })),
    slotMinutes: SLOT_STEP_MIN,
    durationMinutes,
    booked,
    free,
  };
}

/**
 * Server-side conflict check used by the booking webhook: returns true if the
 * proposed [slotStart, slotStart+duration) overlaps any non-cancelled booking
 * or office block for that office. Mirrors dental-saas booking step 8.
 */
export async function hasConflict(
  officeId: string,
  slotStartUtc: Date,
  durationMinutes: number
): Promise<boolean> {
  const startMs = slotStartUtc.getTime();
  const endMs = startMs + durationMinutes * 60_000;
  // Window: look a day on either side to catch overlapping long meetings.
  const lo = new Date(startMs - 24 * 60 * 60 * 1000).toISOString();
  const hi = new Date(endMs + 24 * 60 * 60 * 1000).toISOString();

  const { data: bookings } = await adminSupabase
    .from("bookings")
    .select("slot_time, end_time, duration_minutes")
    .eq("office_id", officeId)
    .eq("cancelled", false)
    .gte("slot_time", lo)
    .lte("slot_time", hi);

  for (const b of bookings ?? []) {
    const s = new Date(b.slot_time).getTime();
    const e = b.end_time
      ? new Date(b.end_time).getTime()
      : s + (b.duration_minutes ?? 15) * 60_000;
    if (startMs < e && endMs > s) return true;
  }

  const { data: blocks } = await adminSupabase
    .from("office_blocks")
    .select("start_time, end_time")
    .eq("office_id", officeId)
    .lt("start_time", hi)
    .gt("end_time", lo);

  for (const bl of blocks ?? []) {
    const s = new Date(bl.start_time).getTime();
    const e = new Date(bl.end_time).getTime();
    if (startMs < e && endMs > s) return true;
  }

  return false;
}

/** Helper to render a UTC slot time as "HH:MM" Bucharest (for responses). */
export function slotLabel(at: Date): string {
  return bucharestHHMM(at);
}
