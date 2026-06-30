import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-brand-dark">
        FacultySync
      </h1>
      <p className="text-lg text-slate-600">
        A multi-tenant voice agent for university professor offices. Students
        call a number; an AI agent books office-hours slots, cancels them, and
        answers FAQs — every office isolated by <code>office_id</code>.
      </p>
      <div className="flex gap-4">
        <Link
          href="/dashboard"
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          Professor dashboard
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-100"
        >
          Log in
        </Link>
      </div>
      <p className="text-sm text-slate-400">
        Voice conversations are handled by Vapi; this app exposes the{" "}
        <code>/api/vapi/*</code> tool webhooks.
      </p>
    </main>
  );
}
