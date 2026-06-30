import { adminSupabase } from "@/lib/supabase";
import { formatDateTimeRo } from "@/lib/format";
import CancelButton from "./CancelButton";

export const dynamic = "force-dynamic";

/**
 * Public cancel-by-token short link. Looks up the booking ONLY by opaque token
 * (anti-IDOR). Renders a small confirm page; the button POSTs to /api/cancel.
 */
export default async function CancelByTokenPage({
  params,
}: {
  params: { token: string };
}) {
  const { data: booking } = await adminSupabase
    .from("bookings")
    .select("student_name, meeting_type, slot_time, cancelled, office_id")
    .eq("cancel_token", params.token)
    .maybeSingle();

  let office: { name: string; professor_name: string } | null = null;
  if (booking) {
    const { data } = await adminSupabase
      .from("offices")
      .select("name, professor_name")
      .eq("id", booking.office_id)
      .maybeSingle();
    office = data;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold text-brand-dark">Anulare programare</h1>

      {!booking ? (
        <p className="text-slate-600">
          Linkul nu este valid sau programarea nu a fost găsită.
        </p>
      ) : booking.cancelled ? (
        <p className="text-slate-600">Această programare a fost deja anulată.</p>
      ) : new Date(booking.slot_time).getTime() < Date.now() ? (
        <p className="text-slate-600">
          Această programare este în trecut și nu mai poate fi anulată.
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <p>
              <span className="text-slate-500">Student:</span>{" "}
              {booking.student_name}
            </p>
            <p>
              <span className="text-slate-500">Tip:</span> {booking.meeting_type}
            </p>
            <p>
              <span className="text-slate-500">Data:</span>{" "}
              {formatDateTimeRo(new Date(booking.slot_time))}
            </p>
            {office && (
              <p>
                <span className="text-slate-500">Birou:</span> {office.name} —{" "}
                {office.professor_name}
              </p>
            )}
          </div>
          <CancelButton token={params.token} />
        </>
      )}
    </main>
  );
}
