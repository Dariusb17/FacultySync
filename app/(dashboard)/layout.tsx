import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { adminSupabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login?redirect=/dashboard");

  const { data: office } = await adminSupabase
    .from("offices")
    .select("name, professor_name, office_phone, twilio_number")
    .eq("id", ctx.profile.office_id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <Sidebar
        officeName={office?.name ?? "Birou"}
        professorName={office?.professor_name ?? ""}
        officePhone={office?.twilio_number ?? office?.office_phone ?? null}
      />
      <main className="flex-1 px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
