import Link from "next/link";
import {
  SparkIcon,
  CalendarIcon,
  BanIcon,
  HelpIcon,
  PhoneIcon,
} from "@/components/icons";

const FEATURES = [
  {
    Icon: CalendarIcon,
    title: "Programează",
    body: "Studentul sună, iar agentul verifică disponibilitatea și rezervă un interval la orele de birou.",
  },
  {
    Icon: BanIcon,
    title: "Anulează",
    body: "Studentul se identifică prin numărul de matricol, iar programarea este anulată, eliberând intervalul.",
  },
  {
    Icon: HelpIcon,
    title: "Răspunde",
    body: "Întrebări frecvente — data examenului, restanțe, locația biroului — cu răspunsuri configurate de profesor.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50">
      {/* soft background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-brand-light to-transparent" />

      <div className="relative mx-auto flex max-w-5xl flex-col px-6">
        {/* Nav */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-lift">
              <SparkIcon className="h-5 w-5" />
            </div>
            <span className="font-bold tracking-tight text-brand-ink">
              FacultySync
            </span>
          </div>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Autentificare
          </Link>
        </header>

        {/* Hero */}
        <section className="flex flex-col items-center gap-6 pt-14 pb-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white px-3.5 py-1.5 text-xs font-medium text-brand shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
            Agent vocal · non-stop
          </span>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Un asistent vocal care preia telefonul pentru orele de birou
          </h1>
          <p className="max-w-2xl text-lg text-slate-600">
            Studenții sună la un număr obișnuit, iar agentul programează,
            anulează și răspunde la întrebări — automat, în limba română, la orice
            oră. Fiecare cabinet, complet separat.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-medium text-white shadow-lift transition hover:bg-brand-dark"
            >
              <CalendarIcon className="h-5 w-5" />
              Panoul profesorului
            </Link>
            <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600">
              <PhoneIcon className="h-4 w-4 text-brand" />
              Vocea e gestionată de Vapi
            </span>
          </div>
        </section>

        {/* Feature cards */}
        <section className="grid grid-cols-1 gap-5 pb-20 sm:grid-cols-3">
          {FEATURES.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition hover:shadow-lift"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light text-brand">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                {body}
              </p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
