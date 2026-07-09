"use client";

import { useEffect, useState } from "react";

type OfficeSettings = {
  name: string;
  professor_name: string;
  notify_email: string | null;
  greeting: string | null;
  feedback_link: string | null;
};

export default function SettingsPage() {
  const [form, setForm] = useState<OfficeSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/office", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { office: null }))
      .then((d) =>
        setForm(
          d.office ?? {
            name: "",
            professor_name: "",
            notify_email: "",
            greeting: "",
            feedback_link: "",
          }
        )
      );
  }, []);

  function set<K extends keyof OfficeSettings>(k: K, v: string) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/office", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Eroare la salvare");
      return;
    }
    setSaved(true);
  }

  const input =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Setări</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configurează biroul și adresa de email care primește notificările.
        </p>
      </header>

      {!form ? (
        <p className="text-sm text-slate-400">Se încarcă…</p>
      ) : (
        <form
          onSubmit={save}
          className="flex max-w-xl flex-col gap-5 rounded-2xl border border-slate-200/70 bg-white p-6"
        >
          <Field label="Email pentru notificări" hint="Aici primești un email la fiecare programare nouă.">
            <input
              type="email"
              placeholder="profesor@universitate.ro"
              value={form.notify_email ?? ""}
              onChange={(e) => set("notify_email", e.target.value)}
              className={input}
            />
          </Field>

          <div className="h-px bg-slate-100" />

          <Field label="Nume profesor">
            <input
              value={form.professor_name}
              onChange={(e) => set("professor_name", e.target.value)}
              className={input}
            />
          </Field>

          <Field label="Departament / birou">
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={input}
            />
          </Field>

          <Field label="Link feedback (opțional)">
            <input
              value={form.feedback_link ?? ""}
              onChange={(e) => set("feedback_link", e.target.value)}
              className={input}
            />
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Se salvează…" : "Salvează"}
            </button>
            {saved && (
              <span className="text-sm font-medium text-emerald-600">
                Salvat ✓
              </span>
            )}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </form>
      )}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {hint && <span className="-mt-1 text-xs text-slate-400">{hint}</span>}
      {children}
    </label>
  );
}
