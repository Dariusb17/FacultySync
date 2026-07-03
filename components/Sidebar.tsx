"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ListIcon,
  CalendarIcon,
  BanIcon,
  HelpIcon,
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
    <aside className="flex flex-col gap-8 bg-brand-navy px-4 py-6 text-slate-300 md:min-h-screen md:w-64 md:py-8">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white shadow-glow ring-1 ring-white/10">
          <Image
            src="/logo.png"
            alt="FacultyVoice"
            width={34}
            height={34}
            className="h-[34px] w-[34px] object-contain"
          />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-white">
          Faculty<span className="text-blue-400">Voice</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-brand-gradient font-semibold text-white shadow-glow"
                  : "font-medium text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] ${
                  active ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                }`}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-4 px-1">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Agent vocal activ · non-stop
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <p className="text-[13px] font-semibold leading-snug text-white">
            {professorName}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{officeName}</p>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
        >
          <LogoutIcon className="h-[18px] w-[18px]" />
          Deconectare
        </button>
      </div>
    </aside>
  );
}
