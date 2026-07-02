import { getAuthContext } from "@/lib/auth";
import { adminSupabase } from "@/lib/supabase";
import { bucharestDateStr } from "@/lib/format";
import { initials, avatarColor, badgeColor } from "@/lib/ui";
import {
  CalendarIcon,
  CalendarTodayIcon,
  UsersIcon,
  ClockIcon,
  PhoneIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

const TZ = "Europe/Bucharest";

function dateKey(iso: string): string {
  return bucharestDateStr(new Date(iso));
}
function dayHeading(iso: string): string {
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}
function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function DashboardPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const officeId = ctx.profile.office_id;

  const nowIso = new Date().toISOString();
  const { data: rows } = await adminSupabase
    .from("bookings")
    .select(
      "id, student_name, student_id_number, meeting_type, topic, slot_time, duration_minutes, student_phone"
    )
    .eq("office_id", officeId)
    .eq("cancelled", false)
    .gte("slot_time", nowIso)
    .order("slot_time", { ascending: true })
    .limit(200);

  const bookings = rows ?? [];

  // Stats
  const todayStr = bucharestDateStr(new Date());
  const in7 = new Date(Date.now() + 7 * 864e5);
  const todayCount = bookings.filter((b) => dateKey(b.slot_time) === todayStr)
    .length;
  const weekCount = bookings.filter(
    (b) => new Date(b.slot_time) <= in7
  ).length;

  // Group by day
  const groups = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const k = dateKey(b.slot_time);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(b);
  }

  const stats = [
    { label: "Programări active", value: bookings.length, Icon: UsersIcon, tint: "text-indigo-600 bg-indigo-50" },
    { label: "Astăzi", value: todayCount, Icon: CalendarTodayIcon, tint: "text-emerald-600 bg-emerald-50" },
    { label: "Următoarele 7 zile", value: weekCount, Icon: ClockIcon, tint: "text-amber-600 bg-amber-50" },
  ];

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Programări
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Rezervările făcute de studenți prin agentul vocal apar aici în timp real.
          </p>
        </div>
      </header>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, Icon, tint }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-slate-900">
                {value}
              </p>
              <p className="text-xs font-medium text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bookings */}
      {bookings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <p className="font-medium text-slate-700">Nicio programare viitoare</p>
          <p className="max-w-sm text-sm text-slate-500">
            Când un student sună și rezervă un interval, programarea va apărea
            imediat pe această pagină.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          {[...groups.entries()].map(([key, list]) => (
            <div key={key} className="animate-fade-up">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold capitalize text-slate-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                {dayHeading(list[0].slot_time)}
                <span className="text-xs font-normal text-slate-400">
                  · {list.length}{" "}
                  {list.length === 1 ? "programare" : "programări"}
                </span>
              </h2>
              <div className="flex flex-col gap-2.5">
                {list.map((b) => (
                  <article
                    key={b.id}
                    className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card transition hover:border-brand/40 hover:shadow-lift"
                  >
                    {/* Time block */}
                    <div className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-slate-50 py-2 text-center">
                      <span className="text-base font-bold tabular-nums text-slate-900">
                        {timeLabel(b.slot_time)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {b.duration_minutes} min
                      </span>
                    </div>

                    {/* Avatar */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarColor(
                        b.student_name
                      )}`}
                    >
                      {initials(b.student_name)}
                    </div>

                    {/* Details */}
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
                        <span className="text-slate-400">Matricol</span>{" "}
                        {b.student_id_number}
                        {b.topic ? (
                          <>
                            {" · "}
                            {b.topic}
                          </>
                        ) : null}
                      </p>
                    </div>

                    {/* Phone */}
                    {b.student_phone && (
                      <div className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
                        <PhoneIcon className="h-3.5 w-3.5" />
                        {b.student_phone}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
