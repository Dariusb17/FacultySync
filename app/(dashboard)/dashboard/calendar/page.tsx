"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
} from "@/components/icons";
import { initials, avatarColor, badgeColor } from "@/lib/ui";

type Booking = {
  id: string;
  student_name: string;
  faculty: string | null;
  meeting_type: string;
  topic: string | null;
  slot_time: string;
  duration_minutes: number;
};

const TZ = "Europe/Bucharest";
const WEEKDAYS = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"];

function dateKeyInTz(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
function keyOf(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function todayKey(): string {
  return dateKeyInTz(new Date().toISOString());
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<string>(todayKey());

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => (r.ok ? r.json() : { bookings: [] }))
      .then((d) => setBookings(d.bookings ?? []));
  }, []);

  // Bookings bucketed by Bucharest date key.
  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const k = dateKeyInTz(b.slot_time);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(b);
    }
    for (const list of map.values())
      list.sort((a, b) => a.slot_time.localeCompare(b.slot_time));
    return map;
  }, [bookings]);

  // Build the month grid (Monday-first, 6 weeks).
  const weeks = useMemo(() => {
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Mon=0
    const gridStart = new Date(year, month, 1 - startOffset);
    const cells: { y: number; m: number; d: number; key: string; inMonth: boolean }[] =
      [];
    for (let i = 0; i < 42; i++) {
      const dt = new Date(gridStart);
      dt.setDate(gridStart.getDate() + i);
      cells.push({
        y: dt.getFullYear(),
        m: dt.getMonth(),
        d: dt.getDate(),
        key: keyOf(dt.getFullYear(), dt.getMonth(), dt.getDate()),
        inMonth: dt.getMonth() === month,
      });
    }
    const rows: (typeof cells)[] = [];
    for (let i = 0; i < 42; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [year, month]);

  const monthLabel = new Intl.DateTimeFormat("ro-RO", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));

  const tKey = todayKey();
  const selectedBookings = byDay.get(selected) ?? [];
  const monthCount = bookings.filter(
    (b) => dateKeyInTz(b.slot_time).startsWith(keyOf(year, month, 1).slice(0, 7))
  ).length;

  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y--;
    } else if (m > 11) {
      m = 0;
      y++;
    }
    setMonth(m);
    setYear(y);
  }
  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelected(tKey);
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Calendar
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {monthCount} {monthCount === 1 ? "programare" : "programări"} în{" "}
            <span className="capitalize">{monthLabel}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-card transition hover:bg-slate-50"
          >
            Astăzi
          </button>
          <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-card">
            <button
              onClick={() => shift(-1)}
              className="rounded-l-lg p-1.5 text-slate-600 transition hover:bg-slate-100"
              aria-label="Luna anterioară"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <span className="w-36 select-none text-center text-sm font-semibold capitalize text-slate-800">
              {monthLabel}
            </span>
            <button
              onClick={() => shift(1)}
              className="rounded-r-lg p-1.5 text-slate-600 transition hover:bg-slate-100"
              aria-label="Luna următoare"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.map((row, ri) =>
            row.map((cell) => {
              const dayBookings = byDay.get(cell.key) ?? [];
              const isToday = cell.key === tKey;
              const isSelected = cell.key === selected;
              return (
                <button
                  key={cell.key}
                  onClick={() => setSelected(cell.key)}
                  className={`min-h-[92px] border-b border-r border-slate-100 p-1.5 text-left align-top transition last:border-r-0 ${
                    cell.inMonth ? "bg-white" : "bg-slate-50/60"
                  } ${isSelected ? "ring-2 ring-inset ring-brand/50" : "hover:bg-slate-50"}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        isToday
                          ? "bg-brand text-white"
                          : cell.inMonth
                          ? "text-slate-700"
                          : "text-slate-300"
                      }`}
                    >
                      {cell.d}
                    </span>
                    {dayBookings.length > 0 && (
                      <span className="text-[10px] font-medium text-slate-400">
                        {dayBookings.length}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {dayBookings.slice(0, 3).map((b) => (
                      <span
                        key={b.id}
                        className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ${badgeColor(
                          b.meeting_type
                        )}`}
                      >
                        {timeLabel(b.slot_time)} {b.student_name.split(" ")[0]}
                      </span>
                    ))}
                    {dayBookings.length > 3 && (
                      <span className="pl-1 text-[10px] text-slate-400">
                        +{dayBookings.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Selected day detail */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold capitalize text-slate-700">
          <CalendarIcon className="h-4 w-4 text-brand" />
          {new Intl.DateTimeFormat("ro-RO", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(new Date(selected + "T12:00:00"))}
        </h2>
        {selectedBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
            Nicio programare în această zi.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {selectedBookings.map((b) => (
              <article
                key={b.id}
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card"
              >
                <div className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-slate-50 py-2 text-center">
                  <span className="text-base font-bold tabular-nums text-slate-900">
                    {timeLabel(b.slot_time)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {b.duration_minutes} min
                  </span>
                </div>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarColor(
                    b.student_name
                  )}`}
                >
                  {initials(b.student_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-slate-900">
                      {b.student_name}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${badgeColor(
                        b.meeting_type
                      )}`}
                    >
                      {b.meeting_type}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {b.faculty ?? "—"}
                    {b.topic ? ` · ${b.topic}` : ""}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
