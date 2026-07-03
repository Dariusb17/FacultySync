import { getAuthContext } from "@/lib/auth";
import { adminSupabase } from "@/lib/supabase";
import { bucharestDateStr } from "@/lib/format";
import {
  CalendarIcon,
  CalendarTodayIcon,
  UsersIcon,
  ClockIcon,
} from "@/components/icons";
import Waveform from "@/components/Waveform";
import BookingList, { type BookingItem } from "@/components/BookingList";

export const dynamic = "force-dynamic";

function dateKey(iso: string): string {
  return bucharestDateStr(new Date(iso));
}

export default async function DashboardPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const officeId = ctx.profile.office_id;

  const [{ data: office }, { data: rows }] = await Promise.all([
    adminSupabase
      .from("offices")
      .select("professor_name")
      .eq("id", officeId)
      .maybeSingle(),
    adminSupabase
      .from("bookings")
      .select(
        "id, student_name, faculty, meeting_type, topic, slot_time, duration_minutes"
      )
      .eq("office_id", officeId)
      .eq("cancelled", false)
      .gte("slot_time", new Date().toISOString())
      .order("slot_time", { ascending: true })
      .limit(200),
  ]);

  const bookings = (rows ?? []) as BookingItem[];

  const todayStr = bucharestDateStr(new Date());
  const in7 = new Date(Date.now() + 7 * 864e5);
  const todayCount = bookings.filter((b) => dateKey(b.slot_time) === todayStr).length;
  const weekCount = bookings.filter((b) => new Date(b.slot_time) <= in7).length;

  const stats = [
    { label: "Programări active", value: bookings.length, Icon: UsersIcon, accent: "text-blue-400" },
    { label: "Astăzi", value: todayCount, Icon: CalendarTodayIcon, accent: "text-emerald-400" },
    { label: "Următoarele 7 zile", value: weekCount, Icon: ClockIcon, accent: "text-amber-400" },
  ];

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Programările făcute de studenți prin agentul vocal apar aici în timp real.
        </p>
      </header>

      {/* Techy hero */}
      <div className="relative overflow-hidden rounded-2xl bg-brand-navy p-6 shadow-glow">
        <div className="absolute inset-0 bg-brand-gradient opacity-90" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-white/80">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Agent vocal activ · non-stop
            </div>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {office?.professor_name ?? "Bun venit"}
            </h2>
            <p className="mt-0.5 text-sm text-white/80">
              Agentul preia apelurile studenților și programează automat.
            </p>
          </div>
          <Waveform bars={26} className="hidden h-14 w-48 sm:flex" />
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, Icon, accent }) => (
          <div key={label} className="rounded-2xl border border-slate-200/70 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {label}
              </p>
              <Icon className={`h-4 w-4 ${accent}`} />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
              {value}
            </p>
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
            Când un student sună și rezervă un interval, programarea apare imediat aici.
          </p>
        </div>
      ) : (
        <BookingList bookings={bookings} />
      )}
    </section>
  );
}
