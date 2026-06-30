import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { adminSupabase } from "@/lib/supabase";
import { bucharestLocalToUtc } from "@/lib/format";

export const dynamic = "force-dynamic";

/** List the office's upcoming blocks. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await adminSupabase
    .from("office_blocks")
    .select("*")
    .eq("office_id", ctx.profile.office_id)
    .gte("end_time", new Date().toISOString())
    .order("start_time", { ascending: true });

  return NextResponse.json({ blocks: data ?? [] });
}

/** Create a block. Body: { date: "YYYY-MM-DD", start: "HH:MM", end: "HH:MM", reason? } */
export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { date, start, end, reason } = body;
  if (
    !date ||
    !start ||
    !end ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^\d{2}:\d{2}/.test(start) ||
    !/^\d{2}:\d{2}/.test(end)
  ) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const startUtc = bucharestLocalToUtc(date, start.slice(0, 5));
  const endUtc = bucharestLocalToUtc(date, end.slice(0, 5));
  if (endUtc.getTime() <= startUtc.getTime()) {
    return NextResponse.json(
      { error: "end must be after start" },
      { status: 400 }
    );
  }

  const { data, error } = await adminSupabase
    .from("office_blocks")
    .insert({
      office_id: ctx.profile.office_id,
      start_time: startUtc.toISOString(),
      end_time: endUtc.toISOString(),
      reason: reason ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

/** Delete a block. Body: { id }. Scoped to the office. */
export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  await adminSupabase
    .from("office_blocks")
    .delete()
    .eq("id", body.id)
    .eq("office_id", ctx.profile.office_id);

  return NextResponse.json({ ok: true });
}
