"use client";

import { useEffect, useState } from "react";

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

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">Întrebări frecvente</h1>
        <p className="text-sm text-slate-500">
          Agentul vocal răspunde studenților folosind aceste răspunsuri.
          Cuvintele cheie (separate prin virgulă) sunt comparate cu întrebarea.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {faqs.map((f) => {
          const e = editing[f.id] ?? f;
          const dirty = !!editing[f.id];
          return (
            <div
              key={f.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4"
            >
              <input
                value={e.question_keywords}
                onChange={(ev) =>
                  setEditing((s) => ({
                    ...s,
                    [f.id]: { ...e, question_keywords: ev.target.value },
                  }))
                }
                className="rounded border border-slate-300 px-2 py-1.5 text-sm font-medium"
              />
              <textarea
                value={e.answer}
                onChange={(ev) =>
                  setEditing((s) => ({
                    ...s,
                    [f.id]: { ...e, answer: ev.target.value },
                  }))
                }
                rows={2}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => save(e)}
                  disabled={!dirty || busy}
                  className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  Salvează
                </button>
                <button
                  onClick={() => remove(f.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Șterge
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={add}
        className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-300 bg-white p-4"
      >
        <p className="text-sm font-medium text-slate-700">Adaugă întrebare</p>
        <input
          placeholder="Cuvinte cheie: examen, data examen, sesiune"
          value={newKw}
          onChange={(e) => setNewKw(e.target.value)}
          required
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <textarea
          placeholder="Răspunsul pe care îl va spune agentul"
          value={newAns}
          onChange={(e) => setNewAns(e.target.value)}
          required
          rows={2}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="self-start rounded bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          Adaugă
        </button>
      </form>
    </section>
  );
}
