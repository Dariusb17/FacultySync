import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { adminSupabase } from "@/lib/supabase";

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
    .select("name, professor_name")
    .eq("id", ctx.profile.office_id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-bold text-brand-dark">FacultySync</p>
            <p className="text-xs text-slate-500">
              {office?.name ?? "Birou"} — {office?.professor_name ?? ""}
            </p>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard" className="text-slate-700 hover:text-brand">
              Programări
            </Link>
            <Link
              href="/dashboard/block"
              className="text-slate-700 hover:text-brand"
            >
              Blocare intervale
            </Link>
            <Link
              href="/dashboard/faq"
              className="text-slate-700 hover:text-brand"
            >
              Întrebări frecvente
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
