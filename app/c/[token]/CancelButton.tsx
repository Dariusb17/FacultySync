"use client";

import { useState } from "react";

export default function CancelButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );

  async function cancel() {
    setState("loading");
    try {
      const res = await fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="font-medium text-green-700">
        Programarea a fost anulată. Vă mulțumim!
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={cancel}
        disabled={state === "loading"}
        className="rounded-lg bg-red-600 px-4 py-2.5 font-medium text-white hover:bg-red-700 disabled:opacity-60"
      >
        {state === "loading" ? "Se anulează…" : "Anulează programarea"}
      </button>
      {state === "error" && (
        <p className="text-sm text-red-600">
          A apărut o eroare. Vă rog încercați din nou.
        </p>
      )}
    </div>
  );
}
