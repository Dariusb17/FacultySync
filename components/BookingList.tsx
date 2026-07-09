"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { initials, avatarColor, badgeColor } from "@/lib/ui";
import { ChevronRightIcon } from "./icons";

export type BookingItem = {
  id: string;
  student_name: string;
  faculty: string | null;
  meeting_type: string;
  topic: string | null;
  slot_time: string;
  duration_minutes: number;
};

const TZ = "Europe/Bucharest";

function dateKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
function dayHeading(iso: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}
function timeLabel(iso: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function BookingList({ bookings }: { bookings: BookingItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const router = useRouter();

  async function cancelBooking(b: BookingItem) {
    if (
      !window.confirm(
        `Anulați programarea pentru ${b.student_name} (${timeLabel(
          b.slot_time
        )})? Intervalul va redeveni liber.`
      )
    )
      return;
    setCancelling(b.id);
    try {
      await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id }),
      });
      router.refresh();
    } finally {
      setCancelling(null);
    }
  }

  const groups = new Map<string, BookingItem[]>();
  for (const b of bookings) {
    const k = dateKey(b.slot_time);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(b);
  }

  return (
    <div className="flex flex-col gap-6">
      {[...groups.entries()].map(([key, list]) => (
        <div key={key} className="animate-fade-up">
          <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold capitalize text-slate-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {dayHeading(list[0].slot_time)}
            <span className="text-xs font-normal text-slate-400">
              · {list.length} {list.length === 1 ? "programare" : "programări"}
            </span>
          </h2>

          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
            {list.map((b, i) => {
              const isOpen = open === b.id;
              return (
                <div
                  key={b.id}
                  className={i > 0 ? "border-t border-slate-100" : ""}
                >
                  {/* Compact row */}
                  <button
                    onClick={() => setOpen(isOpen ? null : b.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                  >
                    <span className="w-12 shrink-0 text-sm font-bold tabular-nums text-slate-900">
                      {timeLabel(b.slot_time)}
                    </span>
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(
                        b.student_name
                      )}`}
                    >
                      {initials(b.student_name)}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-slate-800">
                      {b.student_name}
                    </span>
                    <span
                      className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 sm:inline ${badgeColor(
                        b.meeting_type
                      )}`}
                    >
                      {b.meeting_type}
                    </span>
                    <ChevronRightIcon
                      className={`h-4 w-4 shrink-0 text-slate-300 transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    />
                  </button>

                  {/* Expanded details */}
                  {isOpen && (
                    <div className="animate-expand border-t border-slate-100 bg-slate-50/60 px-4 py-3 pl-[76px]">
                      <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
                        <Detail label="Facultate" value={b.faculty ?? "—"} />
                        <Detail label="Tip întâlnire" value={b.meeting_type} />
                        <Detail
                          label="Durată"
                          value={`${b.duration_minutes} minute`}
                        />
                        <Detail label="Subiect" value={b.topic ?? "—"} />
                      </dl>
                      <button
                        onClick={() => cancelBooking(b)}
                        disabled={cancelling === b.id}
                        className="mt-3 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        {cancelling === b.id ? "Se anulează…" : "Anulează programarea"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-slate-400">{label}:</dt>
      <dd className="truncate font-medium text-slate-700">{value}</dd>
    </div>
  );
}
