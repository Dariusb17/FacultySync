"use client";

import { useEffect, useState } from "react";
import { HelpIcon, SparkIcon } from "@/components/icons";

type Faq = {
  id: string;
  question_keywords: string;
  answer: string;
};

export default function FaqPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [editing, setEditing] = useState<Record<string, Faq>>({});
  const [newKw, setNewKw] = useState("");
  const [newAns, setNewAns] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/faqs");
    if (res.ok) setFaqs((await res.json()).faqs);
  }
  useEffect(() => {
    load();
  }, []);

  async function save(f: Faq) {
    setBusy(true);
    await fetch("/api/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    setBusy(false);
    setEditing((e) => {
      const n = { ...e };
      delete n[f.id];
      return n;
    });
    load();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_keywords: newKw, answer: newAns }),
    });
    setBusy(false);
    setNewKw("");
    setNewAns("");
    load();
  }

  async function remove(id: string) {
    await fetch("/api/faqs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  const input =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Întrebări frecvente
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Agentul vocal citește aceste răspunsuri studenților. Cuvintele cheie
          (separate prin virgulă) sunt comparate cu întrebarea rostită.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {faqs.map((f) => {
          const e = editing[f.id] ?? f;
          const dirty = !!editing[f.id];
          return (
            <div
              key={f.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand/70">
                <HelpIcon className="h-4 w-4" />
                Cuvinte cheie
              </div>
              <input
                value={e.question_keywords}
                onChange={(ev) =>
                  setEditing((s) => ({
                    ...s,
                    [f.id]: { ...e, question_keywords: ev.target.value },
                  }))
                }
                className={`${input} font-medium`}
              />
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Răspuns
              </label>
              <textarea
                value={e.answer}
                onChange={(ev) =>
                  setEditing((s) => ({
                    ...s,
                    [f.id]: { ...e, answer: ev.target.value },
                  }))
                }
                rows={2}
                className={input}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => save(e)}
                  disabled={!dirty || busy}
                  className="rounded-lg bg-brand px-3.5 py-2 text-xs font-medium text-white transition hover:bg-brand-dark disabled:opacity-40"
                >
                  Salvează
                </button>
                <button
                  onClick={() => remove(f.id)}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  Șterge
                </button>
                {dirty && (
                  <span className="text-xs text-amber-600">Modificări nesalvate</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add card */}
      <form
        onSubmit={add}
        className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <SparkIcon className="h-4 w-4 text-brand" />
          Adaugă o întrebare
        </p>
        <input
          placeholder="Cuvinte cheie: examen, data examen, sesiune"
          value={newKw}
          onChange={(e) => setNewKw(e.target.value)}
          required
          className={input}
        />
        <textarea
          placeholder="Răspunsul pe care îl va rosti agentul"
          value={newAns}
          onChange={(e) => setNewAns(e.target.value)}
          required
          rows={2}
          className={input}
        />
        <button
          type="submit"
          disabled={busy}
          className="self-start rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          Adaugă întrebarea
        </button>
      </form>
    </section>
  );
}
