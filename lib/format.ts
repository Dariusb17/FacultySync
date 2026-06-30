/**
 * Formatting + date helpers. Everything is Europe/Bucharest-aware and ro-RO
 * formatted, mirroring dental-saas `lib/format.ts`. Reused verbatim for students.
 */

export const TIMEZONE = "Europe/Bucharest";
export const LOCALE = "ro-RO";

/**
 * Normalize a raw phone string to Romanian E.164.
 *  07xx...   -> +407xx...
 *  0040...   -> +40...
 *  40...     -> +40...
 *  bare 7xx  -> +407xx...
 * Reuse as-is for student phones.
 */
export function normalizePhone(raw: string): string {
  if (!raw) return raw;
  let s = raw.replace(/[\s\-().]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("0040")) return "+" + s.slice(2);
  if (s.startsWith("40")) return "+" + s;
  if (s.startsWith("0")) return "+40" + s.slice(1);
  // bare local number
  return "+40" + s;
}

/** Weekday in our convention: 0=Mon … 6=Sun, computed at noon Bucharest. */
export function bucharestWeekday(date: Date): number {
  // Render the date in Bucharest and read the weekday to dodge DST/midnight edges.
  const noon = new Date(date);
  noon.setUTCHours(12, 0, 0, 0);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).format(noon);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[wd] ?? 0;
}

/**
 * Given a YYYY-MM-DD date string and HH:MM[:SS] local Bucharest time, return the
 * corresponding UTC Date. Handles the Bucharest offset (EET/EEST) correctly.
 */
export function bucharestLocalToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss = 0] = timeStr.split(":").map(Number);
  // Start from the naive UTC interpretation, then correct by the zone offset.
  const naiveUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  const offsetMin = bucharestOffsetMinutes(new Date(naiveUtc));
  return new Date(naiveUtc - offsetMin * 60_000);
}

/** Offset (minutes) of Europe/Bucharest from UTC at the given instant. */
export function bucharestOffsetMinutes(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** "HH:MM" in Bucharest for a UTC instant. */
export function bucharestHHMM(at: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

/** The current Bucharest hour (0-23). */
export function bucharestHour(at: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      hour12: false,
    }).format(at)
  );
}

/** "YYYY-MM-DD" for a UTC instant rendered in Bucharest. */
export function bucharestDateStr(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
  return parts; // en-CA yields YYYY-MM-DD
}

/** Full human time, ro-RO / Europe/Bucharest. e.g. "luni, 1 iulie 2026, 14:30". */
export function formatDateTimeRo(at: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
}

export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
