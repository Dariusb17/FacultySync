"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ListIcon,
  CalendarIcon,
  BanIcon,
  HelpIcon,
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
    <aside className="flex flex-col gap-8 border-b border-slate-200/70 bg-white px-4 py-6 md:min-h-screen md:w-64 md:border-b-0 md:border-r md:px-4 md:py-8">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
          <SparkIcon className="h-[18px] w-[18px]" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-slate-900">
          FacultyVoice
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-slate-100 font-semibold text-slate-900"
                  : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] ${
                  active ? "text-brand" : "text-slate-400 group-hover:text-slate-500"
                }`}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-4 px-1">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
          Agent vocal activ · non-stop
        </div>

        <div className="rounded-xl border border-slate-200/70 px-3 py-2.5">
          <p className="text-[13px] font-semibold leading-snug text-slate-900">
            {professorName}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{officeName}</p>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <LogoutIcon className="h-[18px] w-[18px]" />
          Deconectare
        </button>
      </div>
    </aside>
  );
}
