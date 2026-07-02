"use client";

import { useEffect, useState } from "react";
import { BanIcon } from "@/components/icons";

type Block = {
  id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
};

export default function BlockSlotsPage() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/blocks");
    if (res.ok) setBlocks((await res.json()).blocks);
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, start, end, reason }),
    });
    setLoading(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Eroare");
      return;
    }
    setDate("");
    setStart("");
    setEnd("");
    setReason("");
    load();
  }

  async function remove(id: string) {
    await fetch("/api/blocks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("ro-RO", {
      timeZone: "Europe/Bucharest",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  const input =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Blocare intervale
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Marcați perioadele indisponibile (ședințe, concediu). Agentul vocal nu
          va oferi aceste intervale studenților.
        </p>
      </header>

      {/* Form card */}
      <form
        onSubmit={add}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
            Data
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
            De la
            <input type="time" required value={start} onChange={(e) => setStart(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
            Până la
            <input type="time" required value={end} onChange={(e) => setEnd(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
            Motiv (opțional)
            <input type="text" placeholder="ex. ședință catedră" value={reason} onChange={(e) => setReason(e.target.value)} className={input} />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card transition hover:bg-brand-dark disabled:opacity-60"
          >
            <BanIcon className="h-4 w-4" />
            {loading ? "Se blochează…" : "Blochează intervalul"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>

      {/* List */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Intervale blocate
        </h2>
        {blocks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
            Niciun interval blocat momentan.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {blocks.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <BanIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {fmt(b.start_time)} — {fmt(b.end_time)}
                  </p>
                  <p className="text-xs text-slate-500">{b.reason ?? "Indisponibil"}</p>
                </div>
                <button
                  onClick={() => remove(b.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  Șterge
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
