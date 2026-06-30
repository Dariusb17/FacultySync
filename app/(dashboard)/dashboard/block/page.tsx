"use client";

import { useEffect, useState } from "react";

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

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">Blocare intervale</h1>
        <p className="text-sm text-slate-500">
          Intervalele blocate sunt indisponibile pentru programări (ex. ședințe,
          concediu).
        </p>
      </div>

      <form
        onSubmit={add}
        className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-5"
      >
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Data
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          De la
          <input
            type="time"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Până la
          <input
            type="time"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Motiv (opțional)
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="self-end rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "…" : "Blochează"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {blocks.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            Niciun interval blocat.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Început</th>
                <th className="px-4 py-2 font-medium">Sfârșit</th>
                <th className="px-4 py-2 font-medium">Motiv</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{fmt(b.start_time)}</td>
                  <td className="px-4 py-2">{fmt(b.end_time)}</td>
                  <td className="px-4 py-2 text-slate-500">{b.reason ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => remove(b.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Șterge
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
