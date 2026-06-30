import { getAuthContext } from "@/lib/auth";
import { adminSupabase } from "@/lib/supabase";
import { formatDateTimeRo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getAuthContext();
  // layout already guards, but keep the type narrow.
  if (!ctx) return null;
  const officeId = ctx.profile.office_id;

  const nowIso = new Date().toISOString();
  const { data: bookings } = await adminSupabase
    .from("bookings")
    .select(
      "id, student_name, student_id_number, meeting_type, topic, slot_time, duration_minutes, student_phone, cancelled"
    )
    .eq("office_id", officeId)
    .eq("cancelled", false)
    .gte("slot_time", nowIso)
    .order("slot_time", { ascending: true })
    .limit(100);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">
          Programări viitoare
        </h1>
        <p className="text-sm text-slate-500">
          {bookings?.length ?? 0} programări active.
        </p>
      </div>

      {!bookings || bookings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Nu există programări viitoare.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Data și ora</th>
                <th className="px-4 py-2 font-medium">Student</th>
                <th className="px-4 py-2 font-medium">Matricol</th>
                <th className="px-4 py-2 font-medium">Tip</th>
                <th className="px-4 py-2 font-medium">Subiect</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    {formatDateTimeRo(new Date(b.slot_time))}
                    <span className="block text-xs text-slate-400">
                      {b.duration_minutes} min
                    </span>
                  </td>
                  <td className="px-4 py-2">{b.student_name}</td>
                  <td className="px-4 py-2">{b.student_id_number}</td>
                  <td className="px-4 py-2">{b.meeting_type}</td>
                  <td className="px-4 py-2 text-slate-500">{b.topic ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
