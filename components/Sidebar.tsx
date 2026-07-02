"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ListIcon,
  CalendarIcon,
  BanIcon,
  HelpIcon,
  PhoneIcon,
  SparkIcon,
  LogoutIcon,
} from "./icons";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const NAV = [
  { href: "/dashboard", label: "Programări", icon: ListIcon },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/dashboard/block", label: "Blocare intervale", icon: BanIcon },
  { href: "/dashboard/faq", label: "Întrebări frecvente", icon: HelpIcon },
];

export default function Sidebar({
  officeName,
  professorName,
  officePhone,
}: {
  officeName: string;
  professorName: string;
  officePhone: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex flex-col gap-6 border-b border-slate-200 bg-white px-4 py-5 md:min-h-screen md:w-72 md:border-b-0 md:border-r md:px-5 md:py-7">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-lift">
          <SparkIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-brand-ink">
            FacultySync
          </p>
          <p className="text-[11px] text-slate-400">Asistent vocal</p>
        </div>
      </div>

      {/* Office card */}
      <div className="rounded-xl bg-brand-light px-3.5 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-brand/70">
          Birou
        </p>
        <p className="mt-0.5 text-sm font-semibold text-brand-ink">
          {officeName}
        </p>
        <p className="text-xs text-slate-500">{professorName}</p>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand text-white shadow-card"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: agent status + logout */}
      <div className="mt-auto flex flex-col gap-3">
        <div className="hidden rounded-xl border border-slate-200 px-3.5 py-3 md:block">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse-dot" />
            <span className="text-xs font-medium text-slate-700">
              Agent vocal activ
            </span>
          </div>
          {officePhone && (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <PhoneIcon className="h-3.5 w-3.5" />
              {officePhone}
            </div>
          )}
          <p className="mt-2 text-[11px] leading-snug text-slate-400">
            Studenții sunt preluați automat, non-stop.
          </p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          <LogoutIcon className="h-[18px] w-[18px]" />
          Deconectare
        </button>
      </div>
    </aside>
  );
}
